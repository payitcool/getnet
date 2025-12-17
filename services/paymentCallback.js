const Payment = require('../models/Payment');
const RetryCallback = require('../models/RetryCallback');
const { sendCallback, CALLBACK_CONFIG } = require('../utils/callback');
const { logToDB } = require('../utils/logger');

/**
 * Executes external callback for a payment
 * If it fails, creates/updates record in RetryCallback
 * If successful, marks payment as callbackExecuted
 * 
 * @param {Object} payment - Payment document from MongoDB
 * @param {string} serverSecret - Server-to-server secret
 * @returns {Promise<boolean>} - true if successful
 */
async function executeExternalCallback(payment, serverSecret = '') {
    const callbackUrl = payment.externalURLCallback;
    const requestId = payment.requestId;

    console.log(`📤 Executing external callback for ${requestId}: ${callbackUrl}`);

    const result = await sendCallback({
        callbackUrl,
        requestId,
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        buyer: payment.buyer,
        isRetry: false,
        attemptNumber: 1,
        serverSecret
    });

    if (result.success) {
        console.log(`✅ Callback successful for ${requestId}: Status ${result.statusCode} (${payment.status})`);

        await logToDB('CALLBACK_SUCCESS', {
            requestId,
            callbackUrl,
            status: payment.status,
            statusCode: result.statusCode,
            timestamp: new Date()
        });

        return true;

    } else {
        console.error(`❌ Callback failed for ${requestId}: ${result.error} (Status: ${result.statusCode})`);

        const nextAttempt = 1;
        const minutesToWait = (nextAttempt + 1) * CALLBACK_CONFIG.RETRY_BASE_MINUTES;
        const nextRetryAt = new Date(Date.now() + minutesToWait * 60 * 1000);

        await RetryCallback.findOneAndUpdate(
            { requestId },
            {
                $set: {
                    reference: payment.reference,
                    callbackUrl,
                    status: 'PENDING',
                    lastAttempt: new Date(),
                    lastError: result.error,
                    lastStatusCode: result.statusCode,
                    nextRetryAt,
                    paymentData: {
                        amount: payment.amount,
                        currency: payment.currency,
                        paymentStatus: payment.status,
                        buyer: payment.buyer
                    }
                },
                $inc: { attempts: 1 }
            },
            { upsert: true, new: true }
        );

        await logToDB('CALLBACK_FAILED', {
            requestId,
            callbackUrl,
            statusCode: result.statusCode,
            error: result.error,
            message: 'Callback failed, queued for retry',
            timestamp: new Date()
        });

        return false;
    }
}

/**
 * Retries a callback from RetryCallback
 * Infinite retries with backoff: attempt N → wait N+1 minutes for next
 * 
 * @param {Object} retryCallback - RetryCallback document from MongoDB
 * @param {string} serverSecret - Server-to-server secret
 * @returns {Promise<{success: boolean}>}
 */
async function retryCallback(retryCallback, serverSecret = '') {
    const attemptNumber = retryCallback.attempts + 1;
    
    console.log(`🔄 Retrying callback for ${retryCallback.requestId} (attempt ${attemptNumber})`);

    const result = await sendCallback({
        callbackUrl: retryCallback.callbackUrl,
        requestId: retryCallback.requestId,
        reference: retryCallback.reference,
        status: retryCallback.paymentData.paymentStatus,
        amount: retryCallback.paymentData.amount,
        currency: retryCallback.paymentData.currency,
        buyer: retryCallback.paymentData.buyer,
        isRetry: true,
        attemptNumber,
        serverSecret
    });

    retryCallback.attempts = attemptNumber;
    retryCallback.lastAttempt = new Date();
    retryCallback.lastStatusCode = result.statusCode;

    if (result.success) {
        retryCallback.status = 'SUCCESS';
        retryCallback.successAt = new Date();
        retryCallback.lastError = null;
        retryCallback.nextRetryAt = null;
        await retryCallback.save();

        await Payment.updateOne(
            { requestId: retryCallback.requestId },
            { $set: { callbackExecuted: true } }
        );

        console.log(`✅ Callback succeeded for ${retryCallback.requestId} after ${attemptNumber} attempts`);

        await logToDB('CRON_CALLBACK_SUCCESS', {
            requestId: retryCallback.requestId,
            callbackUrl: retryCallback.callbackUrl,
            attempt: attemptNumber,
            statusCode: result.statusCode
        });

        return { success: true };

    } else {
        retryCallback.lastError = result.error;
        const minutesToWait = (attemptNumber + 1) * CALLBACK_CONFIG.RETRY_BASE_MINUTES;
        retryCallback.nextRetryAt = new Date(Date.now() + minutesToWait * 60 * 1000);

        console.log(`❌ Callback failed for ${retryCallback.requestId}: ${result.error}`);
        console.log(`   ⏰ Next retry in ${minutesToWait} minutes (attempt ${attemptNumber + 1})`);

        await retryCallback.save();

        await logToDB('CRON_CALLBACK_FAILED', {
            requestId: retryCallback.requestId,
            callbackUrl: retryCallback.callbackUrl,
            attempt: attemptNumber,
            statusCode: result.statusCode,
            error: result.error,
            nextRetryAt: retryCallback.nextRetryAt,
            minutesToNextRetry: minutesToWait
        });

        return { success: false };
    }
}

/**
 * Notifies payment status changes
 * Executes on ALL status changes: CREATED, PENDING, APPROVED, REJECTED, etc.
 * 
 * @param {string} transactionId - The requestId from Getnet
 * @param {string} oldStatus - The previous payment status
 * @param {string} newStatus - The new payment status
 * @param {string} serverSecret - Server-to-server secret
 */
async function notifyPaymentStatusChange(transactionId, oldStatus, newStatus, serverSecret = '') {
    console.log(`🔔 [STATUS CHANGED] Transaction ${transactionId}: ${oldStatus} → ${newStatus}`);
    
    try {
        const payment = await Payment.findOne({ requestId: transactionId });
        
        if (!payment) {
            console.error(`❌ Payment not found for transactionId: ${transactionId}`);
            return;
        }

        if (payment.externalURLCallback) {
            await executeExternalCallback(payment, serverSecret);
        } else {
            console.log(`ℹ️  No external callback configured for ${transactionId}`);
        }

        await logToDB('INFO', {
            message: `Payment status changed: ${oldStatus} → ${newStatus}`,
            requestId: transactionId,
            oldStatus,
            newStatus,
            hasCallback: !!payment.externalURLCallback,
            timestamp: new Date()
        });

    } catch (error) {
        console.error(`❌ Error in notifyPaymentStatusChange: ${error.message}`);
        await logToDB('ERROR', {
            message: 'Error in notifyPaymentStatusChange',
            requestId: transactionId,
            oldStatus,
            newStatus,
            error: error.message,
            timestamp: new Date()
        });
    }
}

module.exports = {
    executeExternalCallback,
    retryCallback,
    notifyPaymentStatusChange
};
