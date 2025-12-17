const { validateGetnetSignature } = require('../utils/signature');
const CryptoJS = require('crypto-js');

describe('Getnet Signature Validation', () => {
    const SECRET_KEY = 'test_secret_key_123';

    describe('validateGetnetSignature', () => {
        test('should validate correct SHA-1 signature', () => {
            const requestId = 8173340;
            const status = {
                status: 'REJECTED',
                date: '2025-12-17T05:16:10+00:00'
            };
            
            // Generate valid signature using SHA-1
            const validSignature = CryptoJS.SHA1(
                `${requestId}${status.status}${status.date}${SECRET_KEY}`
            ).toString();

            const result = validateGetnetSignature({
                requestId,
                status,
                signature: validSignature,
                secretKey: SECRET_KEY
            });

            expect(result.isValid).toBe(true);
            expect(result.calculatedSignature).toBe(validSignature);
            expect(result.providedSignature).toBe(validSignature);
        });

        test('should reject incorrect signature', () => {
            const requestId = 8173340;
            const status = {
                status: 'REJECTED',
                date: '2025-12-17T05:16:10+00:00'
            };
            const wrongSignature = 'incorrect_signature_hash';

            const result = validateGetnetSignature({
                requestId,
                status,
                signature: wrongSignature,
                secretKey: SECRET_KEY
            });

            expect(result.isValid).toBe(false);
            expect(result.calculatedSignature).not.toBe(wrongSignature);
            expect(result.providedSignature).toBe(wrongSignature);
        });

        test('should use fallback date when status.date is not present', () => {
            const requestId = 12345;
            const status = { status: 'APPROVED' };
            const fallbackDate = '2025-12-17T10:00:00+00:00';
            
            const expectedSignature = CryptoJS.SHA1(
                `${requestId}${status.status}${fallbackDate}${SECRET_KEY}`
            ).toString();

            const result = validateGetnetSignature({
                requestId,
                status,
                signature: expectedSignature,
                secretKey: SECRET_KEY,
                fallbackDate
            });

            expect(result.isValid).toBe(true);
        });

        test('should return error when missing required parameters', () => {
            const result = validateGetnetSignature({
                requestId: null,
                status: { status: 'APPROVED' },
                signature: 'some_signature',
                secretKey: SECRET_KEY
            });

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Missing required parameters');
            expect(result.calculatedSignature).toBeNull();
        });

        test('should handle empty status string', () => {
            const requestId = 12345;
            const status = {};
            const date = '2025-12-17T10:00:00+00:00';
            
            const expectedSignature = CryptoJS.SHA1(
                `${requestId}${date}${SECRET_KEY}`
            ).toString();

            const result = validateGetnetSignature({
                requestId,
                status,
                signature: expectedSignature,
                secretKey: SECRET_KEY,
                fallbackDate: date
            });

            expect(result.isValid).toBe(true);
        });

        test('should produce SHA-1 hash (40 characters) not SHA-256 (64 characters)', () => {
            const requestId = 8173340;
            const status = {
                status: 'REJECTED',
                date: '2025-12-17T05:16:10+00:00'
            };
            const signature = 'a'.repeat(40); // 40 character hash

            const result = validateGetnetSignature({
                requestId,
                status,
                signature,
                secretKey: SECRET_KEY
            });

            // Calculated signature should be 40 characters (SHA-1), not 64 (SHA-256)
            expect(result.calculatedSignature.length).toBe(40);
            expect(result.calculatedSignature.length).not.toBe(64);
        });

        test('should match the exact format used by Getnet', () => {
            // Real example from logs
            const requestId = 8173340;
            const status = {
                status: 'REJECTED',
                date: '2025-12-17T05:16:10+00:00'
            };

            const result = validateGetnetSignature({
                requestId,
                status,
                signature: 'test_signature',
                secretKey: SECRET_KEY
            });

            // Verify string format
            expect(result.stringUsed).toContain(String(requestId));
            expect(result.stringUsed).toContain(status.status);
            expect(result.stringUsed).toContain('[SECRET_KEY]');
            expect(result.stringUsed).not.toContain(SECRET_KEY); // Should be masked
        });
    });
});
