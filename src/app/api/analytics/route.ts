import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { ensureProductAnalyticsSchema } from "@/lib/product-analytics";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede consultar analítica." }, { status: 403 });
  try {
    await bootstrapDatabase();
    await ensureProductAnalyticsSchema();
    const daysParam = Number(request.nextUrl.searchParams.get("days") || 30);
    const days = [7,30,90].includes(daysParam) ? daysParam : 30;
    const since = new Date(Date.now() - days*86400000).toISOString().slice(0,19).replace("T"," ");
    const db = getDb();
    const [products, totals, byProduct, bySource, daily] = await Promise.all([
      db.execute("SELECT id,product_code,name,edition,version,status FROM products ORDER BY name"),
      db.execute({ sql: "SELECT COUNT(*) total,COUNT(DISTINCT session_id) sessions,SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) page_views,SUM(CASE WHEN event_type='download_click' THEN 1 ELSE 0 END) download_clicks,SUM(CASE WHEN event_type='whatsapp_click' THEN 1 ELSE 0 END) whatsapp_clicks,SUM(CASE WHEN event_type='lead_submit' THEN 1 ELSE 0 END) lead_submits FROM product_analytics_events WHERE created_at>=?", args: [since] }),
      db.execute({ sql: "SELECT p.id,p.product_code,p.name,COUNT(e.id) events,SUM(CASE WHEN e.event_type='page_view' THEN 1 ELSE 0 END) page_views,SUM(CASE WHEN e.event_type='download_click' THEN 1 ELSE 0 END) download_clicks,SUM(CASE WHEN e.event_type='whatsapp_click' THEN 1 ELSE 0 END) whatsapp_clicks,SUM(CASE WHEN e.event_type='lead_submit' THEN 1 ELSE 0 END) lead_submits,COUNT(DISTINCT e.session_id) sessions FROM products p LEFT JOIN product_analytics_events e ON e.product_id=p.id AND e.created_at>=? GROUP BY p.id,p.product_code,p.name ORDER BY events DESC,p.name", args: [since] }),
      db.execute({ sql: "SELECT COALESCE(source,'Directo / sin UTM') source,COALESCE(medium,'—') medium,COUNT(*) events FROM product_analytics_events WHERE created_at>=? GROUP BY source,medium ORDER BY events DESC LIMIT 20", args: [since] }),
      db.execute({ sql: "SELECT substr(created_at,1,10) day,SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) page_views,SUM(CASE WHEN event_type='download_click' THEN 1 ELSE 0 END) download_clicks FROM product_analytics_events WHERE created_at>=? GROUP BY substr(created_at,1,10) ORDER BY day", args: [since] })
    ]);
    return NextResponse.json({ days, products: products.rows, totals: totals.rows[0], byProduct: byProduct.rows, bySource: bySource.rows, daily: daily.rows });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la analítica." }, { status: 503 });
  }
}
