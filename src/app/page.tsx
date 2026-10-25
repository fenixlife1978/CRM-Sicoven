import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

async function signOut() {
  "use server";
  await clearSession();
  redirect("/login");
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let metrics = { customers: "—", products: "—", licenses: "—", activations: "—" };
  let databaseReady = false;
  try {
    await bootstrapDatabase();
    const db = getDb();
    const [customers, products, licenses, activations] = await Promise.all([
      db.execute("SELECT COUNT(*) AS total FROM customers"),
      db.execute("SELECT COUNT(*) AS total FROM products"),
      db.execute("SELECT COUNT(*) AS total FROM licenses"),
      db.execute("SELECT COUNT(*) AS total FROM activations WHERE status='active'")
    ]);
    metrics = {
      customers: String(customers.rows[0]?.total ?? 0),
      products: String(products.rows[0]?.total ?? 0),
      licenses: String(licenses.rows[0]?.total ?? 0),
      activations: String(activations.rows[0]?.total ?? 0)
    };
    databaseReady = true;
  } catch {
    // Do not expose database credentials or driver details in the interface.
  }

  const cards = [
    { title: "Clientes", value: metrics.customers, description: "Personas naturales y empresas", href: "/clientes", number: "01" },
    { title: "Productos", value: metrics.products, description: "Catálogo de sistemas y ediciones", href: "/productos", number: "02" },
    { title: "Licencias", value: metrics.licenses, description: "Vigencia y estado de licencias", href: "/licencias", number: "03" },
    { title: "Activaciones", value: metrics.activations, description: "Equipos autorizados actualmente", href: "/activaciones", number: "04" }
  ];

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><img className="brand-logo" src="/efasfreelancer-logo.svg" alt="EFASfreelancer Soluciones Digitales" /></Link>
        <p className="nav-label">GESTIÓN</p>
        <Link className="nav-item active" href="/">▦ <span>Resumen</span></Link>
        {cards.map(card => <Link className="nav-item" href={card.href} key={card.href}>▣ <span>{card.title}</span></Link>)}
        {session.role === "admin" && <Link className="nav-item" href="/comercializacion">💳 <span>Comercialización</span></Link>}
        {session.role === "admin" && <Link className="nav-item" href="/administradores">⚙ <span>Administradores</span></Link>}
        <div className="sidebar-footer"><span className={databaseReady ? "status-dot good" : "status-dot"} />{databaseReady ? "Turso conectado" : "Base de datos no disponible"}</div>
      </aside>
      <section className="content">
        <header className="topbar"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Centro de control</h1></div><div className="user-area"><div className="admin-chip"><span className="avatar">{session.email.slice(0,1).toUpperCase()}</span><span><strong>{session.email}</strong><small>{session.role === "admin" ? "Administrador" : session.role === "operator" ? "Operador" : "Solo lectura"}</small></span></div><form action={signOut}><button className="logout" type="submit">Salir</button></form></div></header>
        <section className="welcome"><div><span className="eyebrow light">EFASfreelancer · RIF V-13313521-5</span><h2>Clientes, productos y licencias<br/>bajo un solo control.</h2><p>Los indicadores se consultan directamente desde la base de datos Turso.</p></div><img className="welcome-logo" src="/efasfreelancer-logo.svg" alt="" /></section>
        {!databaseReady && <p className="db-warning" role="status">No fue posible conectar con la base de datos. Los datos no están disponibles; revisa la configuración del servidor.</p>}
        <div className="section-heading"><div><h2>Módulos principales</h2><p>Resumen en tiempo real de los registros existentes.</p></div><span className={databaseReady ? "pill" : "pill warn"}>{databaseReady ? "DATOS REALES · TURSO" : "SIN CONEXIÓN"}</span></div>
        <div className="module-grid">{cards.map(card => <Link className="module-card" href={card.href} key={card.href}><span className="module-number">{card.number}</span><h3>{card.title}</h3><strong className="metric">{card.value}</strong><p>{card.description}</p><span className="module-status">Abrir módulo <b>↗</b></span></Link>)}</div>
        <section className="client-note"><span className="note-icon">✓</span><div><h3>Registro y seguridad</h3><p>Las contraseñas se almacenan cifradas mediante hash. Las operaciones administrativas quedan registradas para auditoría. No se muestran datos de demostración.</p></div></section>
        <footer>EFASfreelancer Soluciones Digitales · RIF V-13313521-5 · {databaseReady ? "Conectado a Turso" : "Verificación de conexión pendiente"}</footer>
      </section>
      <style>{`
        .shell{min-height:100vh;display:grid;grid-template-columns:245px minmax(0,1fr)}.sidebar{background:#10243a;color:#fff;padding:25px 15px;display:flex;flex-direction:column;min-height:100vh}
        .brand{display:flex;align-items:center;padding:0 8px 32px;color:#fff;text-decoration:none}.brand-logo{display:block;width:100%;max-width:205px;height:auto;background:#fff;border-radius:6px}.brand strong,.brand small{display:block}
        .nav-label,.eyebrow{font-size:10px;font-weight:800;letter-spacing:1.6px;color:#8da2b8}.nav-label{padding:0 12px 12px}.nav-item{display:flex;gap:13px;align-items:center;padding:12px;border-radius:8px;color:#d0dbe7;text-decoration:none;font-size:13px;margin-bottom:5px}.nav-item.active,.nav-item:hover{background:#244765;color:#fff}.sidebar-footer{margin-top:auto;font-size:10px;color:#a9bdcf;display:flex;align-items:center;gap:8px;padding:12px 8px}.status-dot{width:7px;height:7px;border-radius:50%;background:#e3a83a}.status-dot.good{background:#4cc38a}
        .content{padding:30px clamp(18px,4vw,54px);min-width:0}.topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:27px}.topbar h1{font-size:25px;margin:8px 0 0;color:#10243a}.user-area{display:flex;align-items:center;gap:9px}.admin-chip{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f0;padding:8px 12px;border-radius:10px;max-width:320px}.avatar{width:32px;height:32px;border-radius:50%;background:#eaf0f7;display:grid;place-items:center;color:#10243a;font-weight:800}.admin-chip strong,.admin-chip small{display:block;font-size:11px;overflow-wrap:anywhere}.admin-chip small{color:#667487;margin-top:4px}.logout{border:1px solid #d9e1e9;background:#fff;border-radius:8px;padding:10px 12px;color:#34465a}
        .welcome{background:linear-gradient(115deg,#10243a,#214b70);border-radius:15px;padding:30px 34px;color:white;display:flex;justify-content:space-between;align-items:center;overflow:hidden}.light{color:#f2bd35}.welcome h2{font-size:clamp(23px,3vw,32px);line-height:1.18;margin:13px 0}.welcome p{font-size:13px;color:#cbd9e6;margin:0}.welcome-logo{width:min(38%,300px);height:auto;opacity:.9;background:#ffffff;border-radius:8px;padding:8px}
        .section-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:31px 0 17px}.section-heading h2{font-size:18px;margin:0;color:#10243a}.section-heading p{font-size:12px;color:#667487;margin:7px 0 0}.pill{white-space:nowrap;background:#e8f5ed;color:#247749;border-radius:30px;padding:7px 11px;font-size:9px;font-weight:800}.pill.warn{background:#fff1dc;color:#875c0a}
        .module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.module-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;min-height:190px;text-decoration:none;color:inherit;display:flex;flex-direction:column}.module-card:hover{border-color:#b8c8d8;box-shadow:0 8px 24px #10243a0b}.module-number{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#edf3f8;color:#10243a;font-weight:800;font-size:11px}.module-card h3{font-size:15px;margin:14px 0 2px}.metric{font-size:27px;color:#10243a}.module-card p{font-size:12px;line-height:1.6;color:#667487;margin:4px 0 12px}.module-status{display:flex;justify-content:space-between;border-top:1px solid #edf0f4;margin-top:auto;padding-top:12px;color:#69788b;font-size:10px}.module-status b{color:#b58b13;font-size:14px}
        .client-note{display:flex;gap:13px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-top:18px;padding:19px}.note-icon{flex:none;width:29px;height:29px;border-radius:50%;background:#e8f5ed;color:#247749;display:grid;place-items:center;font-weight:800}.client-note h3{font-size:13px;margin:2px 0 7px}.client-note p{font-size:12px;line-height:1.7;color:#667487;margin:0}.db-warning{background:#fff1dc;border:1px solid #f1d39c;border-radius:9px;padding:12px;font-size:12px;color:#79530a}.content footer{padding:26px 0 5px;text-align:center;color:#8390a0;font-size:10px}
        @media(max-width:1050px){.module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.welcome-logo{width:34%}}
        @media(max-width:650px){.shell{grid-template-columns:1fr}.sidebar{min-height:auto;padding:15px}.brand{padding-bottom:15px}.nav-label,.sidebar-footer{display:none}.nav-item{display:inline-flex;padding:9px;margin:0 3px 3px 0;font-size:11px}.content{padding:20px 14px}.topbar{align-items:flex-start}.topbar h1{font-size:21px}.admin-chip{padding:6px}.admin-chip strong{font-size:10px}.welcome{padding:23px 20px}.welcome-logo{display:none}.section-heading{align-items:flex-start;flex-direction:column}.module-grid{grid-template-columns:1fr}.module-card{min-height:auto}.user-area{align-items:flex-start}.logout{padding:8px}.admin-chip{max-width:185px}}
      `}</style>
    </main>
  );
}
