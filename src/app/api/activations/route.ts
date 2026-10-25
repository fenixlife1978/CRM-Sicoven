import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const ACTIVATION_WINDOW_SECONDS = 15 * 60;
const ACTIVATION_MAX_FAILURES = 10;


export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: NO_STORE });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute({
      sql: `SELECT a.id,a.license_id,a.installation_id,a.device_label,a.status,a.activated_at,a.last_seen_at,a.revoked_at,
                   c.display_name AS customer_name,p.name AS product_name,l.license_key_hint
            FROM activations a JOIN licenses l ON l.id=a.license_id
            JOIN customers c ON c.id=l.customer_id JOIN products p ON p.id=l.product_id
            ORDER BY a.activated_at DESC LIMIT 500`
    });
    return NextResponse.json({ activations: result.rows }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "No se pudieron consultar las activaciones." }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers: NO_STORE });
    const data = body as Record<string, unknown>;
    const key = typeof data.licenseKey === "string" ? data.licenseKey.trim() : "";
    const installationId = typeof data.installationId === "string" ? data.installationId.trim() : "";
    const deviceLabel = typeof data.deviceLabel === "string" ? data.deviceLabel.trim().slice(0, 120) : null;
    if (!key || key.length > 120 || !/^[a-zA-Z0-9-]+$/.test(key) || !installationId || installationId.length > 200) {
      return NextResponse.json({ error: "Clave de licencia e identificador de instalación son obligatorios." }, { status: 400, headers: NO_STORE });
    }

    const db = getDb();
    const clientIp = request.headers.get("x-real-ip")?.trim();
    const ipHash = clientIp && clientIp.length <= 100
      ? createHash("sha256").update(clientIp).digest("hex")
      : null;
    if (ipHash) {
      const attemptsResult = await db.execute({
        sql: "SELECT attempts,window_started_at,blocked_until FROM activation_ip_attempts WHERE ip_hash=? LIMIT 1",
        args: [ipHash]
      });
      const attempts = attemptsResult.rows[0];
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (attempts && nowSeconds - Number(attempts.window_started_at) >= ACTIVATION_WINDOW_SECONDS) {
        await db.execute({ sql: "DELETE FROM activation_ip_attempts WHERE ip_hash=?", args: [ipHash] });
      } else if (attempts && attempts.blocked_until != null && Number(attempts.blocked_until) > nowSeconds) {
        return NextResponse.json(
          { error: "Demasiados intentos de activación desde esta conexión. Espera antes de volver a intentarlo." },
          { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(1, Number(attempts.blocked_until) - nowSeconds)) } }
        );
      }
    }
    const tx = await db.transaction("write");
    try {
      const keyHash = createHash("sha256").update(key).digest("hex");
      const found = await tx.execute({
        sql: `SELECT l.id,l.status,l.starts_at,l.expires_at,l.max_activations,
                     COALESCE(lt.offline_days,l.offline_days,7) AS offline_days,
                     c.display_name AS customer_name,p.name AS product_name
              FROM licenses l
              JOIN customers c ON c.id=l.customer_id
              JOIN products p ON p.id=l.product_id
              LEFT JOIN license_types lt ON lt.id=l.license_type_id
              WHERE l.license_key_hash=? AND c.status='active' AND p.status='active' LIMIT 1`,
        args: [keyHash]
      });
      const license = found.rows[0];
      if (!license || ["revoked","expired"].includes(String(license.status))) {
        await tx.rollback();
        if (ipHash) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          await db.execute({
            sql: `INSERT INTO activation_ip_attempts (ip_hash,attempts,window_started_at,blocked_until)
                  VALUES (?,1,?,NULL)
                  ON CONFLICT(ip_hash) DO UPDATE SET
                    attempts=activation_ip_attempts.attempts+1,
                    window_started_at=CASE
                      WHEN activation_ip_attempts.attempts+1 >= ${ACTIVATION_MAX_FAILURES} THEN ?
                      ELSE activation_ip_attempts.window_started_at
                    END,
                    blocked_until=CASE
                      WHEN activation_ip_attempts.attempts+1 >= ${ACTIVATION_MAX_FAILURES} THEN ?+${ACTIVATION_WINDOW_SECONDS}
                      ELSE activation_ip_attempts.blocked_until
                    END`,
            args: [ipHash, nowSeconds, nowSeconds, nowSeconds]
          });
        }
        return NextResponse.json({ error: "Licencia inválida, vencida o revocada." }, { status: 403, headers: NO_STORE });
      }
      const now = Date.now();
      if (license.starts_at && Date.parse(String(license.starts_at)) > now) {
        await tx.rollback();
        return NextResponse.json({ error: "La licencia todavía no está vigente." }, { status: 403, headers: NO_STORE });
      }
      if (license.expires_at && Date.parse(String(license.expires_at)) <= now) {
        await tx.execute({ sql: "UPDATE licenses SET status='expired' WHERE id=?", args: [String(license.id)] });
        await tx.commit();
        return NextResponse.json({ error: "La licencia está vencida." }, { status: 403, headers: NO_STORE });
      }

      const existing = await tx.execute({
        sql: "SELECT id,status FROM activations WHERE license_id=? AND installation_id=? LIMIT 1",
        args: [String(license.id), installationId]
      });
      const activation = existing.rows[0];
      if (activation && String(activation.status) === "revoked") {
        await tx.rollback();
        return NextResponse.json({ error: "La activación de este equipo fue revocada." }, { status: 403, headers: NO_STORE });
      }
      if (!activation) {
        const count = await tx.execute({
          sql: "SELECT COUNT(*) AS total FROM activations WHERE license_id=? AND status='active'",
          args: [String(license.id)]
        });
        if (Number(count.rows[0]?.total ?? 0) >= Number(license.max_activations)) {
          await tx.rollback();
          return NextResponse.json({ error: "Esta licencia ya agotó los equipos autorizados. Solicita a tu distribuidor una ampliación de la licencia para incorporar más equipos. Una vez actualizado el límite en CRM-Sicoven, podrás activar equipos adicionales con la misma clave." }, { status: 409, headers: NO_STORE });
        }
      }

      const activationId = activation ? String(activation.id) : randomUUID();
      if (activation) {
        await tx.execute({ sql: "UPDATE activations SET last_seen_at=CURRENT_TIMESTAMP,device_label=COALESCE(?,device_label) WHERE id=?", args: [deviceLabel, activationId] });
      } else {
        await tx.execute({
          sql: "INSERT INTO activations (id,license_id,installation_id,device_label,status,last_seen_at) VALUES (?,?,?,?,'active',CURRENT_TIMESTAMP)",
          args: [activationId,String(license.id),installationId,deviceLabel]
        });
      }
      await tx.execute({ sql: "UPDATE licenses SET status='active' WHERE id=? AND status='pending'", args: [String(license.id)] });
      await tx.execute({
        sql: "INSERT INTO audit_log (id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?)",
        args: [randomUUID(),"license_activated","license",String(license.id),JSON.stringify({activationId,installationId,deviceLabel})]
      });
      await tx.commit();
      if (ipHash) await db.execute({ sql: "DELETE FROM activation_ip_attempts WHERE ip_hash=?", args: [ipHash] });
      return NextResponse.json({
        ok: true,
        activation: { id: activationId, status: "active" },
        license: { id: String(license.id), customer: String(license.customer_name), product: String(license.product_name), status: "active", activationRequiresInternet: true, offlineDays: Math.max(1, Math.min(30, Number(license.offline_days ?? 7))) }
      }, { headers: NO_STORE });
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "No se pudo validar o activar la licencia." }, { status: 503, headers: NO_STORE });
  }
}
