# 🔌 Integración desde un Proyecto Node.js

Guía para integrar tu aplicación Node.js con esta API de pagos Getnet.

## 📋 Requisitos Previos

- Node.js 18+ (incluye fetch nativo)
- Variable de entorno `SERVER_2_SERVER_SECRET` que coincida con la API

## 🚀 Flujo de Integración

```
Tu App → Esta API → Getnet → Usuario paga → Webhook → Esta API → Tu App (callback)
```

---

## 1️⃣ Crear un Pago

### Request

```javascript
const response = await fetch('https://payments.sitholding.com/api/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        amount: 15000,
        currency: 'CLP',
        description: 'Suscripción mensual',
        reference: 'ORDER-' + Date.now(),
        buyer: {
            email: 'juan@ejemplo.com',
            name: 'Juan'  // Opcional
        },
        returnUrl: 'https://tu-app.com/resultado-pago',
        externalURLCallback: 'https://tu-app.com/api/webhook/pago'
    })
});

const data = await response.json();
console.log(data);
// {
//   success: true,
//   requestId: "161789",
//   reference: "ORDER-1733850000000",
//   processUrl: "https://checkout.getnet.cl/session/xxx/yyy"
// }
```

### Parámetros

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `amount` | number | ✅ | Monto en pesos (sin decimales) |
| `buyer.email` | string | ✅ | Email del cliente (obligatorio) |
| `returnUrl` | string | ✅ | URL donde será redirigido el usuario después del pago |
| `currency` | string | ❌ | Moneda (default: CLP) |
| `description` | string | ❌ | Descripción del cobro |
| `reference` | string | ❌ | Tu referencia interna (auto-generada si no se envía) |
| `buyer.name` | string | ❌ | Nombre del cliente (default: "Cliente") |
| `externalURLCallback` | string | ❌ | URL donde recibirás la notificación de pago exitoso |

---

## 2️⃣ Redirigir al Usuario

Con el `processUrl` obtenido, redirige al usuario:

```javascript
// En tu frontend
window.location.href = data.processUrl;
```

---

## 3️⃣ Recibir Callback de Cambios de Estado

Cuando el pago **cambie de estado** (PENDING, APPROVED, REJECTED, FAILED, EXPIRED, etc.), tu `externalURLCallback` recibirá un POST:

### Request que recibirás

```http
POST https://tu-app.com/api/webhook/pago
Content-Type: application/json

{
    "secretHash": "a1b2c3d4e5...",
    "requestId": "161789",
    "reference": "ORDER-1733850000000",
    "status": "APPROVED",  // Puede ser: PENDING, APPROVED, REJECTED, FAILED, EXPIRED, etc.
    "amount": 15000,
    "currency": "CLP",
    "buyer": {
        "name": "Juan",
        "email": "juan@ejemplo.com"
    },
    "timestamp": "2025-12-10T19:30:00.000Z",
    "isRetry": false,
    "attemptNumber": 1
}
```

**💡 Importante:** Recibirás notificaciones para **TODOS** los cambios de estado, incluyendo:
- `PENDING` - Pago en proceso
- `APPROVED` - ✅ Pago exitoso
- `REJECTED` - ❌ Pago rechazado
- `FAILED` - ❌ Pago fallido
- `EXPIRED` - ⏰ Sesión expirada

### Tu endpoint debe:

```javascript
const crypto = require('crypto');

app.post('/api/webhook/pago', async (req, res) => {
    const { secretHash, requestId, reference, status, amount } = req.body;
    
    // 1. Verificar el secretHash
    const expectedHash = crypto
        .createHash('sha1')
        .update(process.env.SERVER_2_SERVER_SECRET + 'https://tu-app.com/api/webhook/pago')
        .digest('hex');
    
    if (secretHash !== expectedHash) {
        console.error('❌ Secret hash inválido');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 2. Procesar según el estado
    console.log(`🔔 Pago ${requestId} - Estado: ${status}`);
    
    switch(status) {
        case 'PENDING':
            // Pago en proceso - registrar inicio
            console.log('Pago iniciado, esperando confirmación');
            break;
            
        case 'APPROVED':
            // ✅ Pago exitoso - activar servicios
            console.log(`✅ Pago aprobado: $${amount}`);
            // Activar suscripción, enviar email, etc.
            break;
            
        case 'REJECTED':
        case 'FAILED':
            // ❌ Pago fallido - notificar al usuario
            console.log(`❌ Pago rechazado/fallido`);
            break;
            
        case 'EXPIRED':
            // ⏰ Sesión expirada - limpiar recursos
            console.log(`⏰ Sesión de pago expirada`);
            break;
    }
    
    // 3. Responder 200 OK (importante!)
    res.status(200).json({ received: true });
});
```

> ⚠️ **IMPORTANTE**: Debes responder `200` o `201`. Cualquier otro código causa reintentos automáticos.

---

## 4️⃣ Sistema de Reintentos

Si tu callback falla:

- **Reintento 1**: en 2 minutos
- **Reintento 2**: en 3 minutos
- **Reintento N**: en N+1 minutos
- **Sin límite**: reintentos infinitos hasta que respondas 200

El cron corre cada minuto y procesa hasta 100 callbacks pendientes por ejecución.

---

## 5️⃣ Consultar Estado de un Pago

### Por requestId

```javascript
const response = await fetch('https://payments.sitholding.com/api/payment-status/161789');
const data = await response.json();

console.log(data);
// {
//   requestId: "161789",
//   status: "APPROVED",
//   amount: 15000,
//   ...
// }
```

### Por reference

```javascript
const response = await fetch('https://payments.sitholding.com/api/payment-by-reference/ORDER-1733850000000');
const data = await response.json();
```

---

## 🔐 Seguridad

### Verificar secretHash

El `secretHash` es único por URL de callback:

```javascript
secretHash = sha1(SERVER_2_SERVER_SECRET + callbackUrl)
```

Esto significa:
- Cada cliente tiene un hash diferente basado en su URL
- Si alguien conoce el secret de otro cliente, no puede usarlo con su URL
- Debes verificar el hash en cada request

### Variables de Entorno

En tu proyecto:

```env
SERVER_2_SERVER_SECRET=tu_secret_compartido_con_la_api
```

---

## 📊 Estados de Pago

| Estado | Descripción |
|--------|-------------|
| `CREATED` | Sesión creada, usuario no ha pagado |
| `PENDING` | Pago en proceso de validación |
| `APPROVED` | ✅ Pago exitoso |
| `REJECTED` | ❌ Pago rechazado |
| `FAILED` | ❌ Error en el proceso |
| `EXPIRED` | ⏰ Sesión expirada |

---

## 🧪 Testing

### Tarjetas de Prueba

Consulta el PDF `GETNET_-_MANUAL_COMPLETO.pdf` en la carpeta `docs/` para las tarjetas de prueba oficiales.

### Ejemplo Completo

```javascript
async function crearPago() {
    try {
        const response = await fetch('https://payments.sitholding.com/api/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: 5000,
                buyer: {
                    email: 'test@example.com',
                    name: 'Test User'
                },
                returnUrl: 'https://tu-app.com/resultado',
                externalURLCallback: 'https://tu-app.com/webhook'
            })
        });
        
        const data = await response.json();
        
        console.log('Pago creado:', data.requestId);
        console.log('URL de checkout:', data.processUrl);
        
        return data;
    } catch (error) {
        console.error('Error:', error.message);
    }
}

crearPago();
```

---

## 📚 Documentación Adicional

- **Swagger UI**: `https://payments.sitholding.com/docs`
- **Manual Getnet**: `docs/GETNET_-_MANUAL_COMPLETO.pdf`
