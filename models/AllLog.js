const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            // Core operations
            'PAYMENT_CREATED',
            'NOTIFICATION_RECEIVED',
            'NOTIFICATION_INVALID_SIGNATURE',
            'STATUS_QUERY',
            'ERROR',
            'INFO',
            // Callback operations
            'CALLBACK_SUCCESS',
            'CALLBACK_FAILED',
            'CALLBACK_PENDING',
            // Cron operations
            'CRON_STARTED',
            'CRON_RECONCILIATION',
            'CRON_PAYMENT_UPDATED',
            'CRON_CALLBACKS',
            'CRON_CALLBACK_SUCCESS',
            'CRON_CALLBACK_FAILED',
            'CRON_COMPLETED',
            'CRON_ERROR',
            // Health check
            'HEALTH_CHECK',
            'HEALTH_CHECK_ERROR'
        ]
    },
    requestId: String,
    endpoint: String,
    method: String,
    statusCode: Number,
    request: mongoose.Schema.Types.Mixed,
    response: mongoose.Schema.Types.Mixed,
    error: String,
    message: String,
    ip: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
logSchema.index({ type: 1, timestamp: -1 });
logSchema.index({ requestId: 1, timestamp: -1 });

module.exports = mongoose.model('AllLog', logSchema);
