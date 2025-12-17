/**
 * Integration tests for create-payment endpoint
 * These tests make REAL calls to Getnet TEST API and MongoDB
 * and clean up after themselves
 */

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('../models/Payment');
const { validatePaymentRequest, validateReference, generateReference, createPaymentData } = require('../services/paymentService');
const { generateAuth } = require('../utils/auth');
const { logToDB } = require('../utils/logger');

// Use TEST credentials
const LOGIN = process.env.TEST_LOGIN;
const SECRET_KEY = process.env.TEST_SECRET_KEY;
const GETNET_URL = 'https://checkout-test.placetopay.com/api/session';
const DOMAIN = 'http://localhost:3000';

let app;
let createdReferences = [];

beforeAll(async () => {
    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/getnet-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    }

    // Create Express app
    app = express();
    app.use(bodyParser.json());
    
    // Define the endpoint
    app.post('/api/create-payment', async (req, res) => {
        try {
            const { amount, buyer, description, reference: customReference, currency, returnUrl: customReturnUrl, externalURLCallback } = req.body;
            
            const validation = validatePaymentRequest({ amount, buyer, returnUrl: customReturnUrl });
            if (!validation.isValid) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: validation.missingFields
                });
            }

            let reference = generateReference(customReference);
            createdReferences.push(reference); // Track for cleanup
            
            const refValidation = validateReference(reference);
            if (!refValidation.isValid) {
                return res.status(400).json({
                    error: 'Invalid reference',
                    message: 'Reference must be between 1 and 32 characters',
                    provided: refValidation.length
                });
            }

            const returnUrl = customReturnUrl || `${DOMAIN}/response`;
            const cancelUrl = `${DOMAIN}/response`;
            
            const paymentData = createPaymentData({
                reference,
                description: description || 'Pago desde API',
                amount,
                currency: currency || 'CLP',
                buyer,
                returnUrl,
                cancelUrl,
                externalURLCallback
            });

            const auth = generateAuth(LOGIN, SECRET_KEY);
            
            const requestBody = {
                auth,
                payment: paymentData.payment,
                expiration: paymentData.expiration,
                returnUrl: paymentData.returnUrl,
                cancelUrl: paymentData.cancelUrl,
                ipAddress: '127.0.0.1',
                userAgent: 'API-Test'
            };

            if (externalURLCallback) {
                requestBody.externalURLCallback = externalURLCallback;
            }

            const response = await fetch(GETNET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.status.status === 'OK') {
                const payment = new Payment({
                    requestId: data.requestId,
                    reference: paymentData.payment.reference,
                    description: paymentData.payment.description,
                    amount: paymentData.payment.amount.total,
                    currency: paymentData.payment.amount.currency,
                    buyer: paymentData.payment.buyer,
                    returnUrl: paymentData.returnUrl,
                    cancelUrl: paymentData.cancelUrl,
                    status: data.status.status,
                    processUrl: data.processUrl,
                    externalURLCallback
                });

                await payment.save();
                await logToDB('PAYMENT_CREATED', { requestId: data.requestId, reference });

                return res.json({
                    success: true,
                    requestId: data.requestId,
                    processUrl: data.processUrl,
                    reference: paymentData.payment.reference,
                    expiresAt: paymentData.expiration
                });
            } else {
                throw new Error(`Getnet error: ${data.status.message}`);
            }
        } catch (error) {
            console.error('Error in create-payment:', error.message);
            return res.status(500).json({
                error: 'Error connecting to Getnet',
                message: error.message
            });
        }
    });
});

afterAll(async () => {
    // Cleanup: delete all created payments
    if (createdReferences.length > 0) {
        await Payment.deleteMany({ reference: { $in: createdReferences } });
        console.log(`✓ Cleaned up ${createdReferences.length} test payments`);
    }
    
    // Close MongoDB connection
    await mongoose.connection.close();
});

describe('Create Payment - Real Integration Tests', () => {
    test('should create a real payment in Getnet TEST', async () => {
        const response = await request(app)
            .post('/api/create-payment')
            .send({
                reference: `INT-TEST-${Date.now()}`,
                description: 'Integration test payment',
                amount: 1000,
                buyer: {
                    name: 'Test',
                    surname: 'Integration',
                    email: 'test@integration.com'
                },
                returnUrl: 'http://localhost:3000/response'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.requestId).toBeDefined();
        expect(response.body.processUrl).toContain('checkout-test.placetopay.com');
        expect(response.body.reference).toBeDefined();
        
        // Verify it was saved to MongoDB
        const savedPayment = await Payment.findOne({ reference: response.body.reference });
        expect(savedPayment).toBeDefined();
        expect(savedPayment.requestId).toBe(response.body.requestId);
        expect(savedPayment.amount).toBe(1000);
    }, 15000); // 15 second timeout for real API call

    test('should validate buyer fields', async () => {
        const response = await request(app)
            .post('/api/create-payment')
            .send({
                amount: 1000,
                buyer: {
                    name: 'Test'
                    // Missing surname and email
                }
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Missing required fields');
    });

    test('should generate reference if not provided', async () => {
        const response = await request(app)
            .post('/api/create-payment')
            .send({
                description: 'Auto-generated reference test',
                amount: 500,
                buyer: {
                    name: 'Auto',
                    surname: 'Reference',
                    email: 'auto@test.com'
                }
            });

        expect(response.status).toBe(200);
        expect(response.body.reference).toMatch(/^REF-/);
    }, 15000);

    test('should reject reference longer than 32 characters', async () => {
        const response = await request(app)
            .post('/api/create-payment')
            .send({
                reference: 'THIS-IS-A-VERY-LONG-REFERENCE-THAT-EXCEEDS-32-CHARS',
                amount: 1000,
                buyer: {
                    name: 'Test',
                    surname: 'Long',
                    email: 'long@test.com'
                }
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid reference');
    });

    test('should use default returnUrl if not provided', async () => {
        const response = await request(app)
            .post('/api/create-payment')
            .send({
                reference: `DEFAULT-URL-${Date.now()}`,
                amount: 2000,
                buyer: {
                    name: 'Default',
                    surname: 'URL',
                    email: 'default@test.com'
                }
            });

        expect(response.status).toBe(200);
        
        const savedPayment = await Payment.findOne({ reference: response.body.reference });
        expect(savedPayment.returnUrl).toBe('http://localhost:3000/response');
    }, 15000);
});
