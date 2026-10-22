# Modelo de datos inicial

## Customer

- `id`: UUID.
- `type`: `person` o `company`.
- `display_name`: nombre visible.
- Persona: `first_name`, `last_name`, `identity_document` (cédula), `personal_tax_id` opcional.
- Empresa: `legal_name`, `tax_id` (RIF), `trade_name` opcional, `legal_representative` opcional.
- Datos comunes: `email`, `phone`, `address`, `notes`.
- `status`, `created_at`, `updated_at`.

## Product

Sistema comercializado (SICOVEN u otro producto autorizado), edición y versión.

## License

Cliente, producto, clave/token hasheado, estado, fechas, política de activaciones y registro de revocación. Las claves secretas se muestran como máximo al emitirlas; no se guardan en claro si no es imprescindible.

## Activation

Licencia, identificador de instalación/equipo, fecha de alta y última validación, estado y datos mínimos necesarios para control de dispositivos.

## Reglas de identificación

- Guardar documento normalizado por tipo y país/emisor.
- Restricción única por combinación de tipo de identificación y valor normalizado, considerando únicamente identificaciones presentes.
- No aplicar una misma regla de formato a cédula y RIF.
- El RIF personal es opcional; no debe impedir registrar un contador independiente sin RIF.
- No usar datos ficticios en producción.

## Seguridad requerida antes de producción

Autenticación y autorización en servidor, protección contra fuerza bruta, validación de entrada, registro de auditoría, gestión segura de secretos, límites atómicos de activación, política de expiración offline y pruebas de restauración de datos.
