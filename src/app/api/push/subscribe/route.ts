import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para activar las notificaciones." }, { status: 401, headers: noStore });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede recibir estas notificaciones." }, { status: 403, headers: noStore });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Suscripción inválida." }, { status: 400, headers: noStore });
    const subscription = (body as Record<string, unknown>).subscription;
    if (!subscription || typeof subscription !== "object") return NextResponse.json({ error: "Suscripción inválida." }, { status: 400, headers: noStore });
    const value = subscription as Record<string, unknown>;
    if (typeof value.endpoint !== "string" || !value.endpoint.startsWith("https://") || !value.keys || typeof value.keys !== "object") {
      return NextResponse.json({ error: "El navegador no entregó una suscripción PUSH válida." }, { status: 400, headers: noStore });
    }
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO admin_push_subscriptions (id,user_id,endpoint,subscription_json)
        VALUES (?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET
        user_id=excluded.user_id,subscription_json=excluded.subscription_json,updated_at=CURRENT_TIMESTAMP`,
      args: [randomUUID(), session.sub, value.endpoint, JSON.stringify(value)]
    });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la suscripción PUSH." }, { status: 503, headers: noStore });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: noStore });
  if (session.role !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers: noStore });
  try {
    const body: unknown = await request.json();
    const endpoint = body && typeof body === "object" && typeof (body as Record<string, unknown>).endpoint === "string"
      ? String((body as Record<string, unknown>).endpoint) : "";
    if (!endpoint) return NextResponse.json({ error: "Falta el endpoint." }, { status: 400, headers: noStore });
    await bootstrapDatabase();
    await getDb().execute({ sql: "DELETE FROM admin_push_subscriptions WHERE endpoint=? AND user_id=?", args: [endpoint, session.sub] });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "No se pudo desactivar la suscripción PUSH." }, { status: 503, headers: noStore });
  }
}
