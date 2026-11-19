import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "no-store" };
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: NextRequest, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede cambiar la identidad visual." }, { status: 403, headers: noStore });
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const form = await request.formData();
    const kind = String(form.get("kind") || "");
    const file = form.get("file");
    if (kind !== "logo" && kind !== "icon") return NextResponse.json({ error: "Tipo de imagen inválido." }, { status: 400, headers: noStore });
    if (!(file instanceof File) || !allowed.has(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Usa JPG, PNG, WebP o AVIF de hasta 5 MB." }, { status: 400, headers: noStore });
    }
    const db = getDb();
    const product = await db.execute({ sql: "SELECT id,logo_url,icon_url FROM products WHERE id=? AND status='active' LIMIT 1", args: [id] });
    if (!product.rows.length) return NextResponse.json({ error: "Producto no encontrado o inactivo." }, { status: 404, headers: noStore });
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(-80) || (kind === "logo" ? "logo" : "icon");
    const blob = await put(`products/${id}/branding/${kind}-${randomUUID()}-${safeName}`, file, {
      access: "public", addRandomSuffix: true, contentType: file.type, cacheControlMaxAge: 60 * 60 * 24 * 30
    });
    const column = kind === "logo" ? "logo_url" : "icon_url";
    const oldUrl = product.rows[0][column] == null ? "" : String(product.rows[0][column]);
    try {
      await db.batch([
        { sql: `UPDATE products SET ${column}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, args: [blob.url,id] },
        { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,kind === "logo" ? "product_logo_updated" : "product_icon_updated","product",id,JSON.stringify({ pathname: blob.pathname, contentType: file.type, size: file.size })] }
      ], "write");
    } catch (error) {
      await del(blob.url);
      throw error;
    }
    if (oldUrl) { try { await del(oldUrl); } catch { /* Preserve the new reference if old blob cleanup fails. */ } }
    return NextResponse.json({ ok: true, kind, url: blob.url }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la imagen. Verifica la conexión de Vercel Blob." }, { status: 503, headers: noStore });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede cambiar la identidad visual." }, { status: 403, headers: noStore });
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const body = await request.json() as { kind?: unknown };
    const kind = body.kind === "logo" || body.kind === "icon" ? body.kind : "";
    if (!kind) return NextResponse.json({ error: "Tipo de imagen inválido." }, { status: 400, headers: noStore });
    const column = kind === "logo" ? "logo_url" : "icon_url";
    const db = getDb();
    const product = await db.execute({ sql: `SELECT ${column} FROM products WHERE id=? AND status='active' LIMIT 1`, args: [id] });
    if (!product.rows.length) return NextResponse.json({ error: "Producto no encontrado o inactivo." }, { status: 404, headers: noStore });
    const oldUrl = product.rows[0][column] == null ? "" : String(product.rows[0][column]);
    await db.batch([
      { sql: `UPDATE products SET ${column}=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`, args: [id] },
      { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,kind === "logo" ? "product_logo_deleted" : "product_icon_deleted","product",id,JSON.stringify({ kind })] }
    ], "write");
    if (oldUrl) { try { await del(oldUrl); } catch { /* The database reference is already removed. */ } }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la imagen." }, { status: 503, headers: noStore });
  }
}
