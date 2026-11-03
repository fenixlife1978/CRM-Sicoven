import { NextRequest, NextResponse } from "next/server";
import { ensureProductAnalyticsSchema, allowedAnalyticsOrigin, hashRequestIp, newAnalyticsEventId } from "@/lib/product-analytics";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const eventTypes = new Set(["page_view","download_click","whatsapp_click","lead_submit"]);

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0,max);
  return result || null;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request: NextRequest, body: unknown, status: number) {
  const origin = request.headers.get("origin");
  const response = NextResponse.json(body, { status });
  if (origin && allowedAnalyticsOrigin(origin)) {
    for (const [key, value] of Object.entries(corsHeaders(origin))) response.headers.set(key, value);
  }
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedAnalyticsOrigin(origin)) {
    return new NextResponse(null, { status: 403, headers: { "Vary": "Origin" } });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  if (!allowedAnalyticsOrigin(request.headers.get("origin"))) {
    return json(request, { error: "Origen no autorizado." }, 403);
  }
  try {
    await bootstrapDatabase();
    await ensureProductAnalyticsSchema();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(request, { error: "Solicitud inválida." }, 400);
    const data = body as Record<string, unknown>;
    const productCode = clean(data.product_code, 80);
    const eventType = clean(data.event_type, 32);
    if (!productCode || !eventType || !eventTypes.has(eventType)) return json(request, { error: "Producto o evento inválido." }, 400);
    const db = getDb();
    const product = await db.execute({ sql: "SELECT id FROM products WHERE product_code=? AND status='active' LIMIT 1", args: [productCode] });
    if (!product.rows[0]) return json(request, { error: "Producto no registrado o inactivo." }, 404);

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = hashRequestIp(forwarded);
    const now = Math.floor(Date.now()/1000);
    const limit = await db.execute({ sql: "SELECT window_started_at,attempts FROM product_analytics_rate_limits WHERE ip_hash=? LIMIT 1", args: [ipHash] });
    const row = limit.rows[0];
    if (row && now - Number(row.window_started_at) < 3600 && Number(row.attempts) >= 120) {
      return json(request, { error: "Límite de eventos alcanzado." }, 429);
    }
    if (row && now - Number(row.window_started_at) < 3600) {
      await db.execute({ sql: "UPDATE product_analytics_rate_limits SET attempts=attempts+1 WHERE ip_hash=?", args: [ipHash] });
    } else {
      await db.execute({ sql: "INSERT INTO product_analytics_rate_limits(ip_hash,window_started_at,attempts) VALUES(?,?,1) ON CONFLICT(ip_hash) DO UPDATE SET window_started_at=excluded.window_started_at,attempts=1", args: [ipHash,now] });
    }

    const referrer = clean(data.referrer, 500);
    let referrerHost: string | null = null;
    if (referrer) { try { referrerHost = new URL(referrer).hostname.slice(0,160); } catch { referrerHost = null; } }
    await db.execute({
      sql: "INSERT INTO product_analytics_events(id,product_id,event_type,session_id,source,medium,campaign,landing_path,referrer_host) VALUES(?,?,?,?,?,?,?,?,?)",
      args: [newAnalyticsEventId(),String(product.rows[0].id),eventType,clean(data.session_id,80),clean(data.source,100),clean(data.medium,100),clean(data.campaign,120),clean(data.landing_path,300),referrerHost]
    });
    return json(request, { ok: true }, 202);
  } catch {
    return json(request, { error: "No se pudo registrar el evento." }, 503);
  }
}
