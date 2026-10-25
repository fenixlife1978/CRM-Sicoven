import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
function field(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, max) : null;
}

export async function PATCH(request: NextRequest, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role === "viewer") return NextResponse.json({ error: "Tu perfil solo permite consultar." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    const name = field(data.name, 160);
    if (!name) return NextResponse.json({ error: "El nombre del producto es obligatorio." }, { status: 400 });
    const edition = field(data.edition, 100);
    const version = field(data.version, 60);
    const description = field(data.description, 1000);
    const db = getDb();
    const result = await db.execute({ sql: "UPDATE products SET name=?,edition=?,version=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'", args: [name, edition, version, description, id] });
    if (!result.rowsAffected) return NextResponse.json({ error: "Producto no encontrado o inactivo." }, { status: 404 });
    await db.execute({ sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(), session.sub, "product_updated", "product", id, JSON.stringify({ name, edition, version })] });
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el producto." }, { status: 503 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role === "viewer") return NextResponse.json({ error: "Tu perfil solo permite consultar." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const db = getDb();
    const product = await db.execute({ sql: "SELECT id,name,status FROM products WHERE id=?", args: [id] });
    if (!product.rows.length) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    const linked = await db.execute({ sql: "SELECT (SELECT COUNT(*) FROM licenses WHERE product_id=?) + (SELECT COUNT(*) FROM commercial_plans WHERE product_id=?) + (SELECT COUNT(*) FROM payment_reports WHERE product_id=?) AS total", args: [id,id,id] });
    const hasLinks = Number(linked.rows[0]?.total ?? 0) > 0;
    if (hasLinks) {
      await db.execute({ sql: "UPDATE products SET status='inactive',updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
    } else {
      await db.execute({ sql: "DELETE FROM products WHERE id=?", args: [id] });
    }
    await db.execute({ sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(), session.sub, hasLinks ? "product_deactivated" : "product_deleted", "product", id, JSON.stringify({ name: product.rows[0].name, linkedRecords: Number(linked.rows[0]?.total ?? 0) })] });
    return NextResponse.json({ ok: true, archived: hasLinks });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el producto." }, { status: 503 });
  }
}
