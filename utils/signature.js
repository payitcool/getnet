const CryptoJS = require('crypto-js');

/**
 * Validates the signature of a Getnet notification
 * @param {Object} params - The parameters for validation
 * @param {number} params.requestId - The request ID from Getnet
 * @param {Object} params.status - The status object containing status and date
 * @param {string} params.signature - The signature to validate
 * @param {string} params.secretKey - The secret key for validation
 * @param {string} params.fallbackDate - Fallback date if status.date is not present
 * @returns {Object} - { isValid: boolean, calculatedSignature: string, stringUsed: string }
 */
function validateGetnetSignature({ requestId, status, signature, secretKey, fallbackDate = '' }) {
    if (!requestId || !signature || !secretKey) {
        return {
            isValid: false,
            error: 'Missing required parameters',
            calculatedSignature: null,
            stringUsed: null
        };
    }

    const statusStr = status?.status || '';
    const dateStr = status?.date || fallbackDate || new Date().toISOString();
    
    // Getnet uses SHA-1 (not SHA-256) for signature validation
    const calculatedSignature = CryptoJS.SHA1(
        `${requestId}${statusStr}${dateStr}${secretKey}`
    ).toString();

    let isValid = calculatedSignature === signature;
    
    // In PRODUCTION, reject hardcoded signatures
    if (process.env.ENV === 'PRODUCTION') {
        const hardcodedSignatures = [
            'ab5886e4cc24d156f457cd83d70f343a420e3991' // Known test signature
        ];
        
        if (hardcodedSignatures.includes(signature)) {
            isValid = false;
        }
    }
    
    return {
        isValid,
        calculatedSignature,
        providedSignature: signature,
        stringUsed: `${requestId}${statusStr}${dateStr}[SECRET_KEY]`
    };
}

module.exports = {
    validateGetnetSignature
};
