const CryptoJS = require('crypto-js');
const moment = require('moment');

/**
 * Generates PlaceToPay authentication object
 * @param {string} login - The login credential
 * @param {string} secretKey - The secret key
 * @returns {Object} Authentication object with login, tranKey, nonce, and seed
 */
function generateAuth(login, secretKey) {
    // Generate random nonce string
    const nonceString = CryptoJS.lib.WordArray.random(16).toString();
    const seed = moment().toISOString();
    
    // Calculate tranKey: Base64(SHA256(nonce + seed + secretKey))
    const tranKey = CryptoJS.SHA256(nonceString + seed + secretKey).toString(CryptoJS.enc.Base64);
    
    // Encode nonce to Base64
    const nonceBase64 = CryptoJS.enc.Utf8.parse(nonceString).toString(CryptoJS.enc.Base64);

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
