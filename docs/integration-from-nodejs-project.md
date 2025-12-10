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
            name: 'Juan',
            email: 'juan@ejemplo.com'
        },
        externalURLCallback: 'https://tu-app.com/api/webhook/pago',
        redirect: false  // Para recibir JSON en vez de redirección
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
| `currency` | string | ❌ | Moneda (default: CLP) |
| `description` | string | ❌ | Descripción del cobro |
| `reference` | string | ❌ | Tu referencia interna (auto-generada si no se envía) |
| `buyer.name` | string | ✅ | Nombre del cliente |
| `buyer.email` | string | ✅ | Email del cliente |
| `externalURLCallback` | string | ❌ | URL donde recibirás la notificación de pago exitoso |
| `redirect` | boolean | ❌ | `false` para recibir JSON, `true` para redirigir al checkout |
| `expirationMinutes` | number | ❌ | Minutos hasta expirar (default: 10) |

---

## 2️⃣ Redirigir al Usuario

Con el `processUrl` obtenido, redirige al usuario:

```javascript
// En tu frontend
window.location.href = data.processUrl;
```

---

## 3️⃣ Recibir Callback de Pago Exitoso

Cuando el pago sea **APPROVED**, tu `externalURLCallback` recibirá un POST:

### Request que recibirás

```http
POST https://tu-app.com/api/webhook/pago
Content-Type: application/json

{
    "secretHash": "a1b2c3d4e5...",
    "requestId": "161789",
    "reference": "ORDER-1733850000000",
    "status": "APPROVED",
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
    
    // 2. Procesar el pago
    console.log(`✅ Pago ${requestId} confirmado: $${amount}`);
    
    // Tu lógica de negocio aquí:
    // - Activar suscripción
    // - Enviar email de confirmación
    // - Actualizar inventario
    
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
                    name: 'Test User',
                    email: 'test@example.com'
                },
                externalURLCallback: 'https://tu-app.com/webhook',
                redirect: false
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
