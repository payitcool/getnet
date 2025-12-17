const CryptoJS = require('crypto-js');
const moment = require('moment');

/**
 * Generates PlaceToPay authentication object
 * @param {string} login - The login credential
 * @param {string} secretKey - The secret key
 * @returns {Object} Authentication object with login, tranKey, nonce, and seed
 */
function generateAuth(login, secretKey) {
    const nonce = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Base64);
    const seed = moment().toISOString();
    const tranKey = CryptoJS.SHA256(nonce + seed + secretKey).toString(CryptoJS.enc.Base64);

    return {
        login,
        tranKey,
        nonce,
        seed
    };
}

module.exports = {
    generateAuth
};
