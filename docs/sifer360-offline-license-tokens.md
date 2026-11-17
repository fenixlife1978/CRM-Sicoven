# Analítica central de productos

## Arquitectura
- El CRM es el centro de administración y Turso conserva los eventos.
- Cada producto se identifica por `products.product_code`; nunca se confía en un product_id enviado por el navegador.
- El endpoint público es `POST /api/analytics/events`; el panel autenticado es `/analitica`.
- La API pública acepta únicamente los orígenes incluidos en `ANALYTICS_ALLOWED_ORIGINS` (separados por coma). Por defecto permite `https://sicoven-descargas.vercel.app` y `https://crm-sicoven.vercel.app`.
- No se almacenan direcciones IP en claro. Se usa un hash con sal del secreto de sesión para limitar eventos por IP (120 por hora).
- El panel requiere rol admin.

## Eventos admitidos
`page_view`, `download_click`, `whatsapp_click`, `lead_submit`.

Un `download_click` mide intención/clic; no demuestra que el instalador terminó de descargarse ni que fue instalado. Los contadores reales del proveedor de distribución deben integrarse aparte.

## Integración desde una landing
Enviar JSON con `product_code`, `event_type`, `session_id`, `source`, `medium`, `campaign`, `landing_path` y `referrer`. No enviar nombres, correos, teléfonos ni datos sensibles en eventos de navegación.


## Telemetría de escritorio SIFER360
- `POST /api/analytics/events` también admite peticiones sin encabezado `Origin`, exclusivamente para `product_code=SIFER360_LICORERIA` y los eventos `app_launch`, `trial_started`, `trial_expired`, `license_activated`, `license_check` y `app_error`.
- Los eventos de escritorio se almacenan separados de la analítica web y se agregan en el mismo panel por producto.
- La aplicación envía un identificador de instalación hasheado, versión, plataforma y tipo de evento. No transmite claves, nombres, correos, ventas, inventario, caja, clientes ni datos contables.
- La telemetría puede desactivarse desde la aplicación. El CRM aplica el mismo límite de eventos por IP y no depende de esta telemetría para validar licencias.

## Configuración
Añadir en Vercel:
`ANALYTICS_ALLOWED_ORIGINS=https://sicoven-descargas.vercel.app`
Se pueden añadir otros dominios separados por coma. No se requieren nuevas credenciales Turso: reutiliza las variables del CRM.


## Tokens offline SIFER360
La ruta `POST /api/activations` entrega a `SIFER360_LICORERIA` un token firmado Ed25519. El token vincula el product code, licencia, installation ID, vigencia y límite offline. La clave privada `SIFER360_LICENSE_SIGNING_PRIVATE_KEY` se conserva como variable sensible de producción; la aplicación de escritorio solo contiene la clave pública de verificación. Las revalidaciones de una instalación existente actualizan su última conexión sin crear una activación adicional.
