const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Getnet Chile API - Integración de Pagos',
            version: '1.0.0',
            description: 'API completa para integración con Getnet Chile (PlaceToPay). Incluye webhooks, verificación de estados y reconciliación automática.',
            contact: {
                name: 'API Support',
                email: 'support@payments.sitholding.com'
            },
        },
        servers: [
            {
                url: 'https://payments.sitholding.com',
                description: 'Servidor de Producción'
            },
            {
                url: 'http://localhost:3000',
                description: 'Servidor de Desarrollo'
            }
        ],
        tags: [
            {
                name: 'Health',
                description: 'Endpoints de monitoreo y health check'
            },
            {
                name: 'Payments',
                description: 'Operaciones relacionadas con pagos'
            },
            {
                name: 'Webhooks',
                description: 'Endpoints para recibir notificaciones de Getnet'
            },
            {
                name: 'Reconciliation',
                description: 'Endpoints para reconciliación y verificación de estados'
            }
        ],
        components: {
            schemas: {
                Payment: {
                    type: 'object',
                    properties: {
                        requestId: {
                            type: 'string',
                            description: 'ID único de la transacción en Getnet',
                            example: 'abc123xyz456'
                        },
                        reference: {
                            type: 'string',
                            description: 'Referencia interna del pedido',
                            example: 'ORDER-1702069200000'
                        },
                        amount: {
                            type: 'number',
                            description: 'Monto del pago',
                            example: 5000
                        },
                        currency: {
                            type: 'string',
                            description: 'Moneda del pago',
                            example: 'CLP'
                        },
                        status: {
                            type: 'string',
                            enum: ['CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK'],
                            description: 'Estado actual del pago'
                        },
                        buyer: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                email: { type: 'string' },
                                document: { type: 'string' }
                            }
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Fecha de creación'
                        },
                        lastStatusUpdate: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Última actualización de estado'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Mensaje de error'
                        },
                        message: {
                            type: 'string',
                            description: 'Descripción detallada del error'
                        }
                    }
                }
            }
        }
    },
    apis: ['./index.js', './routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
