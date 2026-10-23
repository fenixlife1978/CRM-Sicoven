import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const { email, password } = body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password || email.length > 254 || password.length > 1024) {
      return NextResponse.json({ error: "Introduce correo y contraseña." }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT id,email,password_hash,role,active FROM crm_users WHERE email = ? LIMIT 1",
      args: [normalizedEmail]
    });
    const user = result.rows[0];
    const valid = !!user && Number(user.active) === 1 && await bcrypt.compare(password, String(user.password_hash));
    if (!valid) {
      await db.execute({
        sql: "INSERT INTO audit_log (id,user_id,action,entity_type,metadata_json) VALUES (?,?,? ,?,?)",
        args: [randomUUID(), user ? String(user.id) : null, "login_failed", "auth", JSON.stringify({ email: normalizedEmail })]
      });
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }
    const session = { sub: String(user.id), email: String(user.email), role: String(user.role) as "admin" | "operator" | "viewer" };
    await createSession(session);
    await db.execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id) VALUES (?,?,?,?,?)",
      args: [randomUUID(), session.sub, "login_success", "auth", session.sub]
    });
    return NextResponse.json({ ok: true, user: { email: session.email, role: session.role } });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar sesión. Verifica la configuración del servidor." }, { status: 503 });
  }
}
