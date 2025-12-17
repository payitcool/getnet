const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock dependencies
jest.mock('../config/database');
jest.mock('../models/Payment');
jest.mock('../utils/logger');

const Payment = require('../models/Payment');
const { logToDB } = require('../utils/logger');

// Create test app
function createTestApp() {
    const app = express();
    app.use(bodyParser.json());
    
    // Import route after mocks are set
    const { validatePaymentRequest, validateReference, generateReference, createPaymentData } = require('../services/paymentService');
    const { generateAuth } = require('../utils/auth');
    
    const LOGIN = 'test_login';
    const SECRET_KEY = 'test_secret';
    const DOMAIN = 'https://test.example.com';
    
    app.post('/api/create-payment', async (req, res) => {
        try {
            const { amount, buyer, description, reference: customReference, currency, returnUrl: customReturnUrl, externalURLCallback } = req.body;
            
            // Validate required fields
            const validation = validatePaymentRequest({ amount, buyer, returnUrl: customReturnUrl });
            if (!validation.isValid) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: validation.missingFields
                });
            }

            let reference = generateReference(customReference);
            
            // Validate reference length
            const refValidation = validateReference(reference);
            if (!refValidation.isValid) {
                return res.status(400).json({
                    error: 'Invalid reference',
                    message: 'Reference must be between 1 and 32 characters',
                    provided: refValidation.length
                });
            }
            
            const paymentCurrency = currency || 'CLP';
            
            // Simulate Getnet response
            const mockRequestId = 'TEST-' + Date.now();
            const mockProcessUrl = 'https://getnet.test/checkout/' + mockRequestId;
            
            // Save to database (mocked)
            await Payment.create({
                requestId: mockRequestId,
                reference,
                amount,
                currency: paymentCurrency,
                status: 'CREATED',
                buyer,
                externalURLCallback,
                processUrl: mockProcessUrl,
                createdAt: new Date()
            });

            await logToDB('SUCCESS', {
                endpoint: '/api/create-payment',
                method: 'POST',
                requestId: mockRequestId,
                reference,
                ip: req.ip
            });

            return res.json({
                success: true,
                requestId: mockRequestId,
                processUrl: mockProcessUrl,
                reference
            });

        } catch (error) {
            await logToDB('ERROR', {
                endpoint: '/api/create-payment',
                method: 'POST',
                error: error.message,
                ip: req.ip
            });

            res.status(500).json({ 
                error: 'Error connecting to Getnet', 
                message: error.message 
            });
        }
    });
    
    return app;
}

describe('POST /api/create-payment', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        Payment.create = jest.fn().mockResolvedValue({});
        app = createTestApp();
    });

    describe('Validation', () => {
        test('should return 400 if amount is missing', async () => {
            const response = await request(app)
                .post('/api/create-payment')
                .send({
                    buyer: { email: 'test@example.com' },
                    returnUrl: 'https://example.com/return'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing required fields');
            expect(response.body.required).toContain('amount');
        });

        test('should return 400 if buyer.email is missing', async () => {
            const response = await request(app)
                .post('/api/create-payment')
                .send({
                    amount: 10000,
                    returnUrl: 'https://example.com/return'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing required fields');
            expect(response.body.required).toContain('buyer.email');
        });

        test('should return 400 if returnUrl is missing', async () => {
            const response = await request(app)
                .post('/api/create-payment')
                .send({
                    amount: 10000,
                    buyer: { email: 'test@example.com' }
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing required fields');
            expect(response.body.required).toContain('returnUrl');
        });

        test('should return 400 if reference exceeds 32 characters', async () => {
            const response = await request(app)
                .post('/api/create-payment')
                .send({
                    amount: 10000,
                    buyer: { email: 'test@example.com' },
                    returnUrl: 'https://example.com/return',
                    reference: 'A'.repeat(33) // 33 characters
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid reference');
            expect(response.body.message).toContain('32 characters');
        });
    });

    describe('Success Cases', () => {
        test('should create payment with all required fields', async () => {
            const paymentData = {
                amount: 10000,
                buyer: { 
                    email: 'test@example.com',
                    name: 'Test User'
                },
                returnUrl: 'https://example.com/return'
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.requestId).toBeDefined();
            expect(response.body.processUrl).toBeDefined();
            expect(response.body.reference).toBeDefined();
            expect(Payment.create).toHaveBeenCalled();
        });

        test('should create payment with custom reference', async () => {
            const customRef = 'CUSTOM-ORDER-123';
            const paymentData = {
                amount: 5000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return',
                reference: customRef
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(response.body.reference).toBe(customRef);
        });

        test('should generate reference if not provided', async () => {
            const paymentData = {
                amount: 5000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return'
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(response.body.reference).toMatch(/^ORDER-\d+$/);
        });

        test('should use default currency CLP if not provided', async () => {
            const paymentData = {
                amount: 5000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return'
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(Payment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    currency: 'CLP'
                })
            );
        });

        test('should accept custom currency', async () => {
            const paymentData = {
                amount: 100,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return',
                currency: 'USD'
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(Payment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    currency: 'USD'
                })
            );
        });

        test('should save externalURLCallback if provided', async () => {
            const callbackUrl = 'https://myapp.com/callback';
            const paymentData = {
                amount: 10000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return',
                externalURLCallback: callbackUrl
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(Payment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    externalURLCallback: callbackUrl
                })
            );
        });

        test('should save payment with CREATED status', async () => {
            const paymentData = {
                amount: 10000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return'
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(Payment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'CREATED'
                })
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors', async () => {
            Payment.create = jest.fn().mockRejectedValue(new Error('Database error'));

            const paymentData = {
                amount: 10000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return'
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Error connecting to Getnet');
        });
    });

    describe('Edge Cases', () => {
        test('should accept reference at exactly 32 characters', async () => {
            const maxLengthRef = 'A'.repeat(32);
            const paymentData = {
                amount: 10000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return',
                reference: maxLengthRef
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(response.body.reference).toBe(maxLengthRef);
        });

        test('should handle buyer with all optional fields', async () => {
            const paymentData = {
                amount: 10000,
                buyer: { 
                    email: 'test@example.com',
                    name: 'John',
                    surname: 'Doe',
                    mobile: '+56912345678'
                },
                returnUrl: 'https://example.com/return'
            };

            const response = await request(app)
                .post('/api/create-payment')
                .send(paymentData);

            expect(response.status).toBe(200);
            expect(Payment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    buyer: expect.objectContaining({
                        email: 'test@example.com',
                        name: 'John'
                    })
                })
            );
        });
    });
});
