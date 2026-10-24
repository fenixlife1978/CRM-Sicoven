import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const licenseId = request.nextUrl.searchParams.get("licenseId");
    const result = licenseId
      ? await getDb().execute({ sql: "SELECT * FROM license_billing_records WHERE license_id=? ORDER BY created_at DESC", args: [licenseId] })
      : await getDb().execute("SELECT * FROM license_billing_records ORDER BY created_at DESC LIMIT 500");
    return NextResponse.json({ billingRecords: result.rows });
  } catch {
    return NextResponse.json({ error: "No se pudieron consultar los cargos." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede gestionar cobros." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const action = data.action;
    const db = getDb();
    if (action === "mark-paid") {
      const id = typeof data.id === "string" ? data.id : "";
      if (!id) return NextResponse.json({ error: "Falta el identificador del cargo." }, { status: 400 });
      const result = await db.execute({ sql: "UPDATE license_billing_records SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','overdue')", args: [id] });
      if (result.rowsAffected === 0) return NextResponse.json({ error: "Cargo no encontrado o ya procesado." }, { status: 404 });
      await db.execute({ sql: "UPDATE license_capacity_changes SET payment_status='paid' WHERE id=(SELECT json_extract(metadata_json,'$.changeId') FROM audit_log WHERE action='license_capacity_changed' AND entity_id=(SELECT license_id FROM license_billing_records WHERE id=?) ORDER BY created_at DESC LIMIT 1) AND payment_status='pending'", args: [id] }).catch(() => undefined);
      await db.execute({ sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"billing_marked_paid","billing_record",id,JSON.stringify({paidAt:new Date().toISOString()})] });
      return NextResponse.json({ ok: true });
    }
    const licenseId = typeof data.licenseId === "string" ? data.licenseId : "";
    const amount = Number(data.amount);
    const cycle = typeof data.billingCycle === "string" ? data.billingCycle : "";
    const currency = typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency) ? data.currency : "USD";
    const description = typeof data.description === "string" ? data.description.trim().slice(0,500) : "Cargo manual";
    if (!licenseId || !Number.isFinite(amount) || amount < 0 || !["once","monthly","yearly"].includes(cycle)) return NextResponse.json({ error: "Licencia, importe y periodicidad son obligatorios." }, { status: 400 });
    const license = await db.execute({ sql: "SELECT id FROM licenses WHERE id=? LIMIT 1", args: [licenseId] });
    if (!license.rows[0]) return NextResponse.json({ error: "Licencia no encontrada." }, { status: 404 });
    const now = new Date();
    const end = new Date(now);
    if (cycle === "monthly") end.setMonth(end.getMonth()+1);
    if (cycle === "yearly") end.setFullYear(end.getFullYear()+1);
    const id = randomUUID();
    await db.execute({
      sql: "INSERT INTO license_billing_records (id,license_id,record_type,amount,currency,billing_cycle,period_start,period_end,due_at,status,description,created_by) VALUES (?,?, 'adjustment',?,?,?,?,?,?,'pending',?,?)",
      args: [id,licenseId,amount,currency,cycle,now.toISOString(),cycle === "once" ? null : end.toISOString(),now.toISOString(),description,session.sub]
    });
    await db.execute({ sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"billing_record_created","billing_record",id,JSON.stringify({licenseId,amount,currency,cycle})] });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el cargo." }, { status: 503 });
  }
}
