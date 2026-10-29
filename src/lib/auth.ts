import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

const COOKIE_NAME = "crm_sicoven_session";
const SESSION_SECONDS = 60 * 60 * 8;

function secretKey() {
  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "crm-sicoven-default-session-secret-key-32chars" : undefined);
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  return new TextEncoder().encode(secret);
}

export type SessionUser = { sub: string; email: string; role: "admin" | "operator" | "viewer" };

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.sub)
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(secretKey());
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;

    // A signed cookie proves who originally logged in, not that the account
    // is still enabled. Re-read the canonical user on each authenticated request
    // so deactivation and role changes take effect without waiting eight hours.
    const result = await getDb().execute({
      sql: "SELECT id,email,role,active FROM crm_users WHERE id=? LIMIT 1",
      args: [payload.sub]
    });
    const user = result.rows[0];
    if (!user || Number(user.active) !== 1 ||
        !["admin", "operator", "viewer"].includes(String(user.role))) return null;

    return {
      sub: String(user.id),
      email: String(user.email),
      role: String(user.role) as SessionUser["role"]
    };
  } catch {
    // Fail closed: invalid token or unavailable session authority must not
    // grant access based solely on stale claims embedded in the cookie.
    return null;
  }
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
