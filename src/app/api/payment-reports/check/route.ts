import { NextRequest, NextResponse } from "next/server";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    await bootstrapDatabase();
    const body = await request.json().catch(() => ({}));
    const identityDocument = typeof body.identityDocument === "string" ? body.identityDocument.trim().toUpperCase() : "";
    const referenceLastSix = typeof body.referenceLastSix === "string" ? body.referenceLastSix.trim() : "";

    // Do not expose payment details or certificates by report ID alone.
    if (!identityDocument || !/^\d{6}$/.test(referenceLastSix)) {
      return NextResponse.json({ error: "Ingresa la Cédula/RIF y los últimos 6 dígitos de referencia." }, { status: 400, headers: noStore });
    }

    const db = getDb();
    const querySql = `SELECT r.id, r.status, r.review_note, r.reviewed_at, r.created_at, r.amount, r.reference_last_six,
        r.payment_date, r.customer_type, r.first_name, r.last_name, r.legal_name, r.identity_document,
        r.certificate_json, p.name AS product_name, cp.name AS plan_name
        FROM payment_reports r
        LEFT JOIN products p ON p.id = r.product_id
        LEFT JOIN commercial_plans cp ON cp.id = r.plan_id
        WHERE (UPPER(r.identity_document) = ? OR UPPER(r.tax_id) = ?) AND r.reference_last_six = ?
        ORDER BY r.created_at DESC LIMIT 1`;
    const queryArgs: (string | number)[] = [identityDocument, identityDocument, referenceLastSix];

    const result = await db.execute({ sql: querySql, args: queryArgs });
    const report = result.rows[0];

    if (!report) {
      return NextResponse.json({ error: "No se encontró ningún reporte con los datos ingresados." }, { status: 404, headers: noStore });
    }

    const status = String(report.status);
    let certificate = null;
    if (status === "approved" && report.certificate_json) {
      try {
        certificate = JSON.parse(String(report.certificate_json));
      } catch {
        certificate = null;
      }
    }

    return NextResponse.json({
      ok: true,
      status,
      reportId: String(report.id),
      productName: String(report.product_name || "SICOVEN"),
      planName: String(report.plan_name || "Licencia"),
      amount: Number(report.amount),
      referenceLastSix: String(report.reference_last_six),
      paymentDate: String(report.payment_date),
      reviewNote: report.review_note ? String(report.review_note) : null,
      reviewedAt: report.reviewed_at ? String(report.reviewed_at) : null,
      certificate
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Error al consultar el estado de la licencia." }, { status: 500, headers: noStore });
  }
}
