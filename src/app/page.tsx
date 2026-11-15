import Link from "next/link";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

type PublicProduct = {
  id: string;
  name: string;
  edition: string | null;
  version: string | null;
  description: string | null;
};

export const dynamic = "force-dynamic";

export default async function PublicCatalogPage() {
  let products: PublicProduct[] = [];
  let unavailable = false;

  try {
    await bootstrapDatabase();
    const result = await getDb().execute({
      sql: "SELECT id,name,edition,version,description FROM products WHERE status='active' ORDER BY name LIMIT 100"
    });
    products = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      edition: row.edition == null ? null : String(row.edition),
      version: row.version == null ? null : String(row.version),
      description: row.description == null ? null : String(row.description)
    }));
  } catch {
    unavailable = true;
  }

  return (
    <main className="public-catalog">
      <header className="catalog-header">
        <div className="catalog-header-inner">
          <Link href="/" className="catalog-brand" aria-label="EFASfreelancer, inicio">
            <img src="/efasfreelancer-logo.svg" alt="EFASfreelancer Soluciones Digitales" />
          </Link>
          <span className="catalog-header-label">CATÁLOGO OFICIAL DE SOFTWARE</span>
        </div>
      </header>

      <section className="catalog-intro">
        <div className="catalog-intro-inner">
          <p className="catalog-eyebrow">EFASfreelancer · Soluciones Digitales</p>
          <h1>Software creado para impulsar tu trabajo.</h1>
          <p className="catalog-lead">Explora nuestro catálogo de productos y conoce las soluciones disponibles para tu empresa y actividad profesional.</p>
        </div>
      </section>

      <section className="catalog-products" aria-labelledby="catalog-title">
        <div className="catalog-section-heading">
          <div>
            <p className="catalog-eyebrow">NUESTRAS SOLUCIONES</p>
            <h2 id="catalog-title">Catálogo de productos</h2>
          </div>
          <span className="catalog-count">{products.length} {products.length === 1 ? "producto" : "productos"}</span>
        </div>

        {unavailable ? (
          <div className="catalog-state" role="status">
            <h3>Catálogo temporalmente no disponible</h3>
            <p>No fue posible consultar los productos en este momento. Intenta nuevamente más tarde.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="catalog-state">
            <h3>Estamos preparando nuestro catálogo</h3>
            <p>Próximamente publicaremos aquí nuestros productos disponibles.</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {products.map((product) => (
              <article className="catalog-card" key={product.id}>
                <div className="catalog-card-top">
                  <div className="catalog-product-mark" aria-hidden="true">{product.name.trim().slice(0, 1).toUpperCase()}</div>
                  <span className="catalog-product-code">EFAS SOFTWARE</span>
                </div>
                <div className="catalog-card-content">
                  <p className="catalog-product-edition">{product.edition || "Solución de software"}</p>
                  <h3>{product.name}</h3>
                  {product.version && <p className="catalog-version">Versión {product.version}</p>}
                  <p className="catalog-description">{product.description || "Conoce esta solución de software de EFASfreelancer."}</p>
                </div>
                <div className="catalog-card-footer">
                  <span>Producto oficial EFASfreelancer</span>
                  <Link href={`/comprar?productId=${encodeURIComponent(product.id)}`} className="catalog-cta">
                    Ver planes <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="catalog-footer">
        <img src="/efasfreelancer-logo.svg" alt="EFASfreelancer" />
        <p>EFASfreelancer Soluciones Digitales</p>
        <span>Catálogo oficial de productos</span>
      </footer>

      <style>{`
        .public-catalog{min-height:100vh;background:#f8fafc;color:#0f172a}
        .catalog-header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid #e2e8f0}
        .catalog-header-inner{max-width:1180px;margin:0 auto;min-height:76px;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:18px}
        .catalog-brand img{display:block;width:205px;max-width:52vw;height:auto;object-fit:contain}
        .catalog-header-label{font-size:10px;letter-spacing:1.6px;font-weight:800;color:#64748b;text-align:right}
        .catalog-intro{background:linear-gradient(120deg,#10243a 0%,#214b70 100%);color:white}
        .catalog-intro-inner{max-width:1180px;margin:0 auto;padding:66px 24px 70px}
        .catalog-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.8px;color:#b38b27;margin:0 0 12px}
        .catalog-intro h1{max-width:760px;margin:0;font-size:clamp(32px,5vw,54px);line-height:1.08;letter-spacing:-1.6px;font-weight:800;color:#fff}
        .catalog-lead{max-width:670px;margin:20px 0 0;color:#d3dfeb;font-size:16px;line-height:1.75}
        .catalog-products{max-width:1180px;margin:0 auto;padding:54px 24px 70px}
        .catalog-section-heading{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:24px}
        .catalog-section-heading .catalog-eyebrow{color:#64748b;margin-bottom:8px}
        .catalog-section-heading h2{margin:0;font-size:clamp(23px,3vw,30px);letter-spacing:-.7px;color:#10243a}
        .catalog-count{white-space:nowrap;border:1px solid #dbe4ee;border-radius:999px;padding:8px 13px;background:white;color:#52657a;font-size:12px;font-weight:700}
        .catalog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
        .catalog-card{display:flex;min-width:0;flex-direction:column;overflow:hidden;background:white;border:1px solid #dfe7ef;border-radius:15px;box-shadow:0 5px 18px rgba(16,36,58,.035);transition:transform .18s ease,box-shadow .18s ease}
        .catalog-card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(16,36,58,.09)}
        .catalog-card-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px 0}
        .catalog-product-mark{width:52px;height:52px;display:grid;place-items:center;border-radius:13px;background:#10243a;color:#fff;font-size:25px;font-weight:800;box-shadow:inset 0 -3px 0 #f2bd35}
        .catalog-product-code{max-width:65%;overflow-wrap:anywhere;border:1px solid #e2e8f0;background:#f8fafc;border-radius:6px;padding:6px 9px;color:#64748b;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.6px}
        .catalog-card-content{flex:1;padding:20px 24px 24px}
        .catalog-product-edition{margin:0 0 8px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
        .catalog-card h3{margin:0;color:#10243a;font-size:25px;letter-spacing:-.6px;font-weight:800}
        .catalog-version{margin:8px 0 0;color:#64748b;font-size:12px}
        .catalog-description{margin:15px 0 0;color:#52657a;font-size:14px;line-height:1.75}
        .catalog-card-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 24px;border-top:1px solid #edf1f5;background:#fbfcfe}
        .catalog-card-footer>span{color:#718096;font-size:10px;font-weight:600}
        .catalog-cta{display:inline-flex;align-items:center;gap:10px;border-radius:8px;background:#1d4ed8;padding:10px 15px;color:white;text-decoration:none;font-size:12px;font-weight:700;transition:background .15s ease}
        .catalog-cta:hover{background:#1e40af}
        .catalog-state{border:1px solid #dfe7ef;border-radius:14px;background:#fff;padding:42px 24px;text-align:center}
        .catalog-state h3{margin:0;color:#10243a;font-size:18px}.catalog-state p{margin:9px 0 0;color:#64748b;font-size:13px}
        .catalog-footer{display:flex;flex-direction:column;align-items:center;gap:7px;border-top:1px solid #e2e8f0;background:#fff;padding:30px 20px;text-align:center}
        .catalog-footer img{width:175px;max-width:70vw;height:auto}.catalog-footer p{margin:6px 0 0;color:#334155;font-size:12px;font-weight:700}.catalog-footer span{color:#94a3b8;font-size:10px}
        @media(max-width:720px){.catalog-header-inner{min-height:66px;padding:10px 16px}.catalog-header-label{font-size:8px;letter-spacing:1px}.catalog-intro-inner{padding:48px 18px 52px}.catalog-lead{font-size:14px}.catalog-products{padding:38px 16px 52px}.catalog-grid{grid-template-columns:1fr;gap:14px}.catalog-card-top{padding:18px 18px 0}.catalog-card-content{padding:17px 18px 20px}.catalog-card-footer{padding:14px 18px}.catalog-card h3{font-size:22px}}
        @media(prefers-reduced-motion:reduce){.catalog-card,.catalog-cta{transition:none}.catalog-card:hover{transform:none}}
      `}</style>
    </main>
  );
}
