# CRM SICOVEN

CRM privado para administrar clientes, catálogo de productos, licencias de software y equipos activados del ecosistema SICOVEN. Incluye además un envoltorio opcional de Electron para abrir el portal CRM de producción en una ventana de escritorio; no sustituye ni empaqueta las aplicaciones POS/licenciadas ni añade funcionamiento offline.

## Implementado en la rama `cloud-crm-foundation`

- Inicio y cierre de sesión con cookie HTTP-only, JWT firmado y contraseña almacenada como hash bcrypt.
- Alta y consulta de clientes persona natural o empresa, con validaciones e índices únicos para cédula y RIF.
- Alta y consulta del catálogo de productos.
- Emisión de licencias con clave aleatoria; en la base de datos se almacena únicamente su hash y una pista parcial.
- Activación de equipos exclusivamente en línea, validada contra el CRM y con límite de dispositivos aplicado dentro de una transacción.
- Consulta de activaciones, revocación administrativa y registro de eventos en auditoría.
- Panel y módulos web que consultan la base de datos real; no se incorporan registros ficticios.
- El CRM y las aplicaciones POS/licenciadas se mantienen separados; el cliente Electron de este repositorio solo empaqueta el acceso de escritorio al portal CRM.

## Variables de entorno

Configurar en el entorno de ejecución, nunca en el repositorio:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SESSION_SECRET` (mínimo 32 caracteres aleatorios)
- `CRM_ADMIN_EMAIL` (opcional para crear el primer administrador si no existe)
- `CRM_ADMIN_PASSWORD` (opcional, mínimo 12 caracteres; se usa solo para el alta inicial)

La función de bootstrap crea las tablas necesarias y crea el administrador inicial solo cuando las variables de correo y contraseña están configuradas y ese correo aún no existe. Cambiar las variables no restablece automáticamente una contraseña existente.

## Desarrollo

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Cliente de escritorio Electron (portal CRM en línea)\n\nEl instalador se genera en Windows mediante GitHub Actions. La aplicación Electron abre `https://crm-sicoven.vercel.app`; por tanto, requiere conexión a internet y que el portal y sus variables de entorno estén operativos. No guarda la base de datos Turso localmente ni ofrece operación offline.\n\n- Desarrollo web: `npm run dev`\n- Empaquetar instalador Windows: `npm run desktop:dist`\n- El artefacto `.exe` se adjunta a cada ejecución de Actions como `CRM-SICOVEN-Windows-*`.\n- Para publicar una GitHub Release, crear y subir una etiqueta versionada `v*` (por ejemplo `v0.2.1`); el workflow publica el instalador automáticamente.\n\n## Pendiente de verificación antes de producción

- Ejecutar lint, comprobación TypeScript y build de producción.
- Probar login, cierre de sesión, persistencia, duplicados, roles y auditoría contra una base Turso de prueba.
- Probar concurrencia real en el límite de activaciones y el ciclo completo de emisión, activación, renovación y revocación.
- Probar la activación exclusivamente en línea desde cada instalador, incluidos errores de conectividad, licencias vencidas y límite de equipos.
- Revisar controles de abuso/rate limiting del login, política de expiración de sesiones, seguridad CSRF/origen y recuperación administrativa.
- Configurar variables en el proyecto Vercel correcto y desplegar solo después de completar estas verificaciones.

**Estado:** base funcional en desarrollo; no declarar listo para producción hasta completar las pruebas y verificaciones anteriores.
