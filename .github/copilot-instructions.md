# GitHub Copilot Instructions

## Estructura de Archivos de Documentación

**IMPORTANTE**: Todos los archivos de documentación `.md` deben crearse dentro de la carpeta `docs/` organizada por subcategorías.

### Ubicación de Archivos Markdown

- ✅ **Correcto**: `docs/payments/ejemplo.md`
- ✅ **Correcto**: `docs/api/endpoints.md`
- ✅ **Correcto**: `docs/guides/quick-start.md`
- ❌ **Incorrecto**: `ejemplo.md` (raíz del proyecto)
- ❌ **Incorrecto**: `EJEMPLO.md` (raíz del proyecto)

### Estructura de Carpetas Requerida

```
docs/
├── api/              # Documentación de API y endpoints
├── guides/           # Guías de implementación y tutoriales
├── payments/         # Documentación relacionada con pagos
├── testing/          # Tarjetas de prueba y testing
├── deployment/       # Instrucciones de deployment
└── workflows/        # Documentación de CI/CD y workflows
```

### Reglas para Crear Documentación

1. **Siempre** crear archivos `.md` dentro de `docs/` y en la subcarpeta apropiada
2. **Nunca** crear archivos `.md` en la raíz del proyecto (excepto `README.md`)
3. **Usar** subcarpetas descriptivas y organizadas por tema
4. **Mantener** nombres de archivo en minúsculas con guiones (ej: `quick-start.md`)
5. **Incluir** tabla de contenido en documentos largos

### Ejemplos de Categorización

| Tipo de Documento              | Ubicación                         |
| ------------------------------ | --------------------------------- |
| Endpoints de API               | `docs/api/`                       |
| Guías de inicio rápido         | `docs/guides/`                    |
| Webhooks y notificaciones      | `docs/api/` o `docs/payments/`    |
| Tarjetas de prueba             | `docs/testing/`                   |
| Ejemplos de código             | `docs/guides/` o `docs/payments/` |
| Configuración de base de datos | `docs/guides/`                    |
| CI/CD pipelines                | `docs/workflows/`                 |
| Deployment en producción       | `docs/deployment/`                |
| Troubleshooting                | `docs/guides/troubleshooting.md`  |

### Formato de Documentación

Al crear documentación, seguir estas prácticas:

- Usar encabezados jerárquicos (`#`, `##`, `###`)
- Incluir ejemplos de código cuando sea relevante
- Agregar emojis para mejorar la legibilidad (opcional pero recomendado)
- Mantener consistencia con el resto de la documentación
- Agregar enlaces a recursos externos cuando sea necesario

---

**Nota**: Esta estructura ayuda a mantener el proyecto organizado y facilita la navegación de la documentación para desarrolladores.
