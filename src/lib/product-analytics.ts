import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

let schemaReady: Promise<void> | undefined;

export async function ensureProductAnalyticsSchema() {
  if (!schemaReady) schemaReady = (async () => {
    const db = getDb();
    await db.batch([
      { sql: `CREATE TABLE IF NOT EXISTS product_analytics_events (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id),
        event_type TEXT NOT NULL CHECK(event_type IN ('page_view','download_click','whatsapp_click','lead_submit')),
        session_id TEXT,
        source TEXT,
        medium TEXT,
        campaign TEXT,
        landing_path TEXT,
        referrer_host TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )` },
      { sql: "CREATE INDEX IF NOT EXISTS product_analytics_product_date_idx ON product_analytics_events(product_id,created_at)" },
      { sql: "CREATE INDEX IF NOT EXISTS product_analytics_event_date_idx ON product_analytics_events(event_type,created_at)" },
      { sql: `CREATE TABLE IF NOT EXISTS product_analytics_rate_limits (
        ip_hash TEXT PRIMARY KEY, window_started_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
      )` },
      { sql: `CREATE TABLE IF NOT EXISTS product_telemetry_events (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id),
        event_type TEXT NOT NULL CHECK(event_type IN ('app_launch','trial_started','trial_expired','license_activated','license_check','app_error')),
        session_id TEXT,
        source TEXT,
        medium TEXT,
        campaign TEXT,
        landing_path TEXT,
        referrer_host TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )` },
      { sql: "CREATE INDEX IF NOT EXISTS product_telemetry_product_date_idx ON product_telemetry_events(product_id,created_at)" },
      { sql: "CREATE INDEX IF NOT EXISTS product_telemetry_event_date_idx ON product_telemetry_events(event_type,created_at)" },
      { sql: `CREATE VIEW IF NOT EXISTS product_analytics_all_events AS
        SELECT id,product_id,event_type,session_id,source,medium,campaign,landing_path,referrer_host,created_at FROM product_analytics_events
        UNION ALL
        SELECT id,product_id,event_type,session_id,source,medium,campaign,landing_path,referrer_host,created_at FROM product_telemetry_events` }
    ], "write");
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

export function hashRequestIp(ip: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres para proteger la analítica.");
  }
  return createHash("sha256").update(secret).update(":").update(ip).digest("hex");
}

export function newAnalyticsEventId() { return randomUUID(); }

export function allowedAnalyticsOrigin(origin: string | null) {
  if (!origin) return false;
  const configured = (process.env.ANALYTICS_ALLOWED_ORIGINS || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  const allowed = new Set(["https://sicoven-descargas.vercel.app", "https://crm-sicoven.vercel.app", ...configured]);
  return allowed.has(origin);
}
