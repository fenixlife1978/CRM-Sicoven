import Link from "next/link";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import ProductGallery from "@/components/ProductGallery";
import ProductDownloadLink from "@/components/ProductDownloadLink";

type PublicProduct = {
  id: string;
  name: string;
  product_code: string | null;
  edition: string | null;
  version: string | null;
  description: string | null;
  slogan: string | null;
  public_review: string | null;
  download_url: string | null;
  download_label: string | null;
  images: { id: string; url: string; alt_text: string | null; media_type: "image" | "video" }[];
};

export const dynamic = "force-dynamic";

export default async function PublicCatalogPage() {
  let products: PublicProduct[] = [];
  let unavailable = false;

  try {
    await bootstrapDatabase();
    const result = await getDb().execute({
      sql: "SELECT id,name,product_code,edition,version,description,slogan,public_review,download_url,download_label FROM products WHERE status='active' ORDER BY name LIMIT 100"
    });
    products = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      product_code: row.product_code == null ? null : String(row.product_code),
      edition: row.edition == null ? null : String(row.edition),
      version: row.version == null ? null : String(row.version),
      description: row.description == null ? null : String(row.description),
      slogan: row.slogan == null ? null : String(row.slogan),
      public_review: row.public_review == null ? null : String(row.public_review),
      download_url: row.download_url == null ? null : String(row.download_url),
      download_label: row.download_label == null ? null : String(row.download_label),
      images: []
    }));
    // La última Release oficial de SIFER360 mantiene actualizado el instalador del catálogo sin edición manual.
    for (const product of products) {
      if (product.product_code !== "SIFER360_LICORERIA") continue;
      try {
        const response = await fetch("https://api.github.com/repos/fenixlife1978/Sifer360-licoreria/releases/latest", {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "CRM-SICOVEN-Catalog" },
          next: { revalidate: 300 },
          signal: AbortSignal.timeout(4000)
        });
        if (response.ok) {
          const release = await response.json() as { tag_name?: string; assets?: Array<{ name?: string; browser_download_url?: string }> };
          const installer = (release.assets || []).find(asset => /SIFER360-.*-Instalador\.exe$/i.test(String(asset.name || "")));
          if (installer?.browser_download_url) {
            product.version = String(release.tag_name || "").replace(/^v/i, "") || product.version;
            product.download_url = installer.browser_download_url;
            product.download_label = "Descarga gratuita · Instalador Windows " + product.version;
          }
        }
      } catch {
        // Si GitHub no responde, se conserva la última URL guardada en el CRM.
      }
    }
    // SICOVEN descarga siempre la última Release estable publicada en el repositorio oficial.
    // Los borradores y prereleases no aparecen en /releases/latest.
    for (const product of products) {
      // Algunas fichas antiguas conservan un código genérico asignado antes de
      // introducir SICOVEN_DESKTOP. El nombre permite reconocer esa ficha sin
      // depender de una migración manual de la base de datos de producción.
      const isSicoven = product.product_code === "SICOVEN_DESKTOP"
        || product.name.trim().toLowerCase() === "sicoven";
      if (!isSicoven) continue;
      try {
        const response = await fetch("https://api.github.com/repos/fenixlife1978/sicoven-descargas/releases/latest", {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "CRM-SICOVEN-Catalog" },
          cache: "no-store",
          signal: AbortSignal.timeout(10000)
        });
        if (response.ok) {
          const release = await response.json() as { tag_name?: string; assets?: Array<{ name?: string; browser_download_url?: string }> };
          const installer = (release.assets || []).find(asset => /^SICOVEN-Setup-.*-x64\.exe$/i.test(String(asset.name || "")));
          if (installer?.browser_download_url) {
            product.version = String(release.tag_name || "").replace(/^v/i, "") || product.version;
            product.download_url = installer.browser_download_url;
            product.download_label = "Actualización gratuita · SICOVEN Windows x64 · v" + product.version;
          }
        }
      } catch {
        // Si GitHub no responde o aún no hay Release estable, se conserva la URL guardada en el CRM.
      }
    }
    if (products.length) {
      const images = await getDb().execute({ sql: "SELECT id,product_id,url,alt_text,media_type FROM product_images WHERE product_id IN (" + products.map(() => "?").join(",") + ") ORDER BY sort_order,created_at", args: products.map((product) => product.id) });
      products = products.map((product) => ({ ...product, images: images.rows.filter((image) => String(image.product_id) === product.id).map((image) => ({ id: String(image.id), url: String(image.url), alt_text: image.alt_text == null ? null : String(image.alt_text), media_type: String(image.media_type || "image") === "video" ? "video" : "image" })) }));
    }
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
                <ProductGallery images={product.images} productName={product.name} />
                <div className="catalog-card-content">
                  <p className="catalog-product-edition">{product.edition || "Solución de software"}</p>
                  <h3>{product.name}</h3>
                  {product.slogan && <p className="catalog-slogan">{product.slogan}</p>}
                  {product.version && <p className="catalog-version">Versión {product.version}</p>}
                  <p className="catalog-description">{product.public_review || product.description || "Conoce esta solución de software de EFASfreelancer."}</p>
                  {product.download_url ? (
                    <ProductDownloadLink
                      href={product.download_url}
                      productCode={product.product_code || ""}
                      productName={product.name}
                      label={product.download_label || ("Descarga gratuita · " + product.name)}
                    />
                  ) : (
                    <div className="catalog-download catalog-download-disabled" aria-disabled="true">
                      <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 8.5 21 6v17H4V8.5Zm20-2.8L44 3v20H24V5.7ZM4 25h17v17L4 39.5V25Zm20 0h20v20l-20-2.8V25Z" fill="currentColor"/></svg>
                      <span><strong>DESCARGA GRATUITA</strong><small>Instalador próximamente disponible</small></span>
                    </div>
                  )}
                </div>
                <div className="catalog-card-footer">
                  <span>Producto oficial EFASfreelancer</span>
                  <Link href={"/comprar?productId=" + encodeURIComponent(product.id)} className="catalog-cta">
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
        .catalog-slogan{margin:10px 0 0;color:#0b78a5;font-size:15px;font-weight:800;line-height:1.45}
        .catalog-download{display:flex;align-items:center;gap:16px;width:100%;margin-top:24px;padding:17px 20px;border:1px solid #fff;border-radius:17px;background:linear-gradient(110deg,#ffe86b,#ffc400);box-shadow:0 7px 18px rgba(255,196,0,.25);color:#082b5a;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
        .catalog-download:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(255,196,0,.35)}
        .catalog-download svg{width:42px;height:42px;flex:0 0 42px}
        .catalog-download span{display:grid;gap:5px;min-width:0}
        .catalog-download strong{font-size:clamp(14px,2vw,19px);font-weight:900;line-height:1.15}
        .catalog-download small{font-size:12px;font-weight:700;overflow-wrap:anywhere}
        .catalog-download-disabled{opacity:.8;cursor:default;box-shadow:none}
        .catalog-download-disabled:hover{transform:none;box-shadow:none}
        .product-gallery{margin:16px 18px 0}
        .product-gallery-stage{position:relative;overflow:hidden;aspect-ratio:16/9;border-radius:11px;background:#edf2f7}
        .product-gallery-stage>img{display:block;width:100%;height:100%;object-fit:cover}
        .product-gallery-empty{margin:16px 18px 0;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed #d4dee9;border-radius:11px;background:#f7f9fc;color:#8a9bad}
        .product-gallery-empty span{font-size:30px}.product-gallery-empty p{margin:0;font-size:11px}
        .gallery-arrow{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border:0;border-radius:50%;background:rgba(9,35,66,.78);color:#fff;font-size:25px;line-height:1;cursor:pointer}
        .gallery-prev{left:10px}.gallery-next{right:10px}.gallery-counter{position:absolute;right:10px;bottom:10px;padding:4px 8px;border-radius:20px;background:rgba(9,35,66,.72);color:#fff;font-size:10px}
        .gallery-thumbnails{display:flex;gap:7px;overflow-x:auto;padding:8px 0 2px}
        .gallery-thumbnails button{width:58px;height:42px;flex:0 0 58px;padding:2px;border:2px solid transparent;border-radius:6px;background:#fff;cursor:pointer}
        .gallery-thumbnails button.active{border-color:#1d4ed8}.gallery-thumbnails img{width:100%;height:100%;object-fit:cover;border-radius:3px}
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
        @media(max-width:720px){.catalog-header-inner{min-height:66px;padding:10px 16px}.catalog-header-label{font-size:8px;letter-spacing:1px}.catalog-intro-inner{padding:48px 18px 52px}.catalog-lead{font-size:14px}.catalog-products{padding:38px 16px 52px}.catalog-grid{grid-template-columns:1fr;gap:14px}.catalog-card-top{padding:18px 18px 0}.catalog-card-content{padding:17px 18px 20px}.catalog-download{padding:14px 15px;gap:12px}.catalog-download svg{width:36px;height:36px;flex-basis:36px}.product-gallery{margin:14px 14px 0}.catalog-card-footer{padding:14px 18px}.catalog-card h3{font-size:22px}}
        @media(prefers-reduced-motion:reduce){.catalog-card,.catalog-cta{transition:none}.catalog-card:hover{transform:none}}
      `}</style>
    </main>
  );
}
