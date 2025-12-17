const { generateAuth } = require('../utils/auth');

describe('Auth Utils', () => {
    describe('generateAuth', () => {
        test('should generate valid auth object', () => {
            const login = 'test_login';
            const secretKey = 'test_secret_key';

            const auth = generateAuth(login, secretKey);

            expect(auth).toHaveProperty('login');
            expect(auth).toHaveProperty('tranKey');
            expect(auth).toHaveProperty('nonce');
            expect(auth).toHaveProperty('seed');
            expect(auth.login).toBe(login);
        });

        test('should generate different nonce each time', () => {
            const login = 'test_login';
            const secretKey = 'test_secret_key';

            const auth1 = generateAuth(login, secretKey);
            const auth2 = generateAuth(login, secretKey);

            expect(auth1.nonce).not.toBe(auth2.nonce);
            expect(auth1.tranKey).not.toBe(auth2.tranKey);
        });

        test('should generate base64 encoded nonce', () => {
            const auth = generateAuth('login', 'secret');
            
            // Base64 regex pattern
            const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
            expect(auth.nonce).toMatch(base64Pattern);
        });

        test('should generate base64 encoded tranKey', () => {
            const auth = generateAuth('login', 'secret');
            
            // Base64 regex pattern
            const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
            expect(auth.tranKey).toMatch(base64Pattern);
        });

        test('should generate ISO date for seed', () => {
            const auth = generateAuth('login', 'secret');
            
            // Check if seed is a valid ISO date
            const date = new Date(auth.seed);
            expect(date.toISOString()).toBe(auth.seed);
        });
    });
});
