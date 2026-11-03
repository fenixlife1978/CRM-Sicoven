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
    const [products, totals, byProduct, bySource, daily, activationStats, activationDaily] = await Promise.all([
      db.execute("SELECT id,product_code,name,edition,version,status FROM products ORDER BY name"),
      db.execute({ sql: "SELECT COUNT(*) total,COUNT(DISTINCT session_id) sessions,SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) page_views,SUM(CASE WHEN event_type='download_click' THEN 1 ELSE 0 END) download_clicks,SUM(CASE WHEN event_type='whatsapp_click' THEN 1 ELSE 0 END) whatsapp_clicks,SUM(CASE WHEN event_type='lead_submit' THEN 1 ELSE 0 END) lead_submits FROM product_analytics_events WHERE created_at>=?", args: [since] }),
      db.execute({ sql: "SELECT p.id,p.product_code,p.name,COUNT(e.id) events,SUM(CASE WHEN e.event_type='page_view' THEN 1 ELSE 0 END) page_views,SUM(CASE WHEN e.event_type='download_click' THEN 1 ELSE 0 END) download_clicks,SUM(CASE WHEN e.event_type='whatsapp_click' THEN 1 ELSE 0 END) whatsapp_clicks,SUM(CASE WHEN e.event_type='lead_submit' THEN 1 ELSE 0 END) lead_submits,COUNT(DISTINCT e.session_id) sessions FROM products p LEFT JOIN product_analytics_events e ON e.product_id=p.id AND e.created_at>=? GROUP BY p.id,p.product_code,p.name ORDER BY events DESC,p.name", args: [since] }),
      db.execute({ sql: "SELECT COALESCE(source,'Directo / sin UTM') source,COALESCE(medium,'—') medium,COUNT(*) events,SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) page_views,SUM(CASE WHEN event_type='download_click' THEN 1 ELSE 0 END) download_clicks,SUM(CASE WHEN event_type='whatsapp_click' THEN 1 ELSE 0 END) whatsapp_clicks,SUM(CASE WHEN event_type='lead_submit' THEN 1 ELSE 0 END) lead_submits FROM product_analytics_events WHERE created_at>=? GROUP BY source,medium ORDER BY page_views DESC,events DESC LIMIT 20", args: [since] }),
      db.execute({ sql: "SELECT substr(created_at,1,10) day,SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) page_views,SUM(CASE WHEN event_type='download_click' THEN 1 ELSE 0 END) download_clicks FROM product_analytics_events WHERE created_at>=? GROUP BY substr(created_at,1,10) ORDER BY day", args: [since] }),
      db.execute({ sql: "SELECT COUNT(*) new_activations,COUNT(DISTINCT a.installation_id) installations, SUM(CASE WHEN a.status='active' THEN 1 ELSE 0 END) active_installations FROM activations a JOIN licenses l ON l.id=a.license_id JOIN products p ON p.id=l.product_id WHERE p.product_code='SICOVEN_DESKTOP' AND a.activated_at>=?", args: [since] }),
      db.execute({ sql: "SELECT substr(a.activated_at,1,10) day,COUNT(*) activations FROM activations a JOIN licenses l ON l.id=a.license_id JOIN products p ON p.id=l.product_id WHERE p.product_code='SICOVEN_DESKTOP' AND a.activated_at>=? GROUP BY substr(a.activated_at,1,10) ORDER BY day", args: [since] })
    ]);
    let githubDownloads: number | null = null;
    let githubReleaseTag = "v1.0.9";
    try {
      const releaseResponse = await fetch("https://api.github.com/repos/fenixlife1978/Sicoven/releases/tags/v1.0.9", {
        headers: { "Accept": "application/vnd.github+json", "User-Agent": "SICOVEN-Analytics" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(4000)
      });
      if (releaseResponse.ok) {
        const release = await releaseResponse.json() as { tag_name?: string; assets?: Array<{ name?: string; download_count?: number }> };
        githubReleaseTag = String(release.tag_name || githubReleaseTag);
        githubDownloads = (release.assets || []).filter(asset => /SICOVEN-Setup-.*-x64\\.exe$/i.test(String(asset.name || ""))).reduce((sum, asset) => sum + Number(asset.download_count || 0), 0);
      }
    } catch { /* GitHub metrics are optional; CRM analytics remains available. */ }
    return NextResponse.json({ days, products: products.rows, totals: totals.rows[0], byProduct: byProduct.rows, bySource: bySource.rows, daily: daily.rows, activationStats: activationStats.rows[0], activationDaily: activationDaily.rows, githubDownloads, githubReleaseTag });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la analítica." }, { status: 503 });
  }
}
