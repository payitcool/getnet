const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['PAYMENT_CREATED', 'NOTIFICATION_RECEIVED', 'STATUS_QUERY', 'ERROR', 'INFO']
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
