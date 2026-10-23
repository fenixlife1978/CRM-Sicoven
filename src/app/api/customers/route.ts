import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function clean(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/\s+/g, " ");
  return result ? result.slice(0, max) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
    const result = query
      ? await getDb().execute({
          sql: `SELECT id,type,display_name,identity_document,tax_id,email,phone,status,created_at
                FROM customers
                WHERE display_name LIKE ? OR identity_document LIKE ? OR tax_id LIKE ? OR email LIKE ?
                ORDER BY display_name LIMIT 100`,
          args: [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
        })
      : await getDb().execute({
          sql: "SELECT id,type,display_name,identity_document,tax_id,email,phone,status,created_at FROM customers ORDER BY created_at DESC LIMIT 100"
        });
    return NextResponse.json({ customers: result.rows });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la lista de clientes." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role === "viewer") return NextResponse.json({ error: "Tu perfil solo permite consultar." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const type = data.type;
    if (type !== "person" && type !== "company") return NextResponse.json({ error: "Selecciona persona natural o empresa." }, { status: 400 });

    const email = clean(data.email, 254)?.toLowerCase() ?? null;
    const phone = clean(data.phone, 40);
    const address = clean(data.address, 500);
    const notes = clean(data.notes, 2000);
    const identityDocument = clean(data.identityDocument, 40)?.toUpperCase() ?? null;
    const personalTaxId = clean(data.personalTaxId, 40)?.toUpperCase() ?? null;
    const taxId = clean(data.taxId, 40)?.toUpperCase() ?? null;
    const firstName = clean(data.firstName, 100);
    const lastName = clean(data.lastName, 100);
    const legalName = clean(data.legalName, 200);
    const tradeName = clean(data.tradeName, 200);
    const legalRepresentative = clean(data.legalRepresentative, 200);
    const profession = clean(data.profession, 150);

    let displayName: string;
    if (type === "person") {
      if (!firstName || !lastName || !identityDocument) return NextResponse.json({ error: "Para una persona son obligatorios nombres, apellidos y cédula." }, { status: 400 });
      displayName = `${firstName} ${lastName}`;
    } else {
      if (!legalName || !taxId) return NextResponse.json({ error: "Para una empresa son obligatorios razón social y RIF." }, { status: 400 });
      displayName = legalName;
    }

    const id = randomUUID();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO customers
        (id,type,display_name,first_name,last_name,identity_document,personal_tax_id,legal_name,tax_id,trade_name,legal_representative,email,phone,address,notes,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id,type,displayName,firstName,lastName,identityDocument,personalTaxId,legalName,taxId,tradeName,legalRepresentative,email,phone,address,
        [notes, profession ? `Actividad/profesión: ${profession}` : null].filter(Boolean).join("\n") || null, session.sub]
    });
    await db.execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id) VALUES (?,?,?,?,?)",
      args: [randomUUID(), session.sub, "customer_created", "customer", id]
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE constraint failed/i.test(message)) {
      return NextResponse.json({ error: "Ya existe un cliente con esa cédula o RIF." }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo guardar el cliente." }, { status: 503 });
  }
}
