/**
 * Integration tests for create-payment endpoint
 * These tests make REAL calls to the running server (which calls Getnet TEST API)
 * and clean up after themselves
 */

const request = require('supertest');
const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('../models/Payment');

// Base URL of the running server
const BASE_URL = 'http://localhost:3000';

let createdReferences = [];

beforeAll(async () => {
    // Connect to MongoDB
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/getnet-test');
    }
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
        const reference = `INT-TEST-${Date.now()}`;
        createdReferences.push(reference);
        
        const response = await request(BASE_URL)
            .post('/api/create-payment')
            .send({
                reference,
                description: 'Integration test payment',
                amount: 1000,
                buyer: {
                    name: 'Test',
                    surname: 'Integration',
                    email: 'test@integration.com'
                },
                returnUrl: 'http://example.com/return'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.requestId).toBeDefined();
        expect(response.body.processUrl).toContain('checkout');
        expect(response.body.reference).toBe(reference);
        
        // Verify it was saved to MongoDB
        const savedPayment = await Payment.findOne({ reference });
        expect(savedPayment).toBeDefined();
        expect(savedPayment.requestId.toString()).toBe(response.body.requestId.toString());
        expect(savedPayment.amount).toBe(1000);
    }, 15000); // 15 second timeout for real API call

    test('should validate buyer fields', async () => {
        const response = await request(BASE_URL)
            .post('/api/create-payment')
            .send({
                amount: 1000,
                buyer: {
                    name: 'Test'
                    // Missing surname and email
                },
                returnUrl: 'http://example.com/return'
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Missing required fields');
    });

    test('should generate reference if not provided', async () => {
        const response = await request(BASE_URL)
            .post('/api/create-payment')
            .send({
                description: 'Auto-generated reference test',
                amount: 500,
                buyer: {
                    name: 'Auto',
                    surname: 'Reference',
                    email: 'auto@test.com'
                },
                returnUrl: 'http://example.com/return'
            });

        expect(response.status).toBe(200);
        expect(response.body.reference).toMatch(/^ORDER-/);
        
        // Track for cleanup
        if (response.status === 200) {
            createdReferences.push(response.body.reference);
        }
    }, 15000);

    test('should reject reference longer than 32 characters', async () => {
        const response = await request(BASE_URL)
            .post('/api/create-payment')
            .send({
                reference: 'THIS-IS-A-VERY-LONG-REFERENCE-THAT-EXCEEDS-32-CHARS',
                amount: 1000,
                buyer: {
                    name: 'Test',
                    surname: 'Long',
                    email: 'long@test.com'
                },
                returnUrl: 'http://example.com/return'
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid reference');
    });

    test('should use provided returnUrl', async () => {
        const reference = `CUSTOM-URL-${Date.now()}`;
        createdReferences.push(reference);
        
        const response = await request(BASE_URL)
            .post('/api/create-payment')
            .send({
                reference,
                amount: 2000,
                buyer: {
                    name: 'Custom',
                    surname: 'URL',
                    email: 'custom@test.com'
                },
                returnUrl: 'http://example.com/custom'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        const savedPayment = await Payment.findOne({ reference });
        expect(savedPayment).toBeDefined();
        expect(savedPayment.amount).toBe(2000);
    }, 15000);
});
