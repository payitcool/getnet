const CryptoJS = require('crypto-js');
const moment = require('moment');

/**
 * Generates PlaceToPay authentication object
 * @param {string} login - The login credential
 * @param {string} secretKey - The secret key
 * @returns {Object} Authentication object with login, tranKey, nonce, and seed
 */
function generateAuth(login, secretKey) {
    // Generate random alphanumeric nonce string (same method as original)
    const nonceString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const seed = moment().toISOString();
    
    // Encode nonce to Base64
    const nonceBase64 = Buffer.from(nonceString).toString('base64');
    
    // Calculate tranKey: Base64(SHA256(nonce + seed + secretKey))
    const tranKey = CryptoJS.SHA256(nonceString + seed + secretKey).toString(CryptoJS.enc.Base64);

    return {
        login,
        tranKey,
        nonce: nonceBase64,
        seed
    };
}

module.exports = {
    generateAuth
};
