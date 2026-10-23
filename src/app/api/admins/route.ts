import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
const SEED_EMAIL = "admin@sicoven.local";

async function requireAdmin() {
  const session = await getSession();
  return session?.role === "admin" ? session : null;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute(
      "SELECT id,email,role,active,created_at FROM crm_users ORDER BY created_at ASC"
    );
    return NextResponse.json({
      users: result.rows.map(row => ({
        id: String(row.id), email: String(row.email), role: String(row.role),
        active: Number(row.active) === 1, createdAt: String(row.created_at),
        isSeed: String(row.email).toLowerCase() === SEED_EMAIL ||
          String(row.email).toLowerCase() === process.env.CRM_ADMIN_EMAIL?.trim().toLowerCase()
      }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No fue posible consultar los administradores." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const { email, password } = body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 12 || password.length > 1024) {
      return NextResponse.json({ error: "Introduce un correo válido y una contraseña de al menos 12 caracteres." }, { status: 400 });
    }
    await bootstrapDatabase();
    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.execute({ sql: "SELECT id FROM crm_users WHERE email=? LIMIT 1", args: [normalizedEmail] });
    if (existing.rows.length) return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute({
      sql: "INSERT INTO crm_users (id,email,password_hash,role,active) VALUES (?,?,?,'admin',1)",
      args: [id, normalizedEmail, passwordHash]
    });
    await db.execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
      args: [randomUUID(), session.sub, "admin_created", "user", id, JSON.stringify({ email: normalizedEmail })]
    });
    return NextResponse.json({ ok: true, id, email: normalizedEmail }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No fue posible crear el administrador." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
      return NextResponse.json({ error: "Selecciona el administrador inicial." }, { status: 400 });
    }
    const id = (body as { id: string }).id;
    const db = getDb();
    await bootstrapDatabase();
    const targetResult = await db.execute({ sql: "SELECT id,email,role FROM crm_users WHERE id=? LIMIT 1", args: [id] });
    const target = targetResult.rows[0];
    const seedEmail = process.env.CRM_ADMIN_EMAIL?.trim().toLowerCase() || SEED_EMAIL;
    if (!target || String(target.role) !== "admin" || String(target.email).toLowerCase() !== seedEmail) {
      return NextResponse.json({ error: "Solo se puede eliminar la cuenta de administrador inicial." }, { status: 400 });
    }
    if (String(target.id) === session.sub) {
      return NextResponse.json({ error: "Inicia sesión con el segundo administrador para eliminar la cuenta inicial." }, { status: 400 });
    }
    const count = await db.execute("SELECT COUNT(*) AS total FROM crm_users WHERE role='admin' AND active=1");
    if (Number(count.rows[0]?.total ?? 0) < 2) {
      return NextResponse.json({ error: "Primero crea y verifica un segundo administrador activo." }, { status: 409 });
    }
    // Preserve foreign-key integrity and historical business records when retiring the seed account.
    await db.batch([
      { sql: "UPDATE customers SET created_by=? WHERE created_by=?", args: [session.sub, id] },
      { sql: "UPDATE licenses SET created_by=? WHERE created_by=?", args: [session.sub, id] },
      { sql: "UPDATE audit_log SET user_id=NULL WHERE user_id=?", args: [id] },
      { sql: "DELETE FROM crm_users WHERE id=?", args: [id] }
    ], "write");
    await db.execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
      args: [randomUUID(), session.sub, "seed_admin_deleted", "user", id, JSON.stringify({ email: String(target.email) })]
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No fue posible eliminar el administrador inicial." }, { status: 500 });
  }
}
