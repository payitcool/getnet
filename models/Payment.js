const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    requestId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    reference: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'CLP'
    },
    status: {
        type: String,
        enum: ['CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK'],
        default: 'CREATED'
    },
    buyer: {
        name: String,
        email: String,
        document: String
    },
    externalURLCallback: {
        type: String,
        default: null
    },
    callbackExecuted: {
        type: Boolean,
        default: false
    },
    processUrl: String,
    getnetResponse: mongoose.Schema.Types.Mixed,
    lastStatusUpdate: Date,
    notifications: [{
        receivedAt: Date,
        data: mongoose.Schema.Types.Mixed
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
