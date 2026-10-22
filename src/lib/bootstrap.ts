import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ensureSchema, getDb } from "@/lib/db";

let bootstrapPromise: Promise<void> | undefined;

export async function bootstrapDatabase() {
  if (!bootstrapPromise) bootstrapPromise = runBootstrap().catch((error) => { bootstrapPromise = undefined; throw error; });
  return bootstrapPromise;
}

async function runBootstrap() {
  await ensureSchema();
  const email = process.env.CRM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.CRM_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error("CRM_ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  const db = getDb();
  const existing = await db.execute({ sql: "SELECT id FROM crm_users WHERE email = ? LIMIT 1", args: [email] });
  if (existing.rows.length) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await db.execute({ sql: "INSERT INTO crm_users (id,email,password_hash,role,active) VALUES (?,?,?,'admin',1)", args: [randomUUID(), email, passwordHash] });
}
