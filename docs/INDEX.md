# 🎯 Índice Rápido de Documentación

## 🚀 Para Empezar

1. **[Guía Rápida](guides/quick-start.md)** - Configuración inicial del proyecto
2. **[Tarjetas de Prueba](testing/test-cards.md)** - Tarjetas para testing en sandbox
3. **[Resumen de Implementación](guides/implementation.md)** - Overview completo del proyecto

## 💳 Trabajar con Pagos

- **[Ejemplos de Pagos Exitosos](payments/payment-successful-examples.js)** - Código de ejemplo para manejar `paymentSuccessful()`

## 🧪 Testing y Desarrollo

- **[Tarjetas de Prueba](testing/test-cards.md)** - Números de tarjeta para testing
  - ✅ Tarjetas aprobadas (Visa, Mastercard, Amex)
  - ❌ Tarjetas rechazadas (fondos insuficientes, inválida, expirada)
  - ⏳ Tarjetas pendientes

## 🔄 Automatización

- **[Swagger & Cron](workflows/swagger-cron-implementation.md)** - Documentación de API y reconciliación automática

## 📂 Carpetas Disponibles

| Carpeta | Propósito |
|---------|-----------|
| `api/` | Documentación de endpoints y API |
| `guides/` | Guías de implementación y tutoriales |
| `payments/` | Ejemplos y documentación de pagos |
| `testing/` | Recursos para testing (tarjetas, datos de prueba) |
| `deployment/` | Instrucciones de deployment y producción |
| `workflows/` | CI/CD, automatización, y procesos |

## ⚙️ Configuración de Copilot

El archivo [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) contiene las reglas para que GitHub Copilot genere automáticamente toda la documentación dentro de `docs/` organizadas por subcarpetas.

---

💡 **Tip**: Todos los archivos `.md` están organizados por categoría. Nunca en la raíz del proyecto.
