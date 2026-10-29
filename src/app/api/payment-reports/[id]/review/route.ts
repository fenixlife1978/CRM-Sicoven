import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede decidir sobre pagos." }, { status: 403, headers: noStore });

  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers: noStore });
    const data = body as Record<string, unknown>;
    const decision = data.decision === "approve" ? "approve" : data.decision === "reject" ? "reject" : "";
    const note = typeof data.note === "string" ? data.note.trim().slice(0, 500) : "";
    if (!decision) return NextResponse.json({ error: "Selecciona aprobar o rechazar." }, { status: 400, headers: noStore });

    const db = getDb();
    const tx = await db.transaction("write");
    try {
      const result = await tx.execute({
        sql: `SELECT r.*,p.name AS product_name,p.edition AS product_edition,p.version AS product_version,
          cp.name AS plan_name,cp.duration_days,cp.max_activations,cp.price_amount,cp.currency,
          cp.active AS plan_active,p.status AS product_status,b.active AS bank_active
          FROM payment_reports r JOIN products p ON p.id=r.product_id
          JOIN commercial_plans cp ON cp.id=r.plan_id
          JOIN payment_bank_accounts b ON b.id=r.destination_bank_id
          WHERE r.id=? LIMIT 1`,
        args: [id]
      });
      const report = result.rows[0];
      if (!report) { await tx.rollback(); return NextResponse.json({ error: "No se encontró el reporte de pago." }, { status: 404, headers: noStore }); }
      if (String(report.status) !== "pending_review") {
        await tx.rollback();
        return NextResponse.json({ error: "Este reporte ya fue revisado. No se emitirá una segunda licencia." }, { status: 409, headers: noStore });
      }
      if (decision === "reject") {
        await tx.execute({ sql: "UPDATE payment_reports SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending_review'", args: [note || "Pago no validado",session.sub,id] });
        await tx.execute({ sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"payment_report_rejected","payment_report",id,JSON.stringify({ note })] });
        await tx.commit();
        return NextResponse.json({ ok: true, status: "rejected" }, { headers: noStore });
      }

      if (Number(report.plan_active) !== 1 || String(report.product_status) !== "active" ||
          Number(report.bank_active) !== 1 ||
          Math.abs(Number(report.price_amount) - Number(report.amount)) > 0.005) {
        await tx.rollback();
        return NextResponse.json({
          error: "No se puede aprobar: el producto, plan o cuenta receptora ya no está activo, o el monto no coincide con el precio vigente. Verifica el pago y la configuración comercial."
        }, { status: 409, headers: noStore });
      }

      const type = String(report.customer_type);
      const identity = String(report.identity_document);
      const taxId = report.tax_id ? String(report.tax_id) : null;
      const customerResult = await tx.execute({
        sql: type === "person"
          ? "SELECT id FROM customers WHERE type='person' AND identity_document=? LIMIT 1"
          : "SELECT id FROM customers WHERE type='company' AND tax_id=? LIMIT 1",
        args: [type === "person" ? identity : taxId ?? identity]
      });
      let customerId = customerResult.rows[0]?.id ? String(customerResult.rows[0].id) : "";
      if (!customerId) {
        customerId = randomUUID();
        const displayName = type === "person" ? `${String(report.first_name)} ${String(report.last_name)}`.trim() : String(report.legal_name);
        await tx.execute({
          sql: `INSERT INTO customers (id,type,display_name,first_name,last_name,identity_document,legal_name,tax_id,email,phone,status,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,'active',?)`,
          args: [customerId,type,displayName,report.first_name ?? null,report.last_name ?? null,type === "person" ? identity : null,
            type === "company" ? String(report.legal_name) : null,taxId,report.email ?? null,String(report.phone),session.sub]
        });
      }

      const licenseId = randomUUID();
      const rawKey = `SIC-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const durationDays = report.duration_days === null || report.duration_days === undefined ? null : Number(report.duration_days);
      const startsAt = new Date().toISOString();
      let expiresAt: string | null = null;
      if (durationDays !== null && Number.isInteger(durationDays) && durationDays > 0) {
        const expiry = new Date(Date.parse(startsAt) + (durationDays - 1) * 86400000);
        expiry.setUTCHours(23, 59, 59, 999);
        expiresAt = expiry.toISOString();
      }
      const maxActivations = Math.max(1, Math.min(100, Number(report.max_activations) || 1));
      const terms = { durationDays, supportTerms: "", updateTerms: "", extraActivationTerms: "", terms: "Licencia emitida tras verificación manual del pago.", billingCycle: "once", billingAmount: Number(report.amount), currency: String(report.currency || "USD"), offlineDays: 7 };
      await tx.execute({
        sql: `INSERT INTO licenses (id,customer_id,product_id,license_key_hash,license_key_hint,status,starts_at,expires_at,max_activations,created_by,license_type_name,license_terms_json,offline_days,billing_cycle,billing_amount,currency)
          VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,7,'once',?,?)`,
        args: [licenseId,customerId,String(report.product_id),keyHash,`…${rawKey.slice(-4)}`,startsAt,expiresAt,maxActivations,session.sub,String(report.plan_name),JSON.stringify(terms),Number(report.amount),String(report.currency || "USD")]
      });

      const certificate = {
        certificateId: `SIC-CERT-${licenseId.slice(0,8).toUpperCase()}`,
        issuedAt: startsAt,
        licenseKey: rawKey,
        licenseTypeName: String(report.plan_name),
        startsAt,
        expiresAt,
        maxActivations,
        terms,
        customerName: type === "person" ? `${String(report.first_name)} ${String(report.last_name)}`.trim() : String(report.legal_name),
        identityDocument: String(report.identity_document),
        customerEmail: report.email ?? null,
        customerPhone: String(report.phone),
        productName: String(report.product_name),
        productEdition: report.product_edition ? String(report.product_edition) : null,
        productVersion: report.product_version ? String(report.product_version) : null
      };

      await tx.execute({
        sql: "UPDATE payment_reports SET status='approved',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,customer_id=?,license_id=?,certificate_json=? WHERE id=? AND status='pending_review'",
        args: [note || null,session.sub,customerId,licenseId,JSON.stringify(certificate),id]
      });
      await tx.execute({ sql: "INSERT INTO license_billing_records (id,license_id,record_type,amount,currency,billing_cycle,period_start,period_end,due_at,paid_at,status,description,created_by) VALUES (?,?, 'initial',?,?, 'once',?,?,?,CURRENT_TIMESTAMP,'paid',?,?)", args: [randomUUID(),licenseId,Number(report.amount),String(report.currency || "USD"),startsAt,expiresAt,startsAt,`Pago Móvil aprobado · reporte ${id}`,session.sub] });
      await tx.execute({ sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"payment_approved_license_issued","payment_report",id,JSON.stringify({ customerId,licenseId,productId:report.product_id,planId:report.plan_id,amount:report.amount })] });
      await tx.commit();
      return NextResponse.json({
        ok: true, status: "approved", customerId, licenseId,
        licenseKey: rawKey,
        warning: "La clave solo se muestra en esta respuesta. Guárdala ahora y entrega el certificado al cliente.",
        certificate
      }, { headers: noStore });
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la revisión. Verifica los datos e inténtalo de nuevo." }, { status: 503, headers: noStore });
  }
}
