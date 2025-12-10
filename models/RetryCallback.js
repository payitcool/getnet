const mongoose = require('mongoose');

const retryCallbackSchema = new mongoose.Schema({
    requestId: {
        type: String,
        required: true,
        index: true
    },
    reference: {
        type: String,
        index: true
    },
    callbackUrl: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'SUCCESS'],
        default: 'PENDING'
    },
    attempts: {
        type: Number,
        default: 0
    },
    // Próximo reintento: attempts + 1 minutos después del último intento
    // Si attempts = 9, nextRetryAt = lastAttempt + 10 minutos
    nextRetryAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastAttempt: {
        type: Date
    },
    lastError: {
        type: String
    },
    lastStatusCode: {
        type: Number
    },
    successAt: {
        type: Date
    },
    paymentData: {
        amount: Number,
        currency: String,
        paymentStatus: String,
        buyer: {
            name: String,
            email: String,
            document: String
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Actualizar updatedAt en cada save
retryCallbackSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('RetryCallback', retryCallbackSchema);
