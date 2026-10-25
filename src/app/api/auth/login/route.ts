import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_FAILURES = 8;
const IP_WINDOW_SECONDS = 15 * 60;
const IP_MAX_FAILURES = 30;

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
    const now = Math.floor(Date.now() / 1000);

    // Prefer Vercel's x-real-ip; do not trust arbitrary X-Forwarded-For chains.
    // Hash the address so raw client IPs are not persisted.
    const clientIp = request.headers.get("x-real-ip")?.trim();
    const ipHash = clientIp && clientIp.length <= 100
      ? createHash("sha256").update(clientIp).digest("hex")
      : null;
    if (ipHash) {
      const ipResult = await db.execute({
        sql: "SELECT attempts,window_started_at,blocked_until FROM auth_login_ip_attempts WHERE ip_hash=? LIMIT 1",
        args: [ipHash]
      });
      let ipAttempts: (typeof ipResult.rows)[number] | undefined = ipResult.rows[0];
      if (ipAttempts && now - Number(ipAttempts.window_started_at) >= IP_WINDOW_SECONDS) {
        await db.execute({ sql: "DELETE FROM auth_login_ip_attempts WHERE ip_hash=?", args: [ipHash] });
        ipAttempts = undefined;
      }
      if (ipAttempts && ipAttempts.blocked_until != null && Number(ipAttempts.blocked_until) > now) {
        const retryAfter = Math.max(1, Number(ipAttempts.blocked_until) - now);
        return NextResponse.json(
          { error: "Demasiados intentos desde esta conexión. Espera antes de volver a intentarlo." },
          { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
        );
      }
    }

    // Persisted per-account throttling works across serverless instances and restarts.
    const attemptsResult = await db.execute({
      sql: "SELECT attempts,window_started_at,blocked_until FROM auth_login_attempts WHERE email=? LIMIT 1",
      args: [normalizedEmail]
    });
    let attempts: (typeof attemptsResult.rows)[number] | undefined = attemptsResult.rows[0];
    if (attempts && now - Number(attempts.window_started_at) >= LOGIN_WINDOW_SECONDS) {
      await db.execute({ sql: "DELETE FROM auth_login_attempts WHERE email=?", args: [normalizedEmail] });
      attempts = undefined;
    }
    if (attempts && attempts.blocked_until != null && Number(attempts.blocked_until) > now) {
      const retryAfter = Math.max(1, Number(attempts.blocked_until) - now);
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Espera antes de volver a intentarlo." },
        { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
      );
    }

    const result = await db.execute({
      sql: "SELECT id,email,password_hash,role,active FROM crm_users WHERE email = ? LIMIT 1",
      args: [normalizedEmail]
    });
    const user = result.rows[0];
    const valid = !!user && Number(user.active) === 1 && await bcrypt.compare(password, String(user.password_hash));
    if (!valid) {
      if (ipHash) {
        await db.execute({
          sql: `INSERT INTO auth_login_ip_attempts (ip_hash,attempts,window_started_at,blocked_until)
                VALUES (?,1,?,NULL)
                ON CONFLICT(ip_hash) DO UPDATE SET
                  attempts=CASE
                    WHEN ? - auth_login_ip_attempts.window_started_at >= ${IP_WINDOW_SECONDS} THEN 1
                    ELSE auth_login_ip_attempts.attempts+1
                  END,
                  window_started_at=CASE
                    WHEN ? - auth_login_ip_attempts.window_started_at >= ${IP_WINDOW_SECONDS} THEN ?
                    WHEN auth_login_ip_attempts.attempts+1 >= ${IP_MAX_FAILURES} THEN ?
                    ELSE auth_login_ip_attempts.window_started_at
                  END,
                  blocked_until=CASE
                    WHEN ? - auth_login_ip_attempts.window_started_at >= ${IP_WINDOW_SECONDS} THEN NULL
                    WHEN auth_login_ip_attempts.attempts+1 >= ${IP_MAX_FAILURES} THEN ?+${IP_WINDOW_SECONDS}
                    ELSE auth_login_ip_attempts.blocked_until
                  END`,
          args: [ipHash, now, now, now, now, now, now, now]
        });
      }
      await db.execute({
        sql: `INSERT INTO auth_login_attempts (email,attempts,window_started_at,blocked_until)
              VALUES (?,1,?,NULL)
              ON CONFLICT(email) DO UPDATE SET
                attempts=auth_login_attempts.attempts+1,
                window_started_at=CASE
                  WHEN auth_login_attempts.attempts+1 >= ${LOGIN_MAX_FAILURES} THEN ?
                  ELSE auth_login_attempts.window_started_at
                END,
                blocked_until=CASE
                  WHEN auth_login_attempts.attempts+1 >= ${LOGIN_MAX_FAILURES} THEN ?+${LOGIN_WINDOW_SECONDS}
                  ELSE auth_login_attempts.blocked_until
                END`,
        args: [normalizedEmail, now, now, now]
      });
      await db.execute({
        sql: "INSERT INTO audit_log (id,user_id,action,entity_type,metadata_json) VALUES (?,?,?,?,?)",
        args: [randomUUID(), user ? String(user.id) : null, "login_failed", "auth", JSON.stringify({ email: normalizedEmail })]
      });
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    await db.execute({ sql: "DELETE FROM auth_login_attempts WHERE email=?", args: [normalizedEmail] });
    const session = { sub: String(user.id), email: String(user.email), role: String(user.role) as "admin" | "operator" | "viewer" };
    await createSession(session);
    await db.execute({
      sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id) VALUES (?,?,?,?,?)",
      args: [randomUUID(), session.sub, "login_success", "auth", session.sub]
    });
    return NextResponse.json({ ok: true, user: { email: session.email, role: session.role } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar sesión. Verifica la configuración del servidor." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
