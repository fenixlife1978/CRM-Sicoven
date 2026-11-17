# Tokens offline firmados para SIFER360 LICORERÍA

La ruta `POST /api/activations` entrega a `SIFER360_LICORERIA` un token offline firmado con Ed25519. El token vincula:

- `productCode`: código de producto exacto.
- `licenseId`: licencia emitida por el CRM.
- `installationId`: instalación autorizada.
- `issuedAt`: momento de emisión.
- `offlineUntil`: límite de uso sin conexión.
- `expiresAt`: vencimiento de la licencia, cuando exista.

La clave privada `SIFER360_LICENSE_SIGNING_PRIVATE_KEY` se conserva como variable sensible de producción. La aplicación de escritorio contiene únicamente la clave pública de verificación. Nunca se transmite la clave privada al cliente.

En cada inicio y al recuperar conectividad, SIFER vuelve a validar la licencia con CRM. En modo offline, verifica la firma y las restricciones del token localmente. El margen predeterminado es de 7 días, respetando el límite y la fecha de vencimiento que emite CRM.

Las revalidaciones de una instalación existente actualizan `last_seen_at` y registran la acción `license_revalidated`; no crean otra activación para el mismo `licenseId + installationId`.
