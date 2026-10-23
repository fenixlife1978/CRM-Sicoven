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
                   l.license_type_name,l.offline_days,c.display_name AS customer_name,c.email AS customer_email,c.phone AS customer_phone,c.address AS customer_address,
                   p.name AS product_name,p.edition AS product_edition,p.version AS product_version,l.license_terms_json,
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
    const licenseTypeId = typeof data.licenseTypeId === "string" ? data.licenseTypeId : "";
    let maxActivations = Number(data.maxActivations ?? 1);
    let offlineDays = Math.min(30, Math.max(1, Number(data.offlineDays ?? 7)));
    let licenseTypeName = "Personalizada";
    let licenseTerms: Record<string, unknown> = {
      durationDays: null, supportTerms: "", updateTerms: "",
      extraActivationTerms: "", terms: "", offlineDays
    };
    const startsInput = typeof data.startsAt === "string" && data.startsAt ? data.startsAt : null;
    const expiresInput = typeof data.expiresAt === "string" && data.expiresAt ? data.expiresAt : null;
    const startsAt = startsInput && /^\d{4}-\d{2}-\d{2}$/.test(startsInput) ? `${startsInput}T00:00:00.000Z` : startsInput;
    let expiresAt = expiresInput && /^\d{4}-\d{2}-\d{2}$/.test(expiresInput) ? `${expiresInput}T23:59:59.999Z` : expiresInput;
    let startsAt = startsInput && /^\d{4}-\d{2}-\d{2}$/.test(startsInput) ? `${startsInput}T00:00:00.000Z` : startsInput;
    const db = getDb();
    if (licenseTypeId) {
      const planResult = await db.execute({ sql: "SELECT * FROM license_types WHERE id=? AND active=1 LIMIT 1", args: [licenseTypeId] });
      const plan = planResult.rows[0];
      if (!plan) return NextResponse.json({ error: "El tipo de licencia seleccionado no existe o está inactivo." }, { status: 400 });
      licenseTypeName = String(plan.name);
      maxActivations = Number(plan.max_activations);
      offlineDays = Number(plan.offline_days);
      licenseTerms = {
        durationDays: plan.duration_days === null ? null : Number(plan.duration_days),
        supportTerms: String(plan.support_terms ?? ""),
        updateTerms: String(plan.update_terms ?? ""),
        extraActivationTerms: String(plan.extra_activation_terms ?? ""),
        terms: String(plan.terms ?? ""),
        priceLabel: String(plan.price_label ?? ""),
        offlineDays
      };
      if (!startsAt) startsAt = new Date().toISOString();
      if (plan.duration_days !== null && plan.duration_days !== undefined) {
        const expiry = new Date(Date.parse(startsAt) + Number(plan.duration_days) * 86400000);
        expiry.setUTCHours(23,59,59,999);
        expiresAt = expiry.toISOString();
      } else {
        expiresAt = null;
      }
    }
    if (!customerId || !productId || !Number.isInteger(maxActivations) || maxActivations < 1 || maxActivations > 100) {
      return NextResponse.json({ error: "Cliente, producto y límite válido de equipos son obligatorios." }, { status: 400 });
    }
    if (startsAt && Number.isNaN(Date.parse(startsAt)) || expiresAt && Number.isNaN(Date.parse(expiresAt))) {
      return NextResponse.json({ error: "Las fechas de vigencia no son válidas." }, { status: 400 });
    }
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      return NextResponse.json({ error: "La fecha de vencimiento debe ser posterior al inicio." }, { status: 400 });
    }
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
      { sql: "INSERT INTO licenses (id,customer_id,product_id,license_key_hash,license_key_hint,status,starts_at,expires_at,max_activations,created_by,license_type_id,license_type_name,license_terms_json,offline_days) VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?,?)", args: [id,customerId,productId,keyHash,keyHint,startsAt,expiresAt,maxActivations,session.sub,licenseTypeId || null,licenseTypeName,JSON.stringify(licenseTerms),offlineDays] },
      { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"license_issued","license",id,JSON.stringify({customerId,productId,maxActivations,licenseTypeId,licenseTypeName,expiresAt,offlineDays})] }
    ], "write");
    const details = await db.execute({
      sql: "SELECT c.display_name AS customerName,c.email AS customerEmail,c.phone AS customerPhone,c.address AS customerAddress,p.name AS productName,p.edition AS productEdition,p.version AS productVersion FROM customers c,products p WHERE c.id=? AND p.id=?",
      args: [customerId,productId]
    });
    return NextResponse.json({
      ok: true, id, licenseKey: rawKey, warning: "Guarda esta clave ahora: no se vuelve a mostrar.",
      certificate: {
        certificateId: `SIC-CERT-${id.slice(0,8).toUpperCase()}`,
        issuedAt: new Date().toISOString(), licenseKey: rawKey,
        licenseTypeName, startsAt, expiresAt, maxActivations, offlineDays, terms: licenseTerms,
        ...(details.rows[0] ?? {})
      }
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo emitir la licencia." }, { status: 503 });
  }
}
