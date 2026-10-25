import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function clean(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validLimits(durationDays: unknown, maxActivations: unknown, offlineDays: unknown) {
  const durationOk = durationDays === null || durationDays === "" || (Number.isInteger(Number(durationDays)) && Number(durationDays) >= 1 && Number(durationDays) <= 36500);
  // Match the database CHECK constraint: offline_days must be between 1 and 30.\n  const offlineOk = Number.isInteger(Number(offlineDays)) && Number(offlineDays) >= 1 && Number(offlineDays) <= 30;
  return durationOk && offlineOk && Number.isInteger(Number(maxActivations)) && Number(maxActivations) >= 1 && Number(maxActivations) <= 100;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute("SELECT id,name,duration_days,max_activations,offline_days,support_terms,update_terms,extra_activation_terms,terms,price_label,active,created_at,updated_at,billing_cycle,price_amount,currency,expansion_price,expansion_billing_cycle FROM license_types ORDER BY active DESC,name");
    return NextResponse.json({ licenseTypes: result.rows });
  } catch {
    return NextResponse.json({ error: "No se pudieron consultar los tipos de licencia." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede administrar planes." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const name = clean(data.name, 100);
    const durationDays = data.durationDays === null || data.durationDays === "" ? null : Number(data.durationDays);
    const maxActivations = Number(data.maxActivations ?? 1);
    const offlineDays = Number(data.offlineDays ?? 7);
    if (!name || !validLimits(durationDays, maxActivations, offlineDays)) {
      return NextResponse.json({ error: "Nombre, duración vitalicia o de 1–36500 días, días offline de 1–30 y cantidad de equipos de 1–100 no válidos." }, { status: 400 });
    }
    const billingCycle = ["once","monthly","yearly"].includes(String(data.billingCycle)) ? String(data.billingCycle) : "once";
    const priceAmount = Number(data.priceAmount ?? 0);
    const expansionPrice = Number(data.expansionPrice ?? 0);
    const expansionBillingCycle = ["once","monthly","yearly"].includes(String(data.expansionBillingCycle)) ? String(data.expansionBillingCycle) : "once";
    const currency = typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency) ? data.currency : "USD";
    if (!Number.isFinite(priceAmount) || priceAmount < 0 || !Number.isFinite(expansionPrice) || expansionPrice < 0) return NextResponse.json({ error: "Los precios deben ser importes no negativos." }, { status: 400 });
    const id = randomUUID();
    await getDb().execute({
      sql: `INSERT INTO license_types (id,name,duration_days,max_activations,offline_days,support_terms,update_terms,extra_activation_terms,terms,price_label,billing_cycle,price_amount,currency,expansion_price,expansion_billing_cycle)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id,name,durationDays,maxActivations,offlineDays,clean(data.supportTerms),clean(data.updateTerms),clean(data.extraActivationTerms),clean(data.terms),clean(data.priceLabel,100),billingCycle,priceAmount,currency,expansionPrice,expansionBillingCycle]
    });
    await getDb().execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
      args: [randomUUID(),session.sub,"license_type_created","license_type",id,JSON.stringify({name,durationDays,maxActivations,offlineDays})]
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /unique/i.test(error.message) ? "Ya existe un tipo de licencia con ese nombre." : "No se pudo guardar el tipo de licencia.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede administrar planes." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const id = clean(data.id, 100);
    const name = clean(data.name, 100);
    const durationDays = data.durationDays === null || data.durationDays === "" ? null : Number(data.durationDays);
    const maxActivations = Number(data.maxActivations);
    const offlineDays = Number(data.offlineDays ?? 7);
    const billingCycle = ["once","monthly","yearly"].includes(String(data.billingCycle)) ? String(data.billingCycle) : "once";
    const priceAmount = Number(data.priceAmount ?? 0);
    const expansionPrice = Number(data.expansionPrice ?? 0);
    const expansionBillingCycle = ["once","monthly","yearly"].includes(String(data.expansionBillingCycle)) ? String(data.expansionBillingCycle) : "once";
    const currency = typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency) ? data.currency : "USD";
    if (!id || !name || !validLimits(durationDays, maxActivations, offlineDays) || typeof data.active !== "boolean" ||
        !Number.isFinite(priceAmount) || priceAmount < 0 || !Number.isFinite(expansionPrice) || expansionPrice < 0) {
      return NextResponse.json({ error: "Datos de edición no válidos." }, { status: 400 });
    }
    await getDb().execute({
      sql: `UPDATE license_types SET name=?,duration_days=?,max_activations=?,offline_days=?,support_terms=?,update_terms=?,extra_activation_terms=?,terms=?,price_label=?,active=?,billing_cycle=?,price_amount=?,currency=?,expansion_price=?,expansion_billing_cycle=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      args: [name,durationDays,maxActivations,offlineDays,clean(data.supportTerms),clean(data.updateTerms),clean(data.extraActivationTerms),clean(data.terms),clean(data.priceLabel,100),data.active ? 1 : 0,billingCycle,priceAmount,currency,expansionPrice,expansionBillingCycle,id]
    });
    await getDb().execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
      args: [randomUUID(),session.sub,"license_type_updated","license_type",id,JSON.stringify({name,durationDays,maxActivations,offlineDays,active:data.active})]
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el tipo de licencia." }, { status: 400 });
  }
}
