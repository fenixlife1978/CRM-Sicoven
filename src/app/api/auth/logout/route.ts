import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "No se pudo cerrar la sesión. Intenta nuevamente." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
