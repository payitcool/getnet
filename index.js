require('dotenv').config();
const express = require('express');
const CryptoJS = require('crypto-js');
const moment = require('moment');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const connectDB = require('./config/database');
const Payment = require('./models/Payment');
const AllLog = require('./models/AllLog');
const RetryCallback = require('./models/RetryCallback');
const { validateGetnetSignature } = require('./utils/signature');
const { generateAuth } = require('./utils/auth');
const { logToDB } = require('./utils/logger');
const { CALLBACK_CONFIG } = require('./utils/callback');
const { executeExternalCallback, retryCallback, notifyPaymentStatusChange } = require('./services/paymentCallback');

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Enable CORS for all origins
app.use(cors());

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

// Callback configuration imported from utils/callback.js

// Callback functions imported from services/paymentCallback.js







app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

// ========================================
// HEALTH CHECK: Para Docker y Kubernetes
// ========================================
/**
 * @swagger
 * /healthz:
 *   get:
 *     summary: Health check del servicio
 *     description: |
 *       Verifica que el servicio esté funcionando correctamente.
 *       Realiza una consulta a MongoDB con timeout de 2 segundos.
 *       
 *       **Uso en Docker:**
 *       ```dockerfile
 *       HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
 *         CMD curl -f http://localhost:3000/healthz || exit 1
 *       ```
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servicio saludable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Tiempo en segundos desde que inició el servidor
 *                 mongodb:
 *                   type: string
 *                   example: "connected"
 *                 responseTime:
 *                   type: string
 *                   example: "15ms"
 *       503:
 *         description: Servicio no saludable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 error:
 *                   type: string
 *                 mongodb:
 *                   type: string
 *                   example: "disconnected"
 */
app.get('/healthz', async (req, res) => {
    const startTime = Date.now();
    const TIMEOUT_MS = 2000;

    try {
        // Crear una promesa con timeout
        const dbCheck = Payment.findOne({}).limit(1).lean().exec();
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database query timeout (>2s)')), TIMEOUT_MS);
        });

        // Race: quien termine primero
        await Promise.race([dbCheck, timeoutPromise]);

        const responseTime = Date.now() - startTime;

        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            mongodb: 'connected',
            responseTime: `${responseTime}ms`
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;

        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            mongodb: 'disconnected',
            error: error.message,
            responseTime: `${responseTime}ms`
        });
    }
});

// Authentication function imported from utils/auth.js
function getnetAuth() {
    return generateAuth(LOGIN, SECRET_KEY);
}

// Query Getnet API for payment status
async function queryPaymentStatus(requestId) {
    try {
        const auth = getnetAuth();
        const response = await fetch(`${GETNET_URL}/api/session/${requestId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth })
        });
        
        const data = await response.json();
        
        await logToDB('STATUS_QUERY', {
            requestId,
            endpoint: `/api/session/${requestId}`,
            method: 'POST',
            statusCode: response.status,
            response: data
        });

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        return data;
    } catch (error) {
        await logToDB('ERROR', {
            requestId,
            endpoint: `/api/session/${requestId}`,
            method: 'POST',
            error: error.message
        });
        throw error;
    }
}

/**
 * @swagger
 * /api/create-payment:
 *   post:
 *     summary: Crear nueva sesión de pago
 *     description: Crea una nueva sesión de pago en Getnet y redirige al usuario al checkout. Guarda el requestId en la base de datos.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - buyer
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Monto del pago en CLP
 *                 example: 5000
 *               currency:
 *                 type: string
 *                 description: Moneda del pago (por defecto CLP)
 *                 default: CLP
 *                 example: CLP
 *               description:
 *                 type: string
 *                 description: Descripción del pago
 *                 example: Compra en tienda online
 *               reference:
 *                 type: string
 *                 description: Referencia única del pedido (si no se envía, se genera automáticamente)
 *                 example: ORDER-12345
 *               buyer:
 *                 type: object
 *                 required:
 *                   - name
 *                   - email
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Nombre del comprador
 *                     example: Juan
 *                   surname:
 *                     type: string
 *                     description: Apellido del comprador
 *                     example: Pérez
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: Email del comprador
 *                     example: juan@ejemplo.com
 *                   mobile:
 *                     type: string
 *                     description: Teléfono móvil del comprador
 *                     example: "+56912345678"
 *               returnUrl:
 *                 type: string
 *                 description: URL de retorno personalizada (opcional)
 *                 example: https://mitienda.com/resultado
 *               externalURLCallback:
 *                 type: string
 *                 format: uri
 *                 description: |
 *                   URL externa que será llamada (POST) cuando el pago sea exitoso (APPROVED).
 *                   Se envíará un JSON con los datos del pago. Si falla, se reintentará automáticamente.
 *                 example: https://tu-app.com/webhook/pago-exitoso
 *               redirect:
 *                 type: boolean
 *                 description: Si es true, redirige al checkout. Si es false, devuelve JSON con la URL.
 *                 default: true
 *                 example: false
 *     responses:
 *       200:
 *         description: Sesión de pago creada (cuando redirect=false)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 requestId:
 *                   type: string
 *                   example: "abc123xyz456"
 *                 reference:
 *                   type: string
 *                   example: "ORDER-1702069200000"
 *                 processUrl:
 *                   type: string
 *                   example: "https://checkout.getnet.cl/session/abc123xyz456"
 *       302:
 *         description: Redirección al checkout de Getnet (cuando redirect=true o no se especifica)
 *       400:
 *         description: Parámetros faltantes o inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required fields"
 *                 required:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["amount", "buyer.name", "buyer.email"]
 *       500:
 *         description: Error al crear la sesión de pago
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/create-payment', async (req, res) => {
    try {
        // Validar campos requeridos
        const { amount, buyer, description, reference: customReference, currency, returnUrl: customReturnUrl, externalURLCallback } = req.body;
        
        // Validación: amount, buyer.email y returnUrl son obligatorios
        const missingFields = [];
        if (!amount) missingFields.push('amount');
        if (!buyer || !buyer.email) missingFields.push('buyer.email');
        if (!customReturnUrl) missingFields.push('returnUrl');
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: missingFields
            });
        }

        const auth = getnetAuth();
        let reference = customReference || 'ORDER-' + Date.now();
        
        // Validar que reference tenga máximo 32 caracteres (requisito de Getnet)
        if (reference.length > 32) {
            return res.status(400).json({
                error: 'Invalid reference',
                message: 'Reference must be between 1 and 32 characters',
                provided: reference.length
            });
        }
        
        const paymentCurrency = currency || 'CLP';
        const paymentDescription = description || `Pago de ${paymentCurrency} $${amount}`;
        const expMinutes = 10; // Fijo en 10 minutos - no modificable por el cliente
        
        // Payment request with notificationUrl
        const paymentData = {
            auth: auth,
            locale: 'es_CL',
            buyer: {
                name: buyer.name || 'Cliente',
                surname: buyer.surname || '',
                email: buyer.email,
                mobile: buyer.mobile || ''
            },
            payment: {
                reference: reference,
                description: paymentDescription,
                amount: {
                    currency: paymentCurrency,
                    total: amount
                }
            },
            expiration: moment().add(expMinutes, 'minutes').toISOString(),
            returnUrl: customReturnUrl,
            notificationUrl: `${DOMAIN}/api/notification`,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Unknown'
        };

        console.log('📤 Sending request to Getnet:', JSON.stringify(paymentData, null, 2));

        const response = await fetch(`${GETNET_URL}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });
        
        const responseData = await response.json();

        console.log('📥 Getnet Response:', responseData);

        if (!response.ok) {
            throw new Error(responseData.status?.message || `Getnet error: ${response.status}`);
        }

        // Guardar en base de datos
        await Payment.create({
            requestId: responseData.requestId,
            reference,
            amount,
            currency: paymentCurrency,
            status: 'CREATED',
            buyer,
            externalURLCallback,
            processUrl: responseData.processUrl,
            createdAt: new Date()
        });

        await logToDB('SUCCESS', {
            endpoint: '/api/create-payment',
            method: 'POST',
            requestId: responseData.requestId,
            reference,
            ip: req.ip
        });

        // RESPONDER AL CLIENTE
        return res.json({
            success: true,
            requestId: responseData.requestId,
            processUrl: responseData.processUrl,
            reference,
            expiresAt: paymentData.expiration
        });

    } catch (error) {
        console.error('❌ Error connecting to Getnet:', error.response ? error.response.data : error.message);
        
        await logToDB('ERROR', {
            endpoint: '/api/create-payment',
            method: 'POST',
            error: error.message,
            response: error.response?.data,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(500).json({ 
            error: 'Error connecting to Getnet', 
            message: error.response ? error.response.data : error.message 
        });
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
 *     description: |
 *       Endpoint público que recibe notificaciones automáticas cuando el estado de un pago cambia.
 *       Getnet envía POST a esta URL cuando hay actualizaciones.
 *       
 *       **Importante:** Este endpoint debe ser accesible públicamente desde internet para que Getnet pueda enviar las notificaciones.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: ID único de la transacción en Getnet
 *                 example: "abc123xyz456"
 *               reference:
 *                 type: string
 *                 description: Referencia del pedido enviada en la creación
 *                 example: "ORDER-1702069200000"
 *               signature:
 *                 type: string
 *                 description: Firma SHA-256 para validar autenticidad (SHA-256(requestId + status + date + secretKey))
 *                 example: "a1b2c3d4e5f6..."
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha de la notificación
 *                 example: "2024-12-10T15:30:00Z"
 *               status:
 *                 type: object
 *                 description: Objeto con el estado del pago
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [PENDING, APPROVED, REJECTED, FAILED, EXPIRED]
 *                     description: Estado actual del pago
 *                     example: "APPROVED"
 *                   reason:
 *                     type: string
 *                     description: Razón del estado (código)
 *                     example: "00"
 *                   message:
 *                     type: string
 *                     description: Mensaje descriptivo del estado
 *                     example: "Transacción aprobada"
 *                   date:
 *                     type: string
 *                     format: date-time
 *                     description: Fecha del cambio de estado
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notification received"
 *       400:
 *         description: requestId faltante
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing requestId"
 *       401:
 *         description: Firma inválida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid signature"
 *       404:
 *         description: Pago no encontrado en la base de datos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Payment not found"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/notification', async (req, res) => {
    try {
        console.log('🔔 Notification received from Getnet:', JSON.stringify(req.body, null, 2));

        const { requestId, reference, signature, status } = req.body;

        if (!requestId) {
            return res.status(400).json({ error: 'Missing requestId' });
        }

        // Validar signature según el manual de Getnet
        if (signature) {
            const validationResult = validateGetnetSignature({
                requestId,
                status,
                signature,
                secretKey: SECRET_KEY,
                fallbackDate: req.body.date
            });
            
            if (!validationResult.isValid) {
                console.warn('⚠️  Invalid signature in notification');
                console.log('   Provided:', validationResult.providedSignature);
                console.log('   Calculated:', validationResult.calculatedSignature);
                console.log('   String used:', validationResult.stringUsed);
                await logToDB('NOTIFICATION_INVALID_SIGNATURE', {
                    requestId,
                    reference,
                    providedSignature: validationResult.providedSignature,
                    calculatedSignature: validationResult.calculatedSignature,
                    stringUsed: validationResult.stringUsed,
                    error: validationResult.error,
                    endpoint: '/api/notification',
                    method: 'POST',
                    request: req.body,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });
                return res.status(401).json({ error: 'Invalid signature' });
            }
            console.log('✅ Signature validated successfully');
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

        // Notificar cambio de estado si hubo cambio
        if (payment.status !== oldStatus) {
            await notifyPaymentStatusChange(requestId, oldStatus, payment.status, process.env.SERVER_2_SERVER_SECRET || '');
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
 *     description: |
 *       Consulta el estado actual de un pago en Getnet API y actualiza la base de datos con la información más reciente.
 *       
 *       **Uso recomendado:**
 *       - Después de que el usuario regrese del checkout para confirmar el estado
 *       - Para verificar pagos que quedaron en estado PENDING
 *       - Para debugging y soporte al cliente
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transacción (requestId de Getnet)
 *         example: "abc123xyz456"
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
 *                   example: true
 *                 requestId:
 *                   type: string
 *                   example: "abc123xyz456"
 *                 reference:
 *                   type: string
 *                   example: "ORDER-1702069200000"
 *                 status:
 *                   type: string
 *                   enum: [CREATED, PENDING, APPROVED, REJECTED, FAILED, EXPIRED]
 *                   example: "APPROVED"
 *                 amount:
 *                   type: number
 *                   example: 5000
 *                 currency:
 *                   type: string
 *                   example: "CLP"
 *                 lastUpdate:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-12-10T15:30:00.000Z"
 *                 getnetData:
 *                   type: object
 *                   description: Respuesta completa de Getnet API
 *       404:
 *         description: Pago no encontrado en la base de datos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Payment not found"
 *                 requestId:
 *                   type: string
 *                   example: "abc123xyz456"
 *       500:
 *         description: Error al consultar el estado en Getnet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error querying payment status"
 *                 message:
 *                   type: string
 *                   example: "Request failed with status code 401"
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
// RETURN URL: User returns from Getnet checkout (Static HTML)
// ========================================
app.get('/response', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/response.html'));
});

// ========================================
// API: Get payment by reference
// ========================================
/**
 * @swagger
 * /api/payment-by-reference/{reference}:
 *   get:
 *     summary: Buscar pago por referencia
 *     description: Busca un pago en la base de datos usando la referencia del pedido y actualiza su estado consultando a Getnet.
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Referencia del pedido (ej. ORDER-1702069200000)
 *     responses:
 *       200:
 *         description: Pago encontrado
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
 *       404:
 *         description: Pago no encontrado
 */
app.get('/api/payment-by-reference/:reference', async (req, res) => {
    try {
        const { reference } = req.params;
        
        const payment = await Payment.findOne({ reference });
        
        if (!payment) {
            return res.status(404).json({
                error: 'Payment not found',
                reference
            });
        }

        // Intentar actualizar el estado desde Getnet
        try {
            const getnetStatus = await queryPaymentStatus(payment.requestId);
            
            if (getnetStatus.status && getnetStatus.status.status) {
                const oldStatus = payment.status;
                const newStatus = getnetStatus.status.status;
                payment.status = newStatus;
                payment.lastStatusUpdate = new Date();
                payment.getnetResponse = getnetStatus;
                await payment.save();

                // Notificar cambio de estado si hubo cambio
                if (newStatus !== oldStatus) {
                    await notifyPaymentStatusChange(payment.requestId, oldStatus, newStatus, process.env.SERVER_2_SERVER_SECRET || '');
                }
            }
        } catch (error) {
            console.error('Error querying Getnet status:', error.message);
        }

        res.json({
            success: true,
            requestId: payment.requestId,
            reference: payment.reference,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            lastUpdate: payment.lastStatusUpdate
        });

    } catch (error) {
        console.error('❌ Error getting payment by reference:', error.message);
        res.status(500).json({
            error: 'Error getting payment',
            message: error.message
        });
    }
});

// ========================================
// ENDPOINT CRON: Reconciliación inteligente de pagos + Reintentos de callbacks
// ========================================
/**
 * @swagger
 * /api/cron:
 *   get:
 *     summary: Reconciliación automática y reintentos de callbacks
 *     description: |
 *       Ejecuta dos tareas importantes:
 *       
 *       **1. Reconciliación de pagos:** Revisa todos los pagos PENDING o CREATED de los últimos N días 
 *       y actualiza su estado consultando a Getnet. Si un pago cambia a APPROVED, ejecuta el callback externo.
 *       
 *       **2. Reintentos de callbacks:** Reintenta todos los callbacks externos que fallaron previamente.
 *       Máximo 5 intentos por callback.
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Número de días hacia atrás para revisar pagos (máximo 30)
 *       - in: query
 *         name: skipReconciliation
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Si es true, solo ejecuta reintentos de callbacks
 *       - in: query
 *         name: skipCallbacks
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Si es true, solo ejecuta reconciliación de pagos
 *     responses:
 *       200:
 *         description: Cron ejecutado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 reconciliation:
 *                   type: object
 *                   properties:
 *                     paymentsChecked:
 *                       type: integer
 *                     paymentsUpdated:
 *                       type: integer
 *                     updates:
 *                       type: array
 *                       items:
 *                         type: object
 *                 callbacks:
 *                   type: object
 *                   properties:
 *                     callbacksChecked:
 *                       type: integer
 *                     callbacksSucceeded:
 *                       type: integer
 *                     callbacksFailed:
 *                       type: integer
 *                     callbacksMaxRetries:
 *                       type: integer
 *       500:
 *         description: Error en el cron
 */
app.get('/api/cron', async (req, res) => {
    const cronStartTime = Date.now();
    const results = {
        success: true,
        reconciliation: null,
        callbacks: null
    };

    try {
        const daysBack = Math.min(parseInt(req.query.days) || 7, 30);
        const skipReconciliation = req.query.skipReconciliation === 'true';
        const skipCallbacks = req.query.skipCallbacks === 'true';
        
        console.log(`🔄 [CRON] Starting cron job...`);

        // ========================================
        // PARTE 1: Reconciliación de pagos
        // ========================================
        if (!skipReconciliation) {
            const cutoffDate = moment().subtract(daysBack, 'days').toDate();
            
            console.log(`📊 [CRON] Reconciliation for last ${daysBack} days...`);

            const paymentsToCheck = await Payment.find({
                status: { $in: ['CREATED', 'PENDING'] },
                createdAt: { $gte: cutoffDate }
            }).sort({ createdAt: -1 });

            console.log(`📊 Found ${paymentsToCheck.length} payments to check`);

            const updates = [];
            let updatedCount = 0;

            for (const payment of paymentsToCheck) {
                try {
                    const getnetStatus = await queryPaymentStatus(payment.requestId);
                    
                    const newStatus = getnetStatus.status?.status;
                    const oldStatus = payment.status;

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

                        // Notificar el cambio de estado
                        await notifyPaymentStatusChange(payment.requestId, oldStatus, newStatus, process.env.SERVER_2_SERVER_SECRET || '');
                    }

                    await new Promise(resolve => setTimeout(resolve, 200));

                } catch (error) {
                    console.error(`❌ Error checking ${payment.requestId}:`, error.message);
                    await logToDB('CRON_ERROR', {
                        requestId: payment.requestId,
                        task: 'reconciliation',
                        error: error.message
                    });
                }
            }

            results.reconciliation = {
                daysBack,
                paymentsChecked: paymentsToCheck.length,
                paymentsUpdated: updatedCount,
                updates
            };

            await logToDB('CRON_RECONCILIATION', {
                ...results.reconciliation,
                timestamp: new Date()
            });
        }

        // ========================================
        // PARTE 2: Reintentos de callbacks fallidos
        // ========================================
        if (!skipCallbacks) {
            console.log(`🔄 [CRON] Processing failed callbacks...`);

            const now = new Date();
            
            // Query: callbacks PENDING cuyo nextRetryAt ya pasó
            // Ordenados por nextRetryAt (más urgentes primero)
            // Límite de 100 por ejecución del cron
            const pendingCallbacks = await RetryCallback.find({
                status: 'PENDING',
                nextRetryAt: { $lte: now }
            })
            .sort({ nextRetryAt: 1 })
            .limit(CALLBACK_CONFIG.BATCH_SIZE);

            console.log(`📊 Found ${pendingCallbacks.length} callbacks ready to retry (limit: ${CALLBACK_CONFIG.BATCH_SIZE})`);

            let succeeded = 0;
            let failed = 0;

            for (const callback of pendingCallbacks) {
                const result = await retryCallback(callback, process.env.SERVER_2_SERVER_SECRET || '');
                
                if (result.success) {
                    succeeded++;
                } else {
                    failed++;
                }

                // Pausa entre callbacks para no saturar
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            results.callbacks = {
                callbacksChecked: pendingCallbacks.length,
                callbacksSucceeded: succeeded,
                callbacksFailed: failed
            };

            await logToDB('CRON_CALLBACKS', {
                ...results.callbacks,
                timestamp: new Date()
            });
        }

        const duration = Date.now() - cronStartTime;
        
        console.log(`✅ [CRON] Completed in ${duration}ms`);

        await logToDB('CRON_COMPLETED', {
            duration,
            ...results,
            timestamp: new Date()
        });

        res.json({
            ...results,
            duration: `${duration}ms`
        });

    } catch (error) {
        console.error('❌ Error in cron:', error.message);
        
        await logToDB('CRON_ERROR', {
            error: error.message,
            message: 'Cron job failed',
            timestamp: new Date()
        });

        res.status(500).json({ 
            success: false,
            error: 'Cron job failed',
            message: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
