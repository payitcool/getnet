# 💳 TARJETAS DE PRUEBA - GETNET

## 🔍 Información General

Esta guía contiene las tarjetas de prueba para realizar transacciones en el ambiente de **sandbox/pruebas** de Getnet. Estas tarjetas permiten simular diferentes escenarios de pago sin realizar transacciones reales.

> ⚠️ **IMPORTANTE**: Estas tarjetas **SOLO** funcionan en el ambiente de pruebas. No usar en producción.

---

## 🇨🇱 CHILE - Tarjetas de Prueba

### ✅ Tarjetas Aprobadas (APPROVED)

#### Visa
```
Número: 4111 1111 1111 1111
CVV: 123
Fecha de Expiración: Cualquier fecha futura (ej: 12/25, 01/26)
Nombre: Cualquier nombre
```

#### Mastercard
```
Número: 5555 5555 5555 4444
CVV: 123
Fecha de Expiración: Cualquier fecha futura
Nombre: Cualquier nombre
```

#### Amex
```
Número: 3782 822463 10005
CVV: 1234 (4 dígitos para Amex)
Fecha de Expiración: Cualquier fecha futura
Nombre: Cualquier nombre
```

---

### ❌ Tarjetas Rechazadas (REJECTED)

#### Fondos Insuficientes
```
Número: 4000 0000 0000 0002
CVV: 123
Fecha de Expiración: Cualquier fecha futura
Resultado: REJECTED - Fondos insuficientes
```

#### Tarjeta Inválida
```
Número: 4000 0000 0000 0127
CVV: 123
Fecha de Expiración: Cualquier fecha futura
Resultado: REJECTED - Tarjeta inválida
```

#### Tarjeta Expirada
```
Número: 4000 0000 0000 0069
CVV: 123
Fecha de Expiración: Cualquier fecha futura
Resultado: REJECTED - Tarjeta expirada
```

---

### ⏳ Tarjetas con Estado Pendiente (PENDING)

```
Número: 4000 0000 0000 0051
CVV: 123
Fecha de Expiración: Cualquier fecha futura
Resultado: PENDING - Requiere verificación adicional
```

---

## 🌎 ARGENTINA - Tarjetas de Prueba

### Visa - Aprobada
```
Número: 4507 9900 0000 0000
CVV: 123
Fecha de Expiración: Cualquier fecha futura
```

### Mastercard - Aprobada
```
Número: 5299 9100 0000 0000
CVV: 123
Fecha de Expiración: Cualquier fecha futura
```

---

## 💡 Datos de Prueba Adicionales

### Información del Comprador (Buyer)
Puedes usar estos datos de prueba para los campos del comprador:

```json
{
  "name": "Juan Pérez",
  "email": "test@example.com",
  "phone": "+56912345678",
  "document": {
    "type": "RUT",
    "number": "12345678-9"
  }
}
```

### Direcciones de Prueba
```json
{
  "street": "Av. Libertador Bernardo O'Higgins",
  "number": "123",
  "city": "Santiago",
  "state": "Región Metropolitana",
  "zipCode": "8320000",
  "country": "CL"
}
```

---

## 🧪 Escenarios de Prueba

### 1. Pago Exitoso Completo
```javascript
{
  "card": "4111111111111111",
  "cvv": "123",
  "expiryDate": "12/25",
  "amount": 5000,
  "currency": "CLP"
}
// ✅ Resultado: APPROVED
```

### 2. Pago Rechazado por Fondos Insuficientes
```javascript
{
  "card": "4000000000000002",
  "cvv": "123",
  "expiryDate": "12/25",
  "amount": 10000,
  "currency": "CLP"
}
// ❌ Resultado: REJECTED (Fondos insuficientes)
```

### 3. Pago Pendiente de Autorización
```javascript
{
  "card": "4000000000000051",
  "cvv": "123",
  "expiryDate": "12/25",
  "amount": 7500,
  "currency": "CLP"
}
// ⏳ Resultado: PENDING
```

---

## 🔐 Notas de Seguridad

1. **Nunca uses tarjetas reales** en el ambiente de sandbox
2. **Las tarjetas de prueba no procesan dinero real**
3. **Datos sensibles**: Aunque son datos de prueba, trata la información con cuidado
4. **Ambiente de producción**: Estas tarjetas NO funcionan en producción

---

## 📚 Referencias

- **Getnet Docs**: [https://docs.globalgetnet.com/pt](https://docs.globalgetnet.com/pt)
- **Web Checkout**: [https://docs.globalgetnet.com/pt/products/online-payments/web-checkout](https://docs.globalgetnet.com/pt/products/online-payments/web-checkout)
- **API Regional**: [https://docs.globalgetnet.com/pt/products/online-payments/regional-api](https://docs.globalgetnet.com/pt/products/online-payments/regional-api)

---

## 🚀 Uso en tu Aplicación

Para probar tu integración con Getnet, usa estas tarjetas en tu flujo de pago:

```javascript
// Ejemplo con la API de Getnet
const testPayment = {
  amount: 5000,
  currency: "CLP",
  buyer: {
    name: "Test User",
    email: "test@example.com"
  },
  paymentMethod: {
    type: "CREDIT_CARD",
    card: {
      number: "4111111111111111",
      cvv: "123",
      expiryMonth: "12",
      expiryYear: "25",
      holderName: "TEST USER"
    }
  }
};
```

---

## ❓ Preguntas Frecuentes

### ¿Puedo usar cualquier CVV?
Generalmente sí, pero se recomienda usar `123` para Visa/Mastercard y `1234` para Amex.

### ¿Funcionan con montos específicos?
Sí, funcionan con cualquier monto válido en el ambiente de pruebas.

### ¿Cómo simulo un error específico?
Usa las tarjetas diseñadas para cada escenario (fondos insuficientes, tarjeta inválida, etc.).

### ¿Necesito usar datos reales del comprador?
No, puedes usar cualquier dato ficticio en el ambiente de pruebas.

---

**Última actualización**: Diciembre 2025
