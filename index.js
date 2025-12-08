require('dotenv').config();
const express = require('express');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const moment = require('moment');
const bodyParser = require('body-parser');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const connectDB = require('./config/database');
const Payment = require('./models/Payment');
const AllLog = require('./models/AllLog');

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Swagger Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Getnet API Docs'
}));

// Configuration from .env
const ENV = process.env.ENV || 'TEST';
const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';

const CONFIG = {
    TEST: {
        LOGIN: process.env.TEST_LOGIN,
        SECRET_KEY: process.env.TEST_SECRET_KEY,
        URL: process.env.TEST_URL
    },
    PRODUCTION: {
        LOGIN: process.env.PRODUCTION_LOGIN,
        SECRET_KEY: process.env.PRODUCTION_SECRET_KEY,
        URL: process.env.PRODUCTION_URL
    }
};

const CURRENT_CONFIG = CONFIG[ENV];

const LOGIN = CURRENT_CONFIG.LOGIN;
const SECRET_KEY = CURRENT_CONFIG.SECRET_KEY;
const GETNET_URL = CURRENT_CONFIG.URL; 

console.log(`🚀 Running in ${ENV} mode against ${GETNET_URL}`);
console.log(`🌐 Domain: ${DOMAIN}`);
console.log(`📚 API Docs: ${DOMAIN}/docs`);

// ========================================
// FUNCIÓN PRINCIPAL: Ejecutar lógica cuando el pago es exitoso
// ========================================
/**
 * Esta función se ejecuta UNA VEZ cuando un pago es confirmado como APPROVED.
 * Aquí puedes agregar tu lógica de negocio:
 * - Enviar email de confirmación
 * - Activar servicio/producto
 * - Actualizar inventario
 * - Generar factura
 * - Notificar a otros sistemas
 * 
 * @param {string} transactionId - El requestId de Getnet (obtenido en la creación del pago)
 */
async function paymentSuccessful(transactionId) {
    console.log(`✅ [PAYMENT SUCCESSFUL] Transaction ID: ${transactionId}`);
    
    // TODO: Implementar tu lógica de negocio aquí
    // Ejemplo:
    // await sendConfirmationEmail(transactionId);
    // await activateService(transactionId);
    // await updateInventory(transactionId);
    
    // Por ahora solo registra en logs
    await logToDB('INFO', {
        message: 'Payment successful - Business logic executed',
        requestId: transactionId,
        timestamp: new Date()
    });
}

// Helper function to log to database
async function logToDB(type, data) {
    try {
        await AllLog.create({
            type,
            ...data,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error logging to DB:', error.message);
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

function getnetAuth() {
    // Generate a random string for nonce
    const nonceString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const seed = moment().toISOString();
    
    // tranKey = Base64(SHA-256(Nonce + Seed + SecretKey))
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

// Query Getnet API for payment status
async function queryPaymentStatus(requestId) {
    try {
        const auth = getnetAuth();
        const response = await axios.post(`${GETNET_URL}/api/session/${requestId}`, { auth });
        
        await logToDB('STATUS_QUERY', {
            requestId,
            endpoint: `/api/session/${requestId}`,
            method: 'POST',
            statusCode: response.status,
            response: response.data
        });

        return response.data;
    } catch (error) {
        await logToDB('ERROR', {
            requestId,
            endpoint: `/api/session/${requestId}`,
            method: 'POST',
            error: error.message,
            response: error.response?.data
        });
        throw error;
    }
}

/**
 * @swagger
 * /create-payment:
 *   post:
 *     summary: Crear nueva sesión de pago
 *     description: Crea una nueva sesión de pago en Getnet y redirige al usuario al checkout. Guarda el requestId en la base de datos.
 *     tags: [Payments]
 *     responses:
 *       302:
 *         description: Redirección al checkout de Getnet
 *       500:
 *         description: Error al crear la sesión de pago
 */
app.post('/create-payment', async (req, res) => {
    try {
        const auth = getnetAuth();
        const reference = 'ORDER-' + Date.now();
        
        // Payment request with notificationUrl
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
                reference: reference,
                description: 'Pago de prueba 5000 CLP',
                amount: {
                    currency: 'CLP',
                    total: 5000
                }
            },
            expiration: moment().add(10, 'minutes').toISOString(),
            returnUrl: `${DOMAIN}/response`,
            notificationUrl: `${DOMAIN}/api/notification`,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Unknown'
        };

        console.log('📤 Sending request to Getnet:', JSON.stringify(paymentData, null, 2));

        const response = await axios.post(`${GETNET_URL}/api/session`, paymentData);

        console.log('📥 Getnet Response:', response.data);

        if (response.data && response.data.requestId) {
            // Save to MongoDB
            const payment = await Payment.create({
                requestId: response.data.requestId,
                reference: reference,
                amount: 5000,
                currency: 'CLP',
                status: 'CREATED',
                buyer: paymentData.buyer,
                processUrl: response.data.processUrl,
                getnetResponse: response.data,
                lastStatusUpdate: new Date()
            });

            await logToDB('PAYMENT_CREATED', {
                requestId: response.data.requestId,
                endpoint: '/api/session',
                method: 'POST',
                statusCode: response.status,
                request: paymentData,
                response: response.data,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            console.log('✅ Payment saved to DB:', payment._id);

            if (response.data.processUrl) {
                res.redirect(response.data.processUrl);
            } else {
                res.status(500).send('Error: No processUrl in response');
            }
        } else {
            res.status(500).send('Error creating payment session: ' + JSON.stringify(response.data));
        }

    } catch (error) {
        console.error('❌ Error connecting to Getnet:', error.response ? error.response.data : error.message);
        
        await logToDB('ERROR', {
            endpoint: '/create-payment',
            method: 'POST',
            error: error.message,
            response: error.response?.data,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(500).send('Error connecting to Getnet: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
    }
});

// ========================================
// WEBHOOK: Receive notifications from Getnet
// ========================================
/**
 * @swagger
 * /api/notification:
 *   post:
 *     summary: Webhook para recibir notificaciones de Getnet
 *     description: Endpoint público que recibe notificaciones automáticas cuando el estado de un pago cambia. Getnet envía POST a esta URL cuando hay actualizaciones.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: ID de la transacción
 *               status:
 *                 type: object
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [PENDING, APPROVED, REJECTED, FAILED]
 *     responses:
 *       200:
 *         description: Notificación recibida y procesada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Pago no encontrado
 *       400:
 *         description: requestId faltante
 */
app.post('/api/notification', async (req, res) => {
    try {
        console.log('🔔 Notification received from Getnet:', JSON.stringify(req.body, null, 2));

        const { requestId, status } = req.body;

        if (!requestId) {
            return res.status(400).json({ error: 'Missing requestId' });
        }

        // Find payment in database
        const payment = await Payment.findOne({ requestId });

        if (!payment) {
            console.log('⚠️  Payment not found for requestId:', requestId);
            await logToDB('NOTIFICATION_RECEIVED', {
                requestId,
                endpoint: '/api/notification',
                method: 'POST',
                request: req.body,
                message: 'Payment not found',
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Update payment with notification data
        payment.notifications.push({
            receivedAt: new Date(),
            data: req.body
        });

        // Update status if provided
        const oldStatus = payment.status;
        if (status && status.status) {
            payment.status = status.status;
            payment.lastStatusUpdate = new Date();
        }

        await payment.save();

        await logToDB('NOTIFICATION_RECEIVED', {
            requestId,
            endpoint: '/api/notification',
            method: 'POST',
            request: req.body,
            message: `Payment updated with notification. Status: ${payment.status}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        console.log(`✅ Notification processed for ${requestId}. Status: ${payment.status}`);

        // Si el pago cambió a APPROVED, ejecutar lógica de negocio
        if (payment.status === 'APPROVED' && oldStatus !== 'APPROVED') {
            await paymentSuccessful(requestId);
        }

        // Respond with 200 OK to acknowledge receipt
        res.status(200).json({ success: true, message: 'Notification received' });

    } catch (error) {
        console.error('❌ Error processing notification:', error.message);
        
        await logToDB('ERROR', {
            endpoint: '/api/notification',
            method: 'POST',
            error: error.message,
            request: req.body,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// API: Query payment status from Getnet
// ========================================
/**
 * @swagger
 * /api/payment-status/{requestId}:
 *   get:
 *     summary: Consultar estado de un pago
 *     description: Consulta el estado actual de un pago en Getnet API y actualiza la base de datos con la información más reciente.
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transacción (requestId de Getnet)
 *     responses:
 *       200:
 *         description: Estado del pago obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 requestId:
 *                   type: string
 *                 reference:
 *                   type: string
 *                 status:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 currency:
 *                   type: string
 *                 lastUpdate:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Pago no encontrado
 *       500:
 *         description: Error al consultar el estado
 */
app.get('/api/payment-status/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        // First, check our database
        const payment = await Payment.findOne({ requestId });

        if (!payment) {
            return res.status(404).json({ 
                error: 'Payment not found',
                requestId 
            });
        }

        // Query Getnet for current status
        const getnetStatus = await queryPaymentStatus(requestId);

        // Update our database with latest status
        if (getnetStatus.status && getnetStatus.status.status) {
            payment.status = getnetStatus.status.status;
            payment.lastStatusUpdate = new Date();
            payment.getnetResponse = getnetStatus;
            await payment.save();
        }

        console.log(`📊 Status query for ${requestId}: ${payment.status}`);

        res.json({
            success: true,
            requestId: payment.requestId,
            reference: payment.reference,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            lastUpdate: payment.lastStatusUpdate,
            getnetData: getnetStatus
        });

    } catch (error) {
        console.error('❌ Error querying payment status:', error.message);
        
        res.status(500).json({ 
            error: 'Error querying payment status',
            message: error.message 
        });
    }
});

// ========================================
// RETURN URL: User returns from Getnet checkout
// ========================================
/**
 * @swagger
 * /response:
 *   get:
 *     summary: Página de retorno después del pago
 *     description: URL a la que regresa el usuario después de completar o cancelar el pago en Getnet. Verifica el estado real del pago antes de mostrar el resultado.
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: requestId
 *         schema:
 *           type: string
 *         description: ID de la transacción (enviado por Getnet)
 *     responses:
 *       200:
 *         description: Página HTML con el resultado del pago
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
app.get('/response', async (req, res) => {
    try {
        // Getnet usually sends requestId as query parameter
        const requestId = req.query.requestId || req.query.id;

        if (!requestId) {
            return res.send(`
                <html>
                <head>
                    <title>Error - Getnet</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>❌ Error</h1>
                        <p>No se encontró el identificador de pago.</p>
                        <a href="/">Volver al inicio</a>
                    </div>
                </body>
                </html>
            `);
        }

        console.log(`🔄 User returned from Getnet. RequestId: ${requestId}`);

        // Query current payment status from Getnet
        let payment = await Payment.findOne({ requestId });
        
        if (payment) {
            try {
                const getnetStatus = await queryPaymentStatus(requestId);
                
                if (getnetStatus.status && getnetStatus.status.status) {
                    const oldStatus = payment.status;
                    payment.status = getnetStatus.status.status;
                    payment.lastStatusUpdate = new Date();
                    payment.getnetResponse = getnetStatus;
                    await payment.save();

                    // Si el pago cambió a APPROVED, ejecutar lógica de negocio
                    if (payment.status === 'APPROVED' && oldStatus !== 'APPROVED') {
                        await paymentSuccessful(requestId);
                    }
                }
            } catch (error) {
                console.error('Error querying Getnet status:', error.message);
            }
        }

        // Generate response based on status
        const status = payment?.status || 'UNKNOWN';
        let html = '';

        if (status === 'APPROVED') {
            html = `
                <html>
                <head>
                    <title>Pago Exitoso - Getnet</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .success { background: #d4edda; color: #155724; padding: 20px; border-radius: 5px; }
                        .info { background: #f8f9fa; padding: 15px; margin-top: 20px; border-radius: 5px; }
                        table { width: 100%; margin-top: 15px; }
                        td { padding: 5px; }
                        .label { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="success">
                        <h1>✅ Pago Exitoso</h1>
                        <p>Tu pago ha sido procesado correctamente.</p>
                    </div>
                    <div class="info">
                        <h3>Detalles del Pago</h3>
                        <table>
                            <tr><td class="label">Referencia:</td><td>${payment.reference}</td></tr>
                            <tr><td class="label">Monto:</td><td>${payment.currency} $${payment.amount.toLocaleString()}</td></tr>
                            <tr><td class="label">Estado:</td><td>${payment.status}</td></tr>
                            <tr><td class="label">Request ID:</td><td>${payment.requestId}</td></tr>
                        </table>
                    </div>
                    <br>
                    <a href="/">← Volver al inicio</a>
                </body>
                </html>
            `;
        } else if (status === 'REJECTED' || status === 'FAILED') {
            html = `
                <html>
                <head>
                    <title>Pago Rechazado - Getnet</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
                        .info { background: #f8f9fa; padding: 15px; margin-top: 20px; border-radius: 5px; }
                        table { width: 100%; margin-top: 15px; }
                        td { padding: 5px; }
                        .label { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>❌ Pago Rechazado</h1>
                        <p>Tu pago no pudo ser procesado.</p>
                    </div>
                    <div class="info">
                        <h3>Detalles</h3>
                        <table>
                            <tr><td class="label">Referencia:</td><td>${payment?.reference || 'N/A'}</td></tr>
                            <tr><td class="label">Estado:</td><td>${status}</td></tr>
                            <tr><td class="label">Request ID:</td><td>${requestId}</td></tr>
                        </table>
                    </div>
                    <br>
                    <a href="/">← Intentar nuevamente</a>
                </body>
                </html>
            `;
        } else {
            // PENDING, EXPIRED, or UNKNOWN
            html = `
                <html>
                <head>
                    <title>Pago Pendiente - Getnet</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .warning { background: #fff3cd; color: #856404; padding: 20px; border-radius: 5px; }
                        .info { background: #f8f9fa; padding: 15px; margin-top: 20px; border-radius: 5px; }
                        table { width: 100%; margin-top: 15px; }
                        td { padding: 5px; }
                        .label { font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="warning">
                        <h1>⏳ Pago Pendiente</h1>
                        <p>Tu pago está siendo procesado. Te notificaremos cuando se complete.</p>
                    </div>
                    <div class="info">
                        <h3>Detalles</h3>
                        <table>
                            <tr><td class="label">Referencia:</td><td>${payment?.reference || 'N/A'}</td></tr>
                            <tr><td class="label">Estado:</td><td>${status}</td></tr>
                            <tr><td class="label">Request ID:</td><td>${requestId}</td></tr>
                        </table>
                        <p style="margin-top: 15px;">
                            <a href="/api/payment-status/${requestId}" target="_blank">Ver estado actualizado (JSON)</a>
                        </p>
                    </div>
                    <br>
                    <a href="/">← Volver al inicio</a>
                </body>
                </html>
            `;
        }

        res.send(html);

    } catch (error) {
        console.error('❌ Error in /response:', error.message);
        res.status(500).send(`
            <html>
            <head><title>Error</title></head>
            <body>
                <h1>Error procesando respuesta</h1>
                <p>${error.message}</p>
                <a href="/">Volver</a>
            </body>
            </html>
        `);
    }
});

// ========================================
// ENDPOINT CRON: Reconciliación inteligente de pagos
// ========================================
/**
 * @swagger
 * /api/cron:
 *   get:
 *     summary: Reconciliación automática de pagos pendientes
 *     description: Revisa todos los pagos PENDING, CREATED o APPROVED de los últimos 7 días y actualiza su estado consultando a Getnet. Es inteligente y solo revisa transacciones recientes.
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Número de días hacia atrás para revisar (máximo 30)
 *     responses:
 *       200:
 *         description: Reconciliación completada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 paymentsChecked:
 *                   type: integer
 *                 paymentsUpdated:
 *                   type: integer
 *                 updates:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Error en la reconciliación
 */
app.get('/api/cron', async (req, res) => {
    try {
        const daysBack = Math.min(parseInt(req.query.days) || 7, 30); // Máximo 30 días
        const cutoffDate = moment().subtract(daysBack, 'days').toDate();
        
        console.log(`🔄 [CRON] Starting reconciliation for last ${daysBack} days...`);

        // Buscar solo pagos que podrían necesitar actualización
        // Estados que valen la pena revisar: CREATED, PENDING, APPROVED
        const paymentsToCheck = await Payment.find({
            status: { $in: ['CREATED', 'PENDING', 'APPROVED'] },
            createdAt: { $gte: cutoffDate }
        }).sort({ createdAt: -1 });

        console.log(`📊 Found ${paymentsToCheck.length} payments to check`);

        const updates = [];
        let updatedCount = 0;

        for (const payment of paymentsToCheck) {
            try {
                // Consultar estado actual en Getnet
                const getnetStatus = await queryPaymentStatus(payment.requestId);
                
                const newStatus = getnetStatus.status?.status;
                const oldStatus = payment.status;

                // Solo actualizar si el estado cambió
                if (newStatus && newStatus !== oldStatus) {
                    payment.status = newStatus;
                    payment.lastStatusUpdate = new Date();
                    payment.getnetResponse = getnetStatus;
                    await payment.save();

                    updatedCount++;
                    updates.push({
                        requestId: payment.requestId,
                        reference: payment.reference,
                        oldStatus,
                        newStatus,
                        updatedAt: new Date()
                    });

                    console.log(`✅ Updated ${payment.requestId}: ${oldStatus} → ${newStatus}`);

                    // Si el pago cambió a APPROVED, ejecutar lógica de negocio
                    if (newStatus === 'APPROVED' && oldStatus !== 'APPROVED') {
                        await paymentSuccessful(payment.requestId);
                    }
                }

                // Pequeña pausa para no saturar la API de Getnet
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`❌ Error checking ${payment.requestId}:`, error.message);
                await logToDB('ERROR', {
                    requestId: payment.requestId,
                    endpoint: '/api/cron',
                    error: error.message,
                    message: 'Error during reconciliation'
                });
            }
        }

        const result = {
            success: true,
            message: `Reconciliation completed for last ${daysBack} days`,
            paymentsChecked: paymentsToCheck.length,
            paymentsUpdated: updatedCount,
            updates: updates
        };

        console.log(`✅ [CRON] Reconciliation completed: ${updatedCount}/${paymentsToCheck.length} updated`);

        await logToDB('INFO', {
            endpoint: '/api/cron',
            message: 'Reconciliation completed',
            ...result
        });

        res.json(result);

    } catch (error) {
        console.error('❌ Error in reconciliation:', error.message);
        
        await logToDB('ERROR', {
            endpoint: '/api/cron',
            error: error.message,
            message: 'Reconciliation failed'
        });

        res.status(500).json({ 
            success: false,
            error: 'Reconciliation failed',
            message: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
