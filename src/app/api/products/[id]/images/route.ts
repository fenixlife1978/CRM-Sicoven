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
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function GET(_request: NextRequest, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const result = await getDb().execute({
      sql: "SELECT id,url,alt_text,sort_order,created_at,media_type FROM product_images WHERE product_id=? ORDER BY sort_order,created_at",
      args: [id]
    });
    return NextResponse.json({ images: result.rows }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la galería." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  if (session.role === "viewer") return NextResponse.json({ error: "Tu perfil solo permite consultar." }, { status: 403, headers: noStore });
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const product = await getDb().execute({ sql: "SELECT id,name FROM products WHERE id=? AND status='active' LIMIT 1", args: [id] });
    if (!product.rows.length) return NextResponse.json({ error: "Producto no encontrado o inactivo." }, { status: 404, headers: noStore });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona una fotografía." }, { status: 400, headers: noStore });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Formato no permitido. Usa JPG, PNG, WebP o AVIF." }, { status: 400, headers: noStore });
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Cada imagen debe pesar como máximo 4 MB." }, { status: 400, headers: noStore });
    const altText = typeof form.get("altText") === "string" ? String(form.get("altText")).trim().slice(0, 180) : "";
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(-80) || "imagen";
    const blob = await put(`products/${id}/${randomUUID()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      cacheControlMaxAge: 60 * 60 * 24 * 30
    });
    const imageId = randomUUID();
    const db = getDb();
    const count = await db.execute({ sql: "SELECT COUNT(*) AS total FROM product_images WHERE product_id=?", args: [id] });
    const sortOrder = Number(count.rows[0]?.total || 0);
    await db.batch([
      { sql: "INSERT INTO product_images (id,product_id,url,pathname,alt_text,sort_order) VALUES (?,?,?,?,?,?)", args: [imageId,id,blob.url,blob.pathname,altText || String(product.rows[0].name),sortOrder] },
      { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"product_image_uploaded","product",id,JSON.stringify({ imageId, contentType: file.type, size: file.size })] }
    ], "write");
    return NextResponse.json({ ok: true, image: { id: imageId, url: blob.url, alt_text: altText || String(product.rows[0].name), sort_order: sortOrder } }, { status: 201, headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message.includes("BLOB") ? "El almacenamiento de imágenes no está configurado. Verifica la conexión de Vercel Blob." : "No se pudo subir la imagen. Verifica la conexión del almacenamiento e inténtalo de nuevo." }, { status: 503, headers: noStore });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  if (session.role === "viewer") return NextResponse.json({ error: "Tu perfil solo permite consultar." }, { status: 403, headers: noStore });
  try {
    await bootstrapDatabase();
    const { id } = await context.params;
    const body = await request.json() as { imageId?: unknown };
    const imageId = typeof body.imageId === "string" ? body.imageId : "";
    const db = getDb();
    const result = await db.execute({ sql: "SELECT id,url,media_type FROM product_images WHERE id=? AND product_id=? LIMIT 1", args: [imageId,id] });
    if (!result.rows.length) return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404, headers: noStore });
    await del(String(result.rows[0].url));
    await db.batch([
      { sql: "DELETE FROM product_images WHERE id=? AND product_id=?", args: [imageId,id] },
      { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,String(result.rows[0].media_type)==="video"?"product_video_deleted":"product_image_deleted","product",id,JSON.stringify({ imageId, mediaType: result.rows[0].media_type || "image" })] }
    ], "write");
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la imagen." }, { status: 503, headers: noStore });
  }
}
