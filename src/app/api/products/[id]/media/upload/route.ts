import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const videoTypes = ["video/mp4", "video/webm", "video/quicktime"];
const noStore = { "Cache-Control": "no-store" };
type UploadPayload = { productId: string; mediaType: "image" | "video"; altText: string; userId: string };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getSession();
        if (!session) throw new Error("Debes iniciar sesión para subir archivos.");
        if (session.role === "viewer") throw new Error("Tu perfil solo permite consultar.");
        let payload: Omit<UploadPayload, "userId">;
        try { payload = JSON.parse(clientPayload || "") as Omit<UploadPayload, "userId">; }
        catch { throw new Error("Datos de carga inválidos."); }
        const productId = typeof payload.productId === "string" ? payload.productId : "";
        const mediaType = payload.mediaType;
        const allowedContentTypes = mediaType === "video" ? videoTypes : imageTypes;
        if (!productId || !["image", "video"].includes(mediaType)) throw new Error("Producto o tipo de archivo inválido.");
        if (!pathname.startsWith(`products/${productId}/`)) throw new Error("La ruta de almacenamiento no corresponde al producto.");
        await bootstrapDatabase();
        const product = await getDb().execute({ sql: "SELECT id FROM products WHERE id=? AND status='active' LIMIT 1", args: [productId] });
        if (!product.rows.length) throw new Error("Producto no encontrado o inactivo.");
        return {
          allowedContentTypes,
          maximumSizeInBytes: mediaType === "video" ? 200 * 1024 * 1024 : 15 * 1024 * 1024,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
          tokenPayload: JSON.stringify({
            productId,
            mediaType,
            altText: typeof payload.altText === "string" ? payload.altText.slice(0, 180) : "",
            userId: session.sub
          } satisfies UploadPayload)
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || "{}") as UploadPayload;
        const allowed = payload.mediaType === "video" ? videoTypes : imageTypes;
        if (!payload.productId || !payload.userId || !allowed.includes(blob.contentType || "")) {
          await del(blob.url);
          throw new Error("El archivo recibido no coincide con el tipo autorizado.");
        }
        await bootstrapDatabase();
        const db = getDb();
        const product = await db.execute({ sql: "SELECT id,name FROM products WHERE id=? AND status='active' LIMIT 1", args: [payload.productId] });
        if (!product.rows.length) {
          await del(blob.url);
          throw new Error("El producto ya no está disponible.");
        }
        const count = await db.execute({ sql: "SELECT COUNT(*) AS total FROM product_images WHERE product_id=?", args: [payload.productId] });
        const mediaId = randomUUID();
        const sortOrder = Number(count.rows[0]?.total || 0);
        await db.batch([
          { sql: "INSERT INTO product_images (id,product_id,url,pathname,alt_text,sort_order,media_type) VALUES (?,?,?,?,?,?,?)", args: [mediaId,payload.productId,blob.url,blob.pathname,payload.altText || String(product.rows[0].name),sortOrder,payload.mediaType] },
          { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),payload.userId,payload.mediaType === "video" ? "product_video_uploaded" : "product_image_uploaded","product",payload.productId,JSON.stringify({ mediaId, contentType: blob.contentType, size: blob.size, pathname: blob.pathname })] }
        ], "write");
      }
    });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo autorizar la carga multimedia." },
      { status: 400, headers: noStore }
    );
  }
}
