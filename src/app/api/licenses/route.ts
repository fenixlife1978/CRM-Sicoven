import { createHash, randomBytes, randomUUID } from "node:crypto";
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
      sql: `SELECT l.id,l.customer_id,l.product_id,l.license_key_hint,l.status,l.starts_at,l.expires_at,l.max_activations,l.created_at,
                   c.display_name AS customer_name,p.name AS product_name,
                   (SELECT COUNT(*) FROM activations a WHERE a.license_id=l.id AND a.status='active') AS active_activations
            FROM licenses l JOIN customers c ON c.id=l.customer_id JOIN products p ON p.id=l.product_id
            ORDER BY l.created_at DESC LIMIT 250`
    });
    return NextResponse.json({ licenses: result.rows });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar las licencias." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede emitir licencias." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const customerId = typeof data.customerId === "string" ? data.customerId : "";
    const productId = typeof data.productId === "string" ? data.productId : "";
    const maxActivations = Number(data.maxActivations ?? 1);
    const startsAt = typeof data.startsAt === "string" && data.startsAt ? data.startsAt : null;
    const expiresAt = typeof data.expiresAt === "string" && data.expiresAt ? data.expiresAt : null;
    if (!customerId || !productId || !Number.isInteger(maxActivations) || maxActivations < 1 || maxActivations > 100) {
      return NextResponse.json({ error: "Cliente, producto y límite válido de equipos son obligatorios." }, { status: 400 });
    }
    if (startsAt && Number.isNaN(Date.parse(startsAt)) || expiresAt && Number.isNaN(Date.parse(expiresAt))) {
      return NextResponse.json({ error: "Las fechas de vigencia no son válidas." }, { status: 400 });
    }
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      return NextResponse.json({ error: "La fecha de vencimiento debe ser posterior al inicio." }, { status: 400 });
    }
    const db = getDb();
    const related = await db.execute({
      sql: "SELECT (SELECT COUNT(*) FROM customers WHERE id=? AND status='active') AS customer_ok,(SELECT COUNT(*) FROM products WHERE id=? AND status='active') AS product_ok",
      args: [customerId, productId]
    });
    const row = related.rows[0];
    if (!row || Number(row.customer_ok) !== 1 || Number(row.product_ok) !== 1) {
      return NextResponse.json({ error: "El cliente o producto no existe o está inactivo." }, { status: 400 });
    }

    const id = randomUUID();
    const rawKey = `SIC-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyHint = `…${rawKey.slice(-4)}`;
    await db.batch([
      { sql: "INSERT INTO licenses (id,customer_id,product_id,license_key_hash,license_key_hint,status,starts_at,expires_at,max_activations,created_by) VALUES (?,?,?,?,?,'pending',?,?,?,?)", args: [id,customerId,productId,keyHash,keyHint,startsAt,expiresAt,maxActivations,session.sub] },
      { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"license_issued","license",id,JSON.stringify({customerId,productId,maxActivations})] }
    ], "write");
    return NextResponse.json({ ok: true, id, licenseKey: rawKey, warning: "Guarda esta clave ahora: no se vuelve a mostrar." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo emitir la licencia." }, { status: 503 });
  }
}
