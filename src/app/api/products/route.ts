import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function field(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, max) : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute({
      sql: "SELECT p.id,p.name,p.edition,p.version,p.description,p.status,p.created_at,(SELECT COUNT(*) FROM licenses l WHERE l.product_id=p.id) AS license_count FROM products p ORDER BY p.name LIMIT 250"
    });
    return NextResponse.json({ products: result.rows });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar el catálogo." }, { status: 503 });
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
    const name = field(data.name, 160);
    const edition = field(data.edition, 100);
    const version = field(data.version, 60);
    const description = field(data.description, 1000);
    if (!name) return NextResponse.json({ error: "El nombre del producto es obligatorio." }, { status: 400 });
    const id = randomUUID();
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO products (id,name,edition,version,description) VALUES (?,?,?,?,?)",
      args: [id,name,edition,version,description]
    });
    await db.execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
      args: [randomUUID(),session.sub,"product_created","product",id,JSON.stringify({name,edition,version})]
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el producto." }, { status: 503 });
  }
}
