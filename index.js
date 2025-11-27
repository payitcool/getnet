const express = require('express');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const moment = require('moment');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Public Test Credentials for Getnet Chile
const LOGIN = '7ffbb7bf1f7361b1200b2e8d74e1d76f';
const SECRET_KEY = 'SnZP3D63n3I9dH9O';
const GETNET_URL = 'https://checkout.test.getnet.cl'; 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

function getnetAuth() {
    // Generate a random string for nonce
    const nonceString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const seed = moment().toISOString();
    
    // tranKey = Base64(SHA-256(Nonce + Seed + SecretKey))
    // Note: We use the raw nonce string for the hash
    const rawTranKey = nonceString + seed + SECRET_KEY;
    const tranKey = CryptoJS.SHA256(rawTranKey).toString(CryptoJS.enc.Base64);

    // The nonce sent in the request must be Base64 encoded
    const nonceBase64 = Buffer.from(nonceString).toString('base64');

    return {
        login: LOGIN,
        tranKey: tranKey,
        nonce: nonceBase64,
        seed: seed
    };
}

app.post('/create-payment', async (req, res) => {
    try {
        const auth = getnetAuth();
        
        // Basic payment request structure for Web Checkout
        // Note: The exact JSON structure depends on the specific Getnet API version (Place to Pay based).
        // Common structure for PlaceToPay (which Getnet uses):
        const paymentData = {
            auth: auth,
            locale: 'es_CL',
            buyer: {
                name: 'Hugo',
                surname: 'User',
                email: 'test@example.com',
                document: '11111111-1',
                documentType: 'RUT',
                mobile: '+56912345678'
            },
            payment: {
                reference: 'ORDER-' + Date.now(),
                description: 'Pago de prueba 5000 CLP',
                amount: {
                    currency: 'CLP',
                    total: 5000
                }
            },
            expiration: moment().add(10, 'minutes').toISOString(),
            returnUrl: 'http://localhost:3000/response',
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        };

        console.log('Sending request to Getnet:', JSON.stringify(paymentData, null, 2));

        // The endpoint for creating a session in PlaceToPay/Getnet is usually /api/session
        const response = await axios.post(`${GETNET_URL}/api/session`, paymentData);

        console.log('Getnet Response:', response.data);

        if (response.data && response.data.processUrl) {
            res.redirect(response.data.processUrl);
        } else {
            res.status(500).send('Error creating payment session: ' + JSON.stringify(response.data));
        }

    } catch (error) {
        console.error('Error connecting to Getnet:', error.response ? error.response.data : error.message);
        res.status(500).send('Error connecting to Getnet: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
    }
});

app.get('/response', (req, res) => {
    res.send('<h1>Pago finalizado (o cancelado)</h1><p>Revisa la consola para ver el estado.</p><a href="/">Volver</a>');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
