import { NextResponse } from "next/server";
import { bootstrapDatabase } from "@/lib/bootstrap";

export const runtime = "nodejs";
export async function GET() {
  try {
    await bootstrapDatabase();
    return NextResponse.json({ ok: true, service: "crm-sicoven", database: "connected" });
  } catch {
    return NextResponse.json({ ok: false, service: "crm-sicoven", database: "unavailable", message: "Configura las variables de entorno y verifica la conexión a la base de datos." }, { status: 503 });
  }
}
