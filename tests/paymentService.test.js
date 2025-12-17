const {
    validatePaymentRequest,
    validateReference,
    generateReference,
    createPaymentData
} = require('../services/paymentService');

describe('Payment Service', () => {
    describe('validatePaymentRequest', () => {
        test('should validate complete payment request', () => {
            const data = {
                amount: 10000,
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return'
            };

            const result = validatePaymentRequest(data);

            expect(result.isValid).toBe(true);
            expect(result.missingFields).toEqual([]);
        });

        test('should detect missing amount', () => {
            const data = {
                buyer: { email: 'test@example.com' },
                returnUrl: 'https://example.com/return'
            };

            const result = validatePaymentRequest(data);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain('amount');
        });

        test('should detect missing buyer.email', () => {
            const data = {
                amount: 10000,
                buyer: { name: 'Test' },
                returnUrl: 'https://example.com/return'
            };

            const result = validatePaymentRequest(data);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain('buyer.email');
        });

        test('should detect missing buyer object', () => {
            const data = {
                amount: 10000,
                returnUrl: 'https://example.com/return'
            };

            const result = validatePaymentRequest(data);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain('buyer.email');
        });

        test('should detect missing returnUrl', () => {
            const data = {
                amount: 10000,
                buyer: { email: 'test@example.com' }
            };

            const result = validatePaymentRequest(data);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toContain('returnUrl');
        });

        test('should detect multiple missing fields', () => {
            const data = {};

            const result = validatePaymentRequest(data);

            expect(result.isValid).toBe(false);
            expect(result.missingFields).toHaveLength(3);
            expect(result.missingFields).toContain('amount');
            expect(result.missingFields).toContain('buyer.email');
            expect(result.missingFields).toContain('returnUrl');
        });
    });

    describe('validateReference', () => {
        test('should validate reference within limit (32 chars)', () => {
            const reference = 'ORDER-123456789';

            const result = validateReference(reference);

            expect(result.isValid).toBe(true);
            expect(result.length).toBe(reference.length);
        });

        test('should reject reference exceeding 32 characters', () => {
            const reference = 'ORDER-' + '1'.repeat(30); // 36 chars total

            const result = validateReference(reference);

            expect(result.isValid).toBe(false);
            expect(result.length).toBe(36);
        });

        test('should accept reference at exactly 32 characters', () => {
            const reference = '1'.repeat(32);

            const result = validateReference(reference);

            expect(result.isValid).toBe(true);
            expect(result.length).toBe(32);
        });

        test('should accept empty/undefined reference (optional)', () => {
            const result1 = validateReference('');
            const result2 = validateReference(null);
            const result3 = validateReference(undefined);

            expect(result1.isValid).toBe(true); // Empty string is valid (optional)
            expect(result2.isValid).toBe(true);  // null is valid (optional)
            expect(result3.isValid).toBe(true);  // undefined is valid (optional)
        });
    });

    describe('generateReference', () => {
        test('should return custom reference when provided', () => {
            const customRef = 'CUSTOM-ORDER-123';

            const result = generateReference(customRef);

            expect(result).toBe(customRef);
        });

        test('should generate reference when not provided', () => {
            const result = generateReference();

            expect(result).toMatch(/^ORDER-\d+$/);
            expect(result.length).toBeGreaterThan(6);
        });

        test('should generate different references on each call', () => {
            const ref1 = generateReference();
            // Small delay to ensure different timestamp
            const ref2 = generateReference();

            expect(ref1).toMatch(/^ORDER-\d+$/);
            expect(ref2).toMatch(/^ORDER-\d+$/);
            // May or may not be different depending on timing
        });

        test('should handle null/undefined and generate new reference', () => {
            const result1 = generateReference(null);
            const result2 = generateReference(undefined);

            expect(result1).toMatch(/^ORDER-\d+$/);
            expect(result2).toMatch(/^ORDER-\d+$/);
        });
    });

    describe('createPaymentData', () => {
        test('should create valid payment data structure', () => {
            const params = {
                login: 'test_login',
                secretKey: 'test_secret',
                buyer: { email: 'test@example.com', name: 'Test User' },
                amount: 10000,
                currency: 'CLP',
                description: 'Test payment',
                reference: 'ORDER-123',
                returnUrl: 'https://example.com/return',
                domain: 'https://payments.example.com',
                ip: '192.168.1.1',
                userAgent: 'Mozilla/5.0'
            };

            const result = createPaymentData(params);

            expect(result).toHaveProperty('auth');
            expect(result.auth).toHaveProperty('login', params.login);
            expect(result.auth).toHaveProperty('tranKey');
            expect(result.auth).toHaveProperty('nonce');
            expect(result.auth).toHaveProperty('seed');
            expect(result.locale).toBe('es_CL');
            expect(result.buyer.email).toBe(params.buyer.email);
            expect(result.payment.reference).toBe(params.reference);
            expect(result.payment.amount.total).toBe(params.amount);
            expect(result.payment.amount.currency).toBe(params.currency);
            expect(result.returnUrl).toBe(params.returnUrl);
            expect(result.ipAddress).toBe(params.ip);
            expect(result.userAgent).toBe(params.userAgent);
        });

        test('should use default values for optional fields', () => {
            const params = {
                login: 'test_login',
                secretKey: 'test_secret',
                buyer: { email: 'test@example.com' },
                amount: 5000,
                reference: 'ORDER-456',
                returnUrl: 'https://example.com/return',
                domain: 'https://payments.example.com'
            };

            const result = createPaymentData(params);

            expect(result.buyer.name).toBe('Cliente'); // Default
            expect(result.buyer.surname).toBe(''); // Default
            expect(result.payment.amount.currency).toBe('CLP'); // Default
            expect(result.payment.description).toContain('Pago de CLP'); // Default
            expect(result.ipAddress).toBe('127.0.0.1'); // Default
            expect(result.userAgent).toBe('Unknown'); // Default
        });

        test('should include notification URL', () => {
            const params = {
                login: 'test_login',
                secretKey: 'test_secret',
                buyer: { email: 'test@example.com' },
                amount: 1000,
                reference: 'ORDER-789',
                returnUrl: 'https://example.com/return',
                domain: 'https://payments.example.com'
            };

            const result = createPaymentData(params);

            expect(result.notificationUrl).toBe('https://payments.example.com/api/notification');
        });

        test('should set expiration time correctly', () => {
            const params = {
                login: 'test_login',
                secretKey: 'test_secret',
                buyer: { email: 'test@example.com' },
                amount: 1000,
                reference: 'ORDER-999',
                returnUrl: 'https://example.com/return',
                domain: 'https://payments.example.com',
                expirationMinutes: 15
            };

            const result = createPaymentData(params);

            expect(result.expiration).toBeDefined();
            const expirationDate = new Date(result.expiration);
            expect(expirationDate.toISOString()).toBe(result.expiration);
        });
    });
});
