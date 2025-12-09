# Getnet Chile Web Checkout Integration - PRODUCCIÓN READY ✅

Integración completa con Getnet Chile (PlaceToPay) incluyendo:
- ✅ Verificación de estado de pagos
- ✅ Webhooks/Notificaciones automáticas
- ✅ Almacenamiento en MongoDB
- ✅ Logging completo de todas las operaciones
- ✅ API de consulta de estados
- ✅ **Swagger UI Documentation** en `/docs`
- ✅ **Reconciliación automática** con `/api/cron`
- ✅ **Función paymentSuccessful()** para lógica de negocio
- ✅ **Manejo de contracargos** (REFUNDED, CHARGEBACK)

## 📋 Características Implementadas

### 🔐 Autenticación
- Sistema de autenticación PlaceToPay con nonce, seed y tranKey
- Configuración por ambiente (TEST/PRODUCTION)

### 💾 Base de Datos MongoDB
- **Colección `payments`**: Almacena todos los pagos con su estado
- **Colección `all_logs`**: Registra todas las operaciones y errores
- Índices optimizados para búsquedas rápidas

### 🎯 Endpoints Implementados

#### 1. `POST /create-payment`
Crea una nueva sesión de pago en Getnet y redirige al checkout.
- Guarda el `requestId` en MongoDB
- Configura `notificationUrl` para recibir webhooks
- Configura `returnUrl` para el retorno del usuario

#### 2. `POST /api/notification`
Webhook para recibir notificaciones automáticas de Getnet.
- Actualiza el estado del pago en tiempo real
- Registra todas las notificaciones recibidas
- Responde con ACK automático (200 OK)

#### 3. `GET /api/payment-status/:requestId`
API para consultar el estado actual de un pago.
- Consulta a Getnet la información actualizada
- Actualiza la base de datos con el último estado
- Retorna JSON con toda la información del pago

#### 4. `GET /response`
Página de retorno cuando el usuario completa/cancela el pago.
- Verifica el estado REAL del pago con Getnet
- Muestra resultado visual según el estado:
  - ✅ **APPROVED**: Pago exitoso
  - ❌ **REJECTED/FAILED**: Pago rechazado
  - ⏳ **PENDING**: Pago pendiente de aprobación

#### 5. `GET /api/cron` 🆕
Endpoint de reconciliación inteligente de pagos.
- Revisa pagos de los últimos 7 días (configurable con `?days=X`)
- Solo verifica estados que pueden cambiar (CREATED, PENDING, APPROVED)
- No revisa transacciones antiguas (máximo 30 días)
- Actualiza automáticamente si detecta cambios
- Ejecuta `paymentSuccessful()` cuando un pago es confirmado

#### 6. `GET /docs` 🆕
Documentación interactiva Swagger UI.
- Todos los endpoints documentados
- Esquemas de request/response
- Pruebas en vivo desde el navegador

### 🔄 Flujo de Pago Completo

```
1. Usuario hace clic en "Pagar"
   ↓
2. POST /create-payment
   - Crea sesión en Getnet
   - Guarda requestId en MongoDB
   - Redirige a checkout de Getnet
   ↓
3. Usuario paga en Getnet
   ↓
4a. Getnet envía webhook → POST /api/notification
    - Actualiza estado en DB automáticamente
   
4b. Usuario regresa → GET /response
    - Consulta estado real en Getnet
    - Muestra resultado correcto
```

## 🚀 Instalación y Configuración

### Prerequisites
- Node.js v14+
- MongoDB (local o Atlas)
- Cuenta Getnet Chile

### 1. Instalación
```bash
npm install
```

### 2. Configuración de Variables de Entorno
Copia `.env.example` a `.env` y configura:

```env
# Domain (tu dominio público)
DOMAIN=https://getnet.cloud.app

# MongoDB
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/getnet

# Getnet Configuration
ENV=TEST  # o PRODUCTION

# Test Credentials
TEST_LOGIN=7ffbb7bf1f7361b1200b2e8d74e1d76f
TEST_SECRET_KEY=SnZP3D63n3I9dH9O
TEST_URL=https://checkout.test.getnet.cl

# Production Credentials (obtener de Getnet Portal)
PRODUCTION_LOGIN=tu_login_produccion
PRODUCTION_SECRET_KEY=tu_secret_key_produccion
PRODUCTION_URL=https://checkout.getnet.cl
```

### 3. Ejecutar
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📡 URLs Importantes

- **Frontend**: `https://getnet.cloud.app/`
- **Swagger Docs**: `https://getnet.cloud.app/docs` 🆕
- **Webhook**: `https://getnet.cloud.app/api/notification`
- **API Status**: `https://getnet.cloud.app/api/payment-status/:requestId`
- **CRON**: `https://getnet.cloud.app/api/cron` 🆕
- **Return URL**: `https://getnet.cloud.app/response`

## 🔍 Monitoreo y Logs

Todos los eventos se registran en MongoDB:

```javascript
// Ver logs de un pago específico
db.all_logs.find({ requestId: "123456" }).sort({ timestamp: -1 })

// Ver todas las notificaciones recibidas
db.all_logs.find({ type: "NOTIFICATION_RECEIVED" }).sort({ timestamp: -1 })

// Ver errores
db.all_logs.find({ type: "ERROR" }).sort({ timestamp: -1 })
```

## ❓ Preguntas Frecuentes

### ¿Cuándo sé si el pago se realizó?

**3 formas de saberlo:**

1. **Webhook automático** → Getnet envía POST a `/api/notification` cuando cambia el estado
2. **Return URL** → Cuando el usuario regresa, se consulta el estado en `/response`
3. **API manual** → Consultar en cualquier momento con `/api/payment-status/:requestId`

### ¿Existe ACK para el pago?

**NO** como en otros sistemas. Getnet funciona así:
- Getnet envía webhook → Tu servidor responde 200 OK (ACK automático)
- **NO hay timeout** para responder como en otros sistemas
- **NO se hacen reversas** por falta de ACK

### ¿Se pueden hacer reversas automáticas?

Las reversas en Getnet ocurren solo si:
- Hay problemas en la transacción bancaria
- El pago expira (por timeout de sesión)
- **NO** por falta de ACK del webhook

### ¿Qué estados puede tener un pago?

- `CREATED`: Sesión creada, esperando pago
- `PENDING`: Pago en proceso
- `APPROVED`: ✅ Pago aprobado y exitoso
- `REJECTED`: ❌ Pago rechazado por el banco
- `FAILED`: ❌ Pago falló por error técnico
- `EXPIRED`: ⌛ Sesión expiró sin completar
- `REFUNDED`: 🔄 Reembolsado (NUEVO) 🆕
- `CHARGEBACK`: ⚠️ Contracargo por desconocimiento (NUEVO) 🆕

### ¿Cómo manejar contracargos y reembolsos tardíos? 🆕

**Problema:** Usuario paga → se aprueba → días después desconoce la compra

**Solución:** Usa `/api/cron` para reconciliación periódica:

```bash
# Configurar en crontab (Linux/Mac)
# Ejecutar cada 6 horas:
0 */6 * * * curl https://getnet.cloud.app/api/cron

# Ejecutar diariamente a las 3 AM:
0 3 * * * curl https://getnet.cloud.app/api/cron
```

El CRON:
- Revisa pagos de los últimos 7 días
- Detecta cambios de estado (APPROVED → CHARGEBACK)
- Actualiza automáticamente la base de datos
- Ejecuta lógica de negocio si es necesario

### ¿Cómo ejecutar lógica cuando un pago es exitoso? 🆕

**Función `paymentSuccessful(transactionId)`** se ejecuta automáticamente cuando:
- Llega webhook con estado APPROVED
- Usuario regresa y se verifica APPROVED
- CRON detecta cambio a APPROVED

**Ejemplo:**
```javascript
async function paymentSuccessful(transactionId) {
    const payment = await Payment.findOne({ requestId: transactionId });
    
    // Tu lógica aquí:
    await sendConfirmationEmail(payment.buyer.email);
    await activateService(payment);
    await updateInventory(payment);
}
```

Ver `EJEMPLOS_PAYMENT_SUCCESSFUL.js` para más ejemplos.

## 📚 Documentación Oficial

**[GETNET - MANUAL COMPLETO (PDF)](https://banco.santander.cl/uploads/000/033/227/ce392ca6-ad03-43ca-b354-99c45a5c5a1b/original/GETNET_-_MANUAL_COMPLETO.pdf)**

## ✅ Problemas Resueltos

- ✅ **Guardas el requestId** → En MongoDB (colección `payments`)
- ✅ **Verificas el estado** → En `/response` y `/api/payment-status/:requestId`
- ✅ **Tienes webhook** → `/api/notification` recibe notificaciones automáticas
- ✅ **No marcas como pagado algo rechazado** → Verificación real con Getnet API

## 🛠️ Tecnologías

- Express.js
- MongoDB + Mongoose
- Axios
- CryptoJS
- Moment.js
- dotenv

## 📚 Documentación

Toda la documentación del proyecto está organizada en la carpeta [`docs/`](docs/):

- 🛠️ **[Guías de Implementación](docs/guides/)** - Guías rápidas y tutoriales
- 💳 **[Ejemplos de Pagos](docs/payments/)** - Código de ejemplo para pagos
- 🧪 **[Testing](docs/testing/)** - Tarjetas de prueba para sandbox
- 🔄 **[Workflows](docs/workflows/)** - CI/CD y automatización

**Documentos destacados**:
- [📖 Guía Rápida](docs/guides/quick-start.md)
- [💳 Tarjetas de Prueba](docs/testing/test-cards.md)
- [🎯 Resumen de Implementación](docs/guides/implementation.md)

---

**Desarrollado para producción** 🚀
