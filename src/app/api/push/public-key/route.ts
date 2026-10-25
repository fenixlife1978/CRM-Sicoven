import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ error: "Las notificaciones PUSH aún no están configuradas en el servidor." }, { status: 503 });
  return NextResponse.json({ publicKey: key }, { headers: { "Cache-Control": "no-store" } });
}
