# Analítica central de productos

## Arquitectura
- El CRM es el centro de administración y Turso conserva los eventos.
- Cada producto se identifica por `products.product_code`; nunca se confía en un product_id enviado por el navegador.
- El endpoint público es `POST /api/analytics/events`; el panel autenticado es `/analitica`.
- La API pública acepta únicamente los orígenes incluidos en `ANALYTICS_ALLOWED_ORIGINS` (separados por coma). Por defecto permite `https://sicoven-descargas.vercel.app`.
- No se almacenan direcciones IP en claro. Se usa un hash con sal del secreto de sesión para limitar eventos por IP (120 por hora).
- El panel requiere rol admin.

## Eventos admitidos
`page_view`, `download_click`, `whatsapp_click`, `lead_submit`.

Un `download_click` mide intención/clic; no demuestra que el instalador terminó de descargarse ni que fue instalado. Los contadores reales del proveedor de distribución deben integrarse aparte.

## Integración desde una landing
Enviar JSON con `product_code`, `event_type`, `session_id`, `source`, `medium`, `campaign`, `landing_path` y `referrer`. No enviar nombres, correos, teléfonos ni datos sensibles en eventos de navegación.

## Configuración
Añadir en Vercel:
`ANALYTICS_ALLOWED_ORIGINS=https://sicoven-descargas.vercel.app`
Se pueden añadir otros dominios separados por coma. No se requieren nuevas credenciales Turso: reutiliza las variables del CRM.
