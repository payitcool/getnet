# 🚀 GUÍA RÁPIDA - Getnet API

## 📦 Instalación Rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar .env (ya está listo)
# - MongoDB URI configurado
# - Domain: https://getnet.cloud.app
# - Credenciales Getnet TEST

# 3. Iniciar servidor
npm start

# 4. Abrir documentación
http://localhost:3000/docs
```

## 🎯 3 Cosas Más Importantes

### 1. **Función `paymentSuccessful()`** - Línea ~52

```javascript
async function paymentSuccessful(transactionId) {
    // AQUÍ implementas tu lógica cuando un pago es exitoso:
    // - Enviar email
    // - Activar servicio
    // - Actualizar inventario
    // - Generar factura
}
```

### 2. **Endpoint `/api/cron`** - Reconciliación

```bash
# Ejecutar manualmente:
curl http://localhost:3000/api/cron

# Respuesta:
{
  "success": true,
  "paymentsChecked": 15,
  "paymentsUpdated": 3
}
```

### 3. **Swagger Docs en `/docs`**

```
http://localhost:3000/docs
```
- 📚 Toda la API documentada
- 🧪 Probar endpoints desde el navegador
- 📋 Copiar ejemplos de requests

## 🔄 Flujo de Pago Completo

```
1. Usuario → Click "Pagar"
   ↓
2. POST /create-payment
   → Getnet crea sesión
   → Guarda requestId en MongoDB ✅
   → Redirige a checkout
   ↓
3. Usuario paga en Getnet
   ↓
4. Getnet → POST /api/notification (webhook)
   → Actualiza estado a APPROVED ✅
   → Ejecuta paymentSuccessful() ✅
   ↓
5. Usuario regresa → GET /response
   → Consulta estado real en Getnet ✅
   → Muestra resultado correcto ✅
```

## 🛡️ Protección contra Contracargos

### Problema:
```
Día 1: Pago APPROVED ✅
Día 5: Usuario desconoce compra
Día 7: Estado cambia a CHARGEBACK ⚠️
```

### Solución:
```bash
# Configurar CRON (cada 6 horas):
0 */6 * * * curl https://getnet.cloud.app/api/cron
```

El CRON:
- Revisa pagos recientes (últimos 7 días)
- Detecta cambios de estado
- Actualiza automáticamente

## 📊 ¿Dónde está guardado qué?

### MongoDB - Base de datos `getnet`:

#### Colección `payments`:
```javascript
{
  requestId: "abc123",        // ID de Getnet ← LO MÁS IMPORTANTE
  reference: "ORDER-12345",    // Tu referencia interna
  amount: 5000,
  status: "APPROVED",          // Estado actual
  buyer: { email, name, ... },
  notifications: [ ... ],      // Todos los webhooks recibidos
  createdAt: Date
}
```

#### Colección `all_logs`:
```javascript
{
  type: "NOTIFICATION_RECEIVED", // o PAYMENT_CREATED, ERROR, etc.
  requestId: "abc123",
  request: { ... },              // Lo que llegó
  response: { ... },             // Lo que respondimos
  timestamp: Date
}
```

## 🔍 Consultas Útiles

### Ver todos los pagos:
```javascript
db.payments.find().sort({ createdAt: -1 })
```

### Ver pagos aprobados:
```javascript
db.payments.find({ status: "APPROVED" })
```

### Ver pagos con problemas:
```javascript
db.payments.find({ 
  status: { $in: ["REJECTED", "FAILED", "CHARGEBACK"] } 
})
```

### Ver logs de un pago específico:
```javascript
db.all_logs.find({ requestId: "abc123" }).sort({ timestamp: -1 })
```

### Ver cuándo se ejecutó paymentSuccessful:
```javascript
db.all_logs.find({ 
  message: "Payment successful - Business logic executed" 
})
```

## 🧪 Probar en Desarrollo

### 1. Crear pago:
```
http://localhost:3000
→ Click "Pagar $5.000"
→ Usa tarjeta de prueba de Getnet
```

### 2. Ver estado:
```
GET http://localhost:3000/api/payment-status/abc123
```

### 3. Simular reconciliación:
```
GET http://localhost:3000/api/cron
```

### 4. Ver logs en MongoDB:
```javascript
db.all_logs.find().sort({ timestamp: -1 }).limit(10)
```

## ⚡ Snippets Útiles

### Obtener transactionId al crear pago:

```javascript
// En POST /create-payment, línea ~200
const response = await axios.post(`${GETNET_URL}/api/session`, paymentData);

// AQUÍ obtienes el ID:
const transactionId = response.data.requestId;
console.log('Transaction ID:', transactionId);

// Se guarda automáticamente en MongoDB
```

### Implementar lógica de negocio:

```javascript
async function paymentSuccessful(transactionId) {
    const payment = await Payment.findOne({ requestId: transactionId });
    
    // 1. Enviar email
    await sendEmail({
        to: payment.buyer.email,
        subject: 'Pago confirmado',
        text: `Tu pago de $${payment.amount} fue procesado`
    });
    
    // 2. Activar servicio
    await User.updateOne(
        { email: payment.buyer.email },
        { isPremium: true }
    );
    
    console.log('✅ Payment processed:', transactionId);
}
```

## 📝 Archivos Importantes

```
getnet-api/
├── index.js                              ← Código principal
├── config/
│   ├── database.js                       ← Conexión MongoDB
│   └── swagger.js                        ← Config Swagger
├── models/
│   ├── Payment.js                        ← Schema pagos
│   └── AllLog.js                         ← Schema logs
├── .env                                  ← Variables de entorno
├── README.md                             ← Documentación completa
├── SWAGGER_CRON_IMPLEMENTACION.md        ← Esta implementación
└── EJEMPLOS_PAYMENT_SUCCESSFUL.js       ← Ejemplos de uso
```

## 🎓 Siguiente Paso

1. **Personalizar `paymentSuccessful()`** con tu lógica
2. **Probar un pago completo** en ambiente TEST
3. **Configurar CRON** para reconciliación
4. **Revisar Swagger Docs** en `/docs`
5. **Desplegar a producción** en `getnet.cloud.app`

---

**¿Dudas?** Revisa:
- `README.md` - Documentación completa
- `SWAGGER_CRON_IMPLEMENTACION.md` - Detalles técnicos
- `EJEMPLOS_PAYMENT_SUCCESSFUL.js` - 7 ejemplos prácticos
- `/docs` - API interactiva

🚀 **Todo listo para producción!**
