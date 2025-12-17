const crypto = require('crypto');

/**
 * Generates a unique secret hash for a callback URL
 * @param {string} callbackUrl - The callback URL
 * @param {string} secret - The server-to-server secret
 * @returns {string} SHA-1 hash of secret + callbackUrl
 */
function generateCallbackSecret(callbackUrl, secret = '') {
    return crypto
        .createHash('sha1')
        .update(secret + callbackUrl)
        .digest('hex');
}

/**
 * Configuration for callback retries
 */
const CALLBACK_CONFIG = {
    TIMEOUT_MS: 10000,              // Timeout of 10 seconds
    VALID_STATUS_CODES: [200, 201], // Valid HTTP status codes
    RETRY_BASE_MINUTES: 1,          // Base for backoff: attempt N → wait N+1 minutes
    BATCH_SIZE: 100                 // Maximum callbacks to process per cron execution
};

/**
 * Sends a callback to an external URL
 * @param {Object} options - Callback options
 * @param {string} options.callbackUrl - Callback URL
 * @param {string} options.requestId - Transaction ID
 * @param {string} options.reference - Payment reference
 * @param {string} options.status - Payment status (APPROVED, etc.)
 * @param {number} options.amount - Payment amount
 * @param {string} options.currency - Currency
 * @param {Object} options.buyer - Buyer data
 * @param {boolean} options.isRetry - If it's a retry
 * @param {number} options.attemptNumber - Attempt number
 * @param {string} options.serverSecret - Server-to-server secret
 * @returns {Promise<{success: boolean, statusCode: number, error?: string}>}
 */
async function sendCallback(options) {
    const {
        callbackUrl,
        requestId,
        reference,
        status,
        amount,
        currency,
        buyer,
        isRetry = false,
        attemptNumber = 1,
        serverSecret = ''
    } = options;

    const secretHash = generateCallbackSecret(callbackUrl, serverSecret);

    const payload = {
        secretHash,
        requestId,
        reference,
        status,
        amount,
        currency,
        buyer,
        timestamp: new Date().toISOString(),
        isRetry,
        attemptNumber
    };

    const headers = {
        'Content-Type': 'application/json',
        'X-Getnet-RequestId': requestId,
        'X-Attempt-Number': String(attemptNumber)
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CALLBACK_CONFIG.TIMEOUT_MS);

        const response = await fetch(callbackUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (CALLBACK_CONFIG.VALID_STATUS_CODES.includes(response.status)) {
            return {
                success: true,
                statusCode: response.status
            };
        } else {
            const data = await response.json().catch(() => ({}));
            return {
                success: false,
                statusCode: response.status,
                error: data.message || data.error || `HTTP ${response.status}`
            };
        }

    } catch (error) {
        return {
            success: false,
            statusCode: 0,
            error: error.name === 'AbortError' ? 'Timeout' : error.message
        };
    }
}

module.exports = {
    sendCallback,
    generateCallbackSecret,
    CALLBACK_CONFIG
};
