import { NextRequest, NextResponse } from "next/server";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Identificador de reporte requerido." }, { status: 400, headers: noStore });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `SELECT r.id, r.status, r.review_note, r.reviewed_at, r.created_at, r.amount, r.reference_last_six,
        r.payment_date, r.customer_type, r.first_name, r.last_name, r.legal_name, r.identity_document,
        r.certificate_json, p.name AS product_name, cp.name AS plan_name
        FROM payment_reports r
        LEFT JOIN products p ON p.id = r.product_id
        LEFT JOIN commercial_plans cp ON cp.id = r.plan_id
        WHERE r.id = ? LIMIT 1`,
      args: [id]
    });

    const report = result.rows[0];
    if (!report) {
      return NextResponse.json({ error: "No se encontró el reporte de pago especificado." }, { status: 404, headers: noStore });
    }

    const status = String(report.status);
    if (status === "pending_review") {
      return NextResponse.json({
        ok: true,
        status: "pending_review",
        reportId: String(report.id),
        message: "Tu pago está en proceso de verificación por el administrador.",
        amount: Number(report.amount),
        referenceLastSix: String(report.reference_last_six),
        paymentDate: String(report.payment_date),
        planName: String(report.plan_name || ""),
        productName: String(report.product_name || "")
      }, { headers: noStore });
    }

    if (status === "rejected") {
      return NextResponse.json({
        ok: true,
        status: "rejected",
        reportId: String(report.id),
        message: "El pago no pudo ser validado por la administración.",
        reviewNote: report.review_note ? String(report.review_note) : "Verificación de transferencia no conforme."
      }, { headers: noStore });
    }

    if (status === "approved") {
      let certificate = null;
      try {
        if (report.certificate_json) {
          certificate = JSON.parse(String(report.certificate_json));
        }
      } catch {
        certificate = null;
      }

      return NextResponse.json({
        ok: true,
        status: "approved",
        reportId: String(report.id),
        message: "¡Pago aprobado y licencia emitida con éxito!",
        reviewedAt: report.reviewed_at ? String(report.reviewed_at) : null,
        certificate
      }, { headers: noStore });
    }

    return NextResponse.json({ ok: false, error: "Estado desconocido." }, { status: 400, headers: noStore });
  } catch {
    return NextResponse.json({ error: "Error al consultar el certificado de licencia." }, { status: 500, headers: noStore });
  }
}
