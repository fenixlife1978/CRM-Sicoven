# CRM SICOVEN

CRM privado para administrar clientes, productos, ventas comerciales y licencias de los programas instalables del ecosistema SICOVEN.

## Tipos de cliente

- **Persona natural:** nombres, apellidos, cédula, RIF personal opcional, profesión/actividad y datos de contacto.
- **Empresa:** razón social, RIF, nombre comercial opcional, representante/contacto y datos de contacto.

Una ficha de cliente puede relacionarse con múltiples productos, compras, licencias y equipos activados. Los identificadores se normalizan y validan por tipo para reducir duplicados; no se confunden cédulas con RIF.

## Principios de seguridad

- CRM y aplicaciones de escritorio se mantienen como proyectos separados.
- No almacenar contraseñas en texto plano ni incluir secretos en el repositorio.
- Las licencias se generan y validan en el servidor; los límites de activación se aplican con operaciones atómicas.
- La activación inicial requiere conexión. El funcionamiento posterior sin conexión debe apoyarse en una licencia firmada, con caducidad/política explícita y validación local.
- No incluir datos personales ficticios en producción.
- No desplegar a producción ni configurar credenciales externas hasta verificar la aplicación y las variables necesarias.

## Etapas previstas

1. Estructura base, decisiones de arquitectura y validaciones.
2. Autenticación administrativa y gestión de clientes.
3. Catálogo de productos, licencias y activaciones.
4. Auditoría, límites de equipos, revocación y pruebas de seguridad.
5. Despliegue independiente en Vercel y configuración de base de datos.

## Estado

Inicio de proyecto. No considerar el sistema listo para producción hasta implementar y probar autenticación, persistencia, control de acceso, emisión/verificación de licencias y auditoría.
