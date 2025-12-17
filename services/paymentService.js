const { generateAuth } = require('../utils/auth');
const Payment = require('../models/Payment');
const { logToDB } = require('../utils/logger');

/**
 * Validates payment request data
 * @param {Object} data - Payment request data
 * @returns {Object} { isValid: boolean, missingFields: Array }
 */
function validatePaymentRequest(data) {
    const { amount, buyer, returnUrl } = data;
    const missingFields = [];

    if (!amount) missingFields.push('amount');
    if (!buyer || !buyer.email) missingFields.push('buyer.email');
    if (!returnUrl) missingFields.push('returnUrl');

    return {
        isValid: missingFields.length === 0,
        missingFields
    };
}

/**
 * Validates reference length (max 32 characters for Getnet)
 * @param {string} reference - Payment reference
 * @returns {Object} { isValid: boolean, length: number }
 */
function validateReference(reference) {
    if (!reference) {
        return { isValid: true, length: 0 }; // Optional field
    }

    return {
        isValid: reference.length > 0 && reference.length <= 32,
        length: reference.length
    };
}

/**
 * Generates payment reference if not provided
 * @param {string} customReference - Custom reference (optional)
 * @returns {string} Generated or provided reference
 */
function generateReference(customReference) {
    return customReference || `ORDER-${Date.now()}`;
}

/**
 * Creates payment data for Getnet API
 * @param {Object} params - Payment parameters
 * @returns {Object} Formatted payment data for Getnet
 */
function createPaymentData(params) {
    const {
        login,
        secretKey,
        buyer,
        amount,
        currency = 'CLP',
        description,
        reference,
        returnUrl,
        notificationUrl,
        domain,
        ip = '127.0.0.1',
        userAgent = 'Unknown',
        expirationMinutes = 10
    } = params;

    const auth = generateAuth(login, secretKey);
    const moment = require('moment');

    return {
        auth,
        locale: 'es_CL',
        buyer: {
            name: buyer.name || 'Cliente',
            surname: buyer.surname || '',
            email: buyer.email,
            mobile: buyer.mobile || ''
        },
        payment: {
            reference,
            description: description || `Pago de ${currency} $${amount}`,
            amount: {
                currency,
                total: amount
            }
        },
        expiration: moment().add(expirationMinutes, 'minutes').toISOString(),
        returnUrl,
        notificationUrl: notificationUrl || `${domain}/api/notification`,
        ipAddress: ip,
        userAgent
    };
}

/**
 * Saves payment to database
 * @param {Object} paymentInfo - Payment information
 * @returns {Promise<Object>} Created payment document
 */
async function savePayment(paymentInfo) {
    const {
        requestId,
        reference,
        amount,
        currency,
        buyer,
        externalURLCallback,
        processUrl
    } = paymentInfo;

    return await Payment.create({
        requestId,
        reference,
        amount,
        currency,
        status: 'CREATED',
        buyer,
        externalURLCallback,
        processUrl,
        createdAt: new Date()
    });
}

module.exports = {
    validatePaymentRequest,
    validateReference,
    generateReference,
    createPaymentData,
    savePayment
};
