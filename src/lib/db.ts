import { createClient, type Client } from "@libsql/client";

let client: Client | undefined;

export function getDb(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("Faltan TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en el entorno.");
  client = createClient({ url, authToken });
  return client;
}

export async function ensureSchema() {
  const db = getDb();
  await db.batch([
    { sql: `CREATE TABLE IF NOT EXISTS crm_users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','operator','viewer')),
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` },
    { sql: `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('person','company')),
      display_name TEXT NOT NULL, first_name TEXT, last_name TEXT, identity_document TEXT,
      personal_tax_id TEXT, legal_name TEXT, tax_id TEXT, trade_name TEXT, legal_representative TEXT,
      email TEXT, phone TEXT, address TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active','inactive')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by TEXT NOT NULL REFERENCES crm_users(id)
    )` },
    { sql: `CREATE UNIQUE INDEX IF NOT EXISTS customers_person_identity_unique
      ON customers(identity_document) WHERE type='person' AND identity_document IS NOT NULL AND identity_document <> ''` },
    { sql: `CREATE UNIQUE INDEX IF NOT EXISTS customers_company_tax_unique
      ON customers(tax_id) WHERE type='company' AND tax_id IS NOT NULL AND tax_id <> ''` },
    { sql: `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, edition TEXT, version TEXT, description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` },
    { sql: `CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id),
      product_id TEXT NOT NULL REFERENCES products(id), license_key_hash TEXT NOT NULL UNIQUE,
      license_key_hint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','active','expired','revoked')),
      starts_at TEXT, expires_at TEXT, max_activations INTEGER NOT NULL DEFAULT 1 CHECK(max_activations > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_by TEXT NOT NULL REFERENCES crm_users(id)
    )` },
    { sql: `CREATE TABLE IF NOT EXISTS activations (
      id TEXT PRIMARY KEY, license_id TEXT NOT NULL REFERENCES licenses(id),
      installation_id TEXT NOT NULL, device_label TEXT, status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active','revoked')), activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT, revoked_at TEXT, UNIQUE(license_id, installation_id)
    )` },
    { sql: `CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES crm_users(id), action TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )` }
  ], "write");
}
