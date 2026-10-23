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
  return durationOk && Number.isInteger(Number(maxActivations)) && Number(maxActivations) >= 1 && Number(maxActivations) <= 100
    && Number.isInteger(Number(offlineDays)) && Number(offlineDays) >= 1 && Number(offlineDays) <= 30;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute("SELECT * FROM license_types ORDER BY active DESC,name");
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
      return NextResponse.json({ error: "Nombre, duración (vitalicia o 1–36500 días), equipos (1–100) y días offline (1–30) no válidos." }, { status: 400 });
    }
    const id = randomUUID();
    await getDb().execute({
      sql: `INSERT INTO license_types (id,name,duration_days,max_activations,offline_days,support_terms,update_terms,extra_activation_terms,terms,price_label)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [id,name,durationDays,maxActivations,offlineDays,clean(data.supportTerms),clean(data.updateTerms),clean(data.extraActivationTerms),clean(data.terms),clean(data.priceLabel,100)]
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
    const offlineDays = Number(data.offlineDays);
    if (!id || !name || !validLimits(durationDays, maxActivations, offlineDays) || typeof data.active !== "boolean") {
      return NextResponse.json({ error: "Datos de edición no válidos." }, { status: 400 });
    }
    await getDb().execute({
      sql: `UPDATE license_types SET name=?,duration_days=?,max_activations=?,offline_days=?,support_terms=?,update_terms=?,extra_activation_terms=?,terms=?,price_label=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      args: [name,durationDays,maxActivations,offlineDays,clean(data.supportTerms),clean(data.updateTerms),clean(data.extraActivationTerms),clean(data.terms),clean(data.priceLabel,100),data.active ? 1 : 0,id]
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
