import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { notifyAdminsPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede revisar pagos." }, { status: 403, headers: noStore });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute({
      sql: `SELECT r.id,r.product_id,r.plan_id,r.customer_type,r.first_name,r.last_name,r.legal_name,
        r.identity_document,r.tax_id,r.email,r.phone,r.amount,r.reference_last_six,r.reference_full,r.payment_date,
        r.source_bank,r.destination_bank_id,r.status,r.review_note,r.reviewed_at,r.created_at,
        p.name AS product_name,cp.name AS plan_name,b.bank_name AS destination_bank
        FROM payment_reports r JOIN products p ON p.id=r.product_id
        JOIN commercial_plans cp ON cp.id=r.plan_id
        JOIN payment_bank_accounts b ON b.id=r.destination_bank_id
        ORDER BY CASE r.status WHEN 'pending_review' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 300`
    });
    return NextResponse.json({ reports: result.rows }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "No se pudieron consultar los reportes de pago." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400, headers: noStore });
    const d = body as Record<string, unknown>;
    const productId = text(d.productId, 80);
    const planId = text(d.planId, 80);
    const customerType = d.customerType === "company" ? "company" : d.customerType === "person" ? "person" : "";
    const firstName = text(d.firstName, 100);
    const lastName = text(d.lastName, 100);
    const legalName = text(d.legalName, 200);
    const identityDocument = text(d.identityDocument, 40).toUpperCase();
    const taxId = text(d.taxId, 40).toUpperCase();
    const email = text(d.email, 254).toLowerCase();
    const phone = text(d.phone, 40);
    const amount = Number(d.amount);
    const referenceFull = text(d.referenceFull ?? d.referenceLastSix, 30).replace(/\s+/g, "");
    const referenceLastSix = referenceFull.slice(-6);
    const paymentDate = text(d.paymentDate, 10);
    const sourceBank = text(d.sourceBank, 80);
    const destinationBankId = text(d.destinationBankId, 80);
    const parsedPaymentDate = /^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ? new Date(paymentDate + "T00:00:00.000Z") : null;
    const validPaymentDate = !!parsedPaymentDate && !Number.isNaN(parsedPaymentDate.getTime()) &&
      parsedPaymentDate.toISOString().slice(0, 10) === paymentDate &&
      paymentDate <= new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (!productId || !planId || !customerType || !identityDocument || !phone || !Number.isFinite(amount) || amount <= 0 ||
      !/^\d{6}$/.test(referenceLastSix) || !validPaymentDate ||
      !sourceBank || !destinationBankId || (customerType === "person" && (!firstName || !lastName)) ||
      (customerType === "company" && !legalName) ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ error: "Completa los datos obligatorios y verifica el monto, la fecha, el correo y la referencia bancaria completa (solo números)." }, { status: 400, headers: noStore });
    }
    const db = getDb();
    const [plan, bank] = await Promise.all([
      db.execute({ sql: "SELECT id,product_id,price_amount FROM commercial_plans WHERE id=? AND product_id=? AND active=1 LIMIT 1", args: [planId, productId] }),
      db.execute({ sql: "SELECT id FROM payment_bank_accounts WHERE id=? AND active=1 LIMIT 1", args: [destinationBankId] })
    ]);
    if (!plan.rows[0] || !bank.rows[0]) return NextResponse.json({ error: "El plan o la cuenta de destino ya no están disponibles." }, { status: 400, headers: noStore });
    if (Math.abs(Number(plan.rows[0].price_amount) - amount) > 0.005) return NextResponse.json({ error: "El monto reportado no coincide con el precio vigente del plan." }, { status: 400, headers: noStore });
    // Prevent re-use of the same complete bank reference, regardless of customer, date or amount.
    // Legacy records only stored the last six digits, so conservatively block matching suffixes
    // while an old report is pending/approved; new reports compare the full reference exactly.
    const duplicate = await db.execute({
      sql: `SELECT id FROM payment_reports
        WHERE status IN ('pending_review','approved')
          AND (reference_full=? OR (reference_full IS NULL AND reference_last_six=?))
        LIMIT 1`,
      args: [referenceFull,referenceLastSix]
    });
    if (duplicate.rows.length) {
      return NextResponse.json({ error: "Ya existe un reporte con esa referencia, fecha, monto y cuenta receptora. Revisa el estado antes de enviarlo otra vez." }, { status: 409, headers: noStore });
    }
    const id = randomUUID();
    await db.execute({
      sql: `INSERT INTO payment_reports (id,product_id,plan_id,customer_type,first_name,last_name,legal_name,
        identity_document,tax_id,email,phone,amount,reference_last_six,reference_full,payment_date,source_bank,destination_bank_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id,productId,planId,customerType,firstName || null,lastName || null,legalName || null,
        identityDocument,taxId || null,email || null,phone,amount,referenceLastSix,referenceFull,paymentDate,sourceBank,destinationBankId]
    });
    await notifyAdminsPush({
      title: "CRM-SICOVEN · Nuevo reporte de pago",
      body: "Se recibió un reporte por " + amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ". Requiere verificación manual.",
      url: "/comercializacion"
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, reportId: id, status: "pending_review", message: "Reporte recibido. La licencia solo se emitirá después de verificar el pago." }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ error: "No fue posible registrar el reporte. Inténtalo de nuevo más tarde." }, { status: 503, headers: noStore });
  }
}
