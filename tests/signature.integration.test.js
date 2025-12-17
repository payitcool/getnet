const { validateGetnetSignature } = require('../utils/signature');

describe('Getnet Signature Integration Tests', () => {
    const TEST_SECRET_KEY = 'SnZP3D63n3I9dH9O'; // From README

    describe('Real-world scenarios', () => {
        test('should validate real Getnet notification with hardcoded signature', () => {
            // Real notification data from Getnet
            const requestId = 161340;
            const status = {
                status: 'APPROVED',
                message: 'Testing notification',
                reason: 'TT',
                date: '2025-12-09T14:32:41-05:00'
            };
            const realSignature = 'ab5886e4cc24d156f457cd83d70f343a420e3991';

            const result = validateGetnetSignature({
                requestId,
                status,
                signature: realSignature,
                secretKey: TEST_SECRET_KEY
            });

            // This should validate successfully with the real signature
            expect(result.isValid).toBe(true);
            expect(result.calculatedSignature).toBe(realSignature);
            expect(result.calculatedSignature.length).toBe(40); // SHA-1
        });

        test('should prevent SHA-256 regression - ensure SHA-1 is always used', () => {
            // This test ensures we never regress back to SHA-256
            const requestId = 8173340;
            const status = {
                status: 'REJECTED',
                date: '2025-12-17T05:16:10+00:00'
            };
            
            // Example signature from logs (40 chars = SHA-1)
            const realSignature = 'ebcee7bf32db2fadae189b35049674147c9d7103';

            const result = validateGetnetSignature({
                requestId,
                status,
                signature: realSignature,
                secretKey: TEST_SECRET_KEY
            });

            // The calculated signature must be 40 characters (SHA-1)
            expect(result.calculatedSignature.length).toBe(40);
            
            // Should NOT be 64 characters (SHA-256)
            expect(result.calculatedSignature.length).not.toBe(64);
            
            // Signature format validation
            expect(result.calculatedSignature).toMatch(/^[a-f0-9]{40}$/);
        });

        test('should handle APPROVED status correctly', () => {
            const requestId = 12345;
            const status = {
                status: 'APPROVED',
                date: '2025-12-17T10:00:00+00:00'
            };
            
            const result = validateGetnetSignature({
                requestId,
                status,
                signature: 'test_signature',
                secretKey: TEST_SECRET_KEY
            });

            expect(result.calculatedSignature).toBeDefined();
            expect(result.calculatedSignature.length).toBe(40);
        });

        test('should handle PENDING status correctly', () => {
            const requestId = 54321;
            const status = {
                status: 'PENDING',
                date: '2025-12-17T11:00:00+00:00'
            };
            
            const result = validateGetnetSignature({
                requestId,
                status,
                signature: 'dummy_signature',
                secretKey: TEST_SECRET_KEY
            });

            expect(result.calculatedSignature).toBeDefined();
            expect(result.calculatedSignature.length).toBe(40);
        });

        test('should maintain consistent hashing for same inputs', () => {
            const requestId = 99999;
            const status = {
                status: 'APPROVED',
                date: '2025-12-17T12:00:00+00:00'
            };
            
            const result1 = validateGetnetSignature({
                requestId,
                status,
                signature: 'test',
                secretKey: TEST_SECRET_KEY
            });

            const result2 = validateGetnetSignature({
                requestId,
                status,
                signature: 'test',
                secretKey: TEST_SECRET_KEY
            });

            // Same inputs should produce same hash
            expect(result1.calculatedSignature).toBe(result2.calculatedSignature);
        });

        test('should produce different hashes for different dates', () => {
            const requestId = 88888;
            const status1 = {
                status: 'APPROVED',
                date: '2025-12-17T10:00:00+00:00'
            };
            const status2 = {
                status: 'APPROVED',
                date: '2025-12-17T10:00:01+00:00' // 1 second difference
            };
            
            const result1 = validateGetnetSignature({
                requestId,
                status: status1,
                signature: 'test',
                secretKey: TEST_SECRET_KEY
            });

            const result2 = validateGetnetSignature({
                requestId,
                status: status2,
                signature: 'test',
                secretKey: TEST_SECRET_KEY
            });

            // Different dates should produce different hashes
            expect(result1.calculatedSignature).not.toBe(result2.calculatedSignature);
        });
    });
});
