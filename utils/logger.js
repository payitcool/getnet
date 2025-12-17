const AllLog = require('../models/AllLog');

/**
 * Logs data to database
 * @param {string} type - Log type (must match AllLog enum)
 * @param {Object} data - Data to log
 * @returns {Promise<void>}
 */
async function logToDB(type, data) {
    try {
        await AllLog.create({
            type,
            ...data,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error logging to DB:', error.message);
    }
}

module.exports = {
    logToDB
};
