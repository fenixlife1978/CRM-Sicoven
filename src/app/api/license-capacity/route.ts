import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
const kinds = new Set(["devices"]);
const cycles = new Set(["once", "monthly", "yearly"]);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const licenseId = request.nextUrl.searchParams.get("licenseId");
    if (!licenseId) return NextResponse.json({ error: "Falta licenseId." }, { status: 400 });
    const [changes, license] = await Promise.all([
      getDb().execute({ sql: "SELECT * FROM license_capacity_changes WHERE license_id=? ORDER BY created_at DESC", args: [licenseId] }),
      getDb().execute({ sql: "SELECT id,max_activations,billing_cycle,billing_amount,currency,next_billing_at,status FROM licenses WHERE id=? LIMIT 1", args: [licenseId] })
    ]);
    if (!license.rows[0]) return NextResponse.json({ error: "Licencia no encontrada." }, { status: 404 });
    return NextResponse.json({ changes: changes.rows, license: license.rows[0] });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la capacidad de la licencia." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede modificar licencias." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const licenseId = typeof data.licenseId === "string" ? data.licenseId.trim() : "";
    const kind = typeof data.capacityKind === "string" ? data.capacityKind : "";
    const newLimit = Number(data.newLimit);
    const mode = data.mode === "administrative" ? "administrative" : data.mode === "paid" ? "paid" : "";
    const cycle = typeof data.billingCycle === "string" ? data.billingCycle : "once";
    const price = Number(data.unitPrice ?? 0);
    const currency = typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency) ? data.currency : "USD";
    const notes = typeof data.notes === "string" ? data.notes.trim().slice(0, 1000) : "";
    if (!licenseId || !kinds.has(kind) || !Number.isInteger(newLimit) || newLimit < 1 || newLimit > 10000 || !mode ||
        !cycles.has(cycle) || !Number.isFinite(price) || price < 0 || (mode === "administrative" && (price !== 0 || cycle !== "once"))) {
      return NextResponse.json({ error: "Datos inválidos. La ampliación administrativa es gratuita; la comercial requiere ciclo y precio válidos." }, { status: 400 });
    }
    const db = getDb();
    const tx = await db.transaction("write");
    try {
      const found = await tx.execute({ sql: "SELECT id,max_activations,billing_cycle,billing_amount,currency,status FROM licenses WHERE id=? LIMIT 1", args: [licenseId] });
      const license = found.rows[0];
      if (!license) { await tx.rollback(); return NextResponse.json({ error: "Licencia no encontrada." }, { status: 404 }); }
      if (["revoked", "expired"].includes(String(license.status))) { await tx.rollback(); return NextResponse.json({ error: "No se puede ampliar una licencia vencida o revocada." }, { status: 409 }); }
      const previousLimit = kind === "devices" ? Number(license.max_activations) : Number((await tx.execute({ sql: "SELECT COALESCE(MAX(new_limit),0) AS limit_value FROM license_capacity_changes WHERE license_id=? AND capacity_kind=?", args: [licenseId,kind] })).rows[0]?.limit_value ?? 0);
      if (newLimit <= previousLimit) { await tx.rollback(); return NextResponse.json({ error: "El nuevo límite debe ser mayor al límite vigente. Esta operación solo amplía capacidad." }, { status: 400 }); }
      const changeId = randomUUID();
      const paymentStatus = mode === "administrative" ? "not_required" : "pending";
      await tx.execute({
        sql: "INSERT INTO license_capacity_changes (id,license_id,capacity_kind,previous_limit,new_limit,mode,billing_cycle,unit_price,currency,payment_status,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        args: [changeId,licenseId,kind,previousLimit,newLimit,mode,cycle,price,currency,paymentStatus,notes,session.sub]
      });
      if (kind === "devices") await tx.execute({ sql: "UPDATE licenses SET max_activations=? WHERE id=?", args: [newLimit,licenseId] });
      if (mode === "paid") {
        const amount = (newLimit - previousLimit) * price;
        const now = new Date();
        const end = new Date(now);
        if (cycle === "monthly") end.setMonth(end.getMonth() + 1);
        if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
        await tx.execute({
          sql: "INSERT INTO license_billing_records (id,license_id,record_type,amount,currency,billing_cycle,period_start,period_end,due_at,status,description,created_by) VALUES (?,?, 'capacity_expansion',?,?,?,?,?,?,'pending',?,?)",
          args: [randomUUID(),licenseId,amount,currency,cycle,now.toISOString(),cycle === "once" ? null : end.toISOString(),now.toISOString(),kind + ": " + previousLimit + " → " + newLimit,session.sub]
        });
      }
      await tx.execute({
        sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
        args: [randomUUID(),session.sub,"license_capacity_changed","license",licenseId,JSON.stringify({changeId,kind,previousLimit,newLimit,mode,cycle,price,currency})]
      });
      await tx.commit();
      return NextResponse.json({ ok: true, changeId, previousLimit, newLimit, amount: mode === "paid" ? (newLimit - previousLimit) * price : 0, currency, paymentStatus }, { status: 201 });
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la ampliación de capacidad." }, { status: 503 });
  }
}
