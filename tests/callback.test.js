const { generateCallbackSecret, CALLBACK_CONFIG } = require('../utils/callback');

describe('Callback Utils', () => {
    describe('generateCallbackSecret', () => {
        test('should generate SHA-1 hash (40 characters)', () => {
            const url = 'https://example.com/callback';
            const secret = 'my_secret';

            const hash = generateCallbackSecret(url, secret);

            expect(hash.length).toBe(40);
            expect(hash).toMatch(/^[a-f0-9]{40}$/);
        });

        test('should generate same hash for same inputs', () => {
            const url = 'https://example.com/callback';
            const secret = 'my_secret';

            const hash1 = generateCallbackSecret(url, secret);
            const hash2 = generateCallbackSecret(url, secret);

            expect(hash1).toBe(hash2);
        });

        test('should generate different hash for different URLs', () => {
            const url1 = 'https://example.com/callback1';
            const url2 = 'https://example.com/callback2';
            const secret = 'my_secret';

            const hash1 = generateCallbackSecret(url1, secret);
            const hash2 = generateCallbackSecret(url2, secret);

            expect(hash1).not.toBe(hash2);
        });

        test('should generate different hash for different secrets', () => {
            const url = 'https://example.com/callback';
            const secret1 = 'secret1';
            const secret2 = 'secret2';

            const hash1 = generateCallbackSecret(url, secret1);
            const hash2 = generateCallbackSecret(url, secret2);

            expect(hash1).not.toBe(hash2);
        });

        test('should handle empty secret', () => {
            const url = 'https://example.com/callback';
            const secret = '';

            const hash = generateCallbackSecret(url, secret);

            expect(hash.length).toBe(40);
            expect(hash).toMatch(/^[a-f0-9]{40}$/);
        });
    });

    describe('CALLBACK_CONFIG', () => {
        test('should have valid configuration', () => {
            expect(CALLBACK_CONFIG.TIMEOUT_MS).toBe(10000);
            expect(CALLBACK_CONFIG.VALID_STATUS_CODES).toEqual([200, 201]);
            expect(CALLBACK_CONFIG.RETRY_BASE_MINUTES).toBe(1);
            expect(CALLBACK_CONFIG.BATCH_SIZE).toBe(100);
        });
    });
});
