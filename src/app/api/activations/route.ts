import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";


export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute({
      sql: `SELECT a.id,a.license_id,a.installation_id,a.device_label,a.status,a.activated_at,a.last_seen_at,a.revoked_at,
                   c.display_name AS customer_name,p.name AS product_name,l.license_key_hint
            FROM activations a JOIN licenses l ON l.id=a.license_id
            JOIN customers c ON c.id=l.customer_id JOIN products p ON p.id=l.product_id
            ORDER BY a.activated_at DESC LIMIT 500`
    });
    return NextResponse.json({ activations: result.rows });
  } catch {
    return NextResponse.json({ error: "No se pudieron consultar las activaciones." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const key = typeof data.licenseKey === "string" ? data.licenseKey.trim() : "";
    const installationId = typeof data.installationId === "string" ? data.installationId.trim() : "";
    const deviceLabel = typeof data.deviceLabel === "string" ? data.deviceLabel.trim().slice(0, 120) : null;
    if (!key || key.length > 120 || !/^[a-zA-Z0-9-]+$/.test(key) || !installationId || installationId.length > 200) {
      return NextResponse.json({ error: "Clave de licencia e identificador de instalación son obligatorios." }, { status: 400 });
    }

    const db = getDb();
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
        return NextResponse.json({ error: "Licencia inválida, vencida o revocada." }, { status: 403 });
      }
      const now = Date.now();
      if (license.starts_at && Date.parse(String(license.starts_at)) > now) {
        await tx.rollback();
        return NextResponse.json({ error: "La licencia todavía no está vigente." }, { status: 403 });
      }
      if (license.expires_at && Date.parse(String(license.expires_at)) <= now) {
        await tx.execute({ sql: "UPDATE licenses SET status='expired' WHERE id=?", args: [String(license.id)] });
        await tx.commit();
        return NextResponse.json({ error: "La licencia está vencida." }, { status: 403 });
      }

      const existing = await tx.execute({
        sql: "SELECT id,status FROM activations WHERE license_id=? AND installation_id=? LIMIT 1",
        args: [String(license.id), installationId]
      });
      const activation = existing.rows[0];
      if (activation && String(activation.status) === "revoked") {
        await tx.rollback();
        return NextResponse.json({ error: "La activación de este equipo fue revocada." }, { status: 403 });
      }
      if (!activation) {
        const count = await tx.execute({
          sql: "SELECT COUNT(*) AS total FROM activations WHERE license_id=? AND status='active'",
          args: [String(license.id)]
        });
        if (Number(count.rows[0]?.total ?? 0) >= Number(license.max_activations)) {
          await tx.rollback();
          return NextResponse.json({ error: "Esta licencia ya agotó los equipos autorizados. Solicita a tu distribuidor una ampliación de la licencia para incorporar más equipos. Una vez actualizado el límite en CRM-Sicoven, podrás activar equipos adicionales con la misma clave." }, { status: 409 });
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
      return NextResponse.json({
        ok: true,
        activation: { id: activationId, status: "active" },
        license: { id: String(license.id), customer: String(license.customer_name), product: String(license.product_name), status: "active", activationRequiresInternet: true, offlineDays: Math.max(0, Math.min(365, Number(license.offline_days ?? 0))) }
      });
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "No se pudo validar o activar la licencia." }, { status: 503 });
  }
}
