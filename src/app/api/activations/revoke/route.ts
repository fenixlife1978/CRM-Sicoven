import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede revocar activaciones." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    const id = body && typeof body === "object" && "activationId" in body && typeof body.activationId === "string"
      ? body.activationId.trim() : "";
    if (!id || id.length > 100) return NextResponse.json({ error: "Identificador de activación inválido." }, { status: 400 });
    const db = getDb();
    const tx = await db.transaction("write");
    try {
      const found = await tx.execute({ sql: "SELECT id,license_id,status FROM activations WHERE id=? LIMIT 1", args: [id] });
      const activation = found.rows[0];
      if (!activation) {
        await tx.rollback();
        return NextResponse.json({ error: "No se encontró la activación." }, { status: 404 });
      }
      if (String(activation.status) !== "revoked") {
        await tx.execute({ sql: "UPDATE activations SET status='revoked',revoked_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
        await tx.execute({
          sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
          args: [randomUUID(),session.sub,"activation_revoked","activation",id,JSON.stringify({licenseId:String(activation.license_id)})]
        });
      }
      await tx.commit();
      return NextResponse.json({ ok: true, activationId: id, status: "revoked" });
    } catch (error) {
      await tx.rollback().catch(() => undefined);
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "No se pudo revocar la activación." }, { status: 503 });
  }
}
