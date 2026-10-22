const modules = [
  { number: "01", title: "Clientes", description: "Empresas y personas naturales, con identificación y contacto." },
  { number: "02", title: "Productos", description: "Catálogo de sistemas y ediciones comercializadas." },
  { number: "03", title: "Licencias", description: "Emisión, vigencia, estado y política de uso." },
  { number: "04", title: "Activaciones", description: "Equipos autorizados, historial y revocaciones." }
];

export default function HomePage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><div><strong>SICOVEN</strong><small>CRM · CENTRO DE CONTROL</small></div></div>
        <div className="nav-label">GESTIÓN</div>
        <a className="nav-item active" href="#resumen">▦ <span>Resumen</span></a>
        <a className="nav-item" href="#clientes">♙ <span>Clientes</span></a>
        <a className="nav-item" href="#productos">▣ <span>Productos</span></a>
        <a className="nav-item" href="#licencias">⚿ <span>Licencias</span></a>
        <a className="nav-item" href="#activaciones">▤ <span>Activaciones</span></a>
        <div className="sidebar-footer"><span className="status-dot" /> Entorno inicial · Sin conexión a datos</div>
      </aside>
      <section className="content" id="resumen">
        <header className="topbar"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Centro de control</h1></div><div className="admin-chip"><span className="avatar">A</span><span><strong>Administrador</strong><small>Configuración pendiente</small></span></div></header>
        <div className="welcome"><div><span className="eyebrow light">ECOSISTEMA SICOVEN</span><h2>Gestiona clientes y licencias<br/>desde un solo lugar.</h2><p>Empresas, profesionales independientes y sus productos registrados.</p></div><div className="welcome-symbol">S</div></div>
        <div className="section-heading"><div><h2 id="clientes">Módulos principales</h2><p>La interfaz inicial está preparada; la persistencia y autenticación aún no están conectadas.</p></div><span className="pill">FASE 1 · ESTRUCTURA</span></div>
        <div className="module-grid">{modules.map((item) => <article className="module-card" key={item.number}><span className="module-number">{item.number}</span><h3>{item.title}</h3><p>{item.description}</p><span className="module-status">En preparación <span>↗</span></span></article>)}</div>
        <section className="client-note"><div className="note-icon">✓</div><div><h3>Dos perfiles de cliente, un único registro</h3><p><strong>Empresa:</strong> razón social y RIF. <strong>Persona natural:</strong> nombres, apellidos y cédula; RIF personal opcional. Cada cliente podrá asociarse con varios productos y licencias.</p></div></section>
        <footer>CRM SICOVEN · Proyecto independiente · No usar todavía para datos reales</footer>
      </section>
      <style>{`
        .shell{min-height:100vh;display:grid;grid-template-columns:250px minmax(0,1fr)}
        .sidebar{background:var(--navy);color:#fff;padding:26px 16px;display:flex;flex-direction:column;min-height:100vh}
        .brand{display:flex;align-items:center;gap:11px;padding:0 8px 34px}.brand-mark{width:39px;height:39px;background:var(--gold);color:var(--navy);display:grid;place-items:center;font-size:25px;font-weight:900;transform:skew(-7deg)}.brand strong,.brand small{display:block}.brand strong{letter-spacing:1.5px;font-size:15px}.brand small{font-size:9px;letter-spacing:1px;color:#b9c8d7;margin-top:5px}
        .nav-label,.eyebrow{font-size:10px;font-weight:800;letter-spacing:1.6px;color:#8da2b8}.nav-label{padding:0 12px 12px}.nav-item{display:flex;gap:13px;align-items:center;padding:12px;border-radius:8px;color:#d0dbe7;text-decoration:none;font-size:13px;margin-bottom:5px}.nav-item.active{background:#244765;color:#fff;border-left:3px solid var(--gold)}.sidebar-footer{margin-top:auto;font-size:10px;color:#a9bdcf;display:flex;align-items:center;gap:8px;padding:12px 8px}.status-dot{width:7px;height:7px;border-radius:50%;background:#f2bd35}
        .content{padding:30px clamp(20px,4vw,54px);min-width:0}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:27px}.topbar h1{font-size:25px;margin:8px 0 0;color:var(--navy)}.admin-chip{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);padding:9px 13px;border-radius:10px}.avatar{width:32px;height:32px;border-radius:50%;background:#eaf0f7;display:grid;place-items:center;color:var(--navy);font-weight:800}.admin-chip strong,.admin-chip small{display:block;font-size:11px}.admin-chip small{color:var(--muted);margin-top:4px}
        .welcome{background:linear-gradient(115deg,#10243a,#214b70);border-radius:15px;padding:30px 34px;color:white;display:flex;justify-content:space-between;align-items:center;overflow:hidden;position:relative}.light{color:#f2bd35}.welcome h2{font-size:clamp(23px,3vw,32px);line-height:1.18;margin:13px 0}.welcome p{font-size:13px;color:#cbd9e6;margin:0}.welcome-symbol{font-size:150px;font-weight:900;color:#ffffff0d;line-height:1;padding-right:30px}
        .section-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:31px 0 17px}.section-heading h2{font-size:18px;margin:0;color:var(--navy)}.section-heading p{font-size:12px;color:var(--muted);margin:7px 0 0}.pill{white-space:nowrap;background:#fff5d7;color:#7c5c05;border:1px solid #f5dfa0;border-radius:30px;padding:7px 11px;font-size:9px;font-weight:800;letter-spacing:.5px}
        .module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.module-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;min-height:180px}.module-number{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#edf3f8;color:var(--navy);font-weight:800;font-size:11px}.module-card h3{font-size:15px;margin:15px 0 7px}.module-card p{font-size:12px;line-height:1.6;color:var(--muted);min-height:39px;margin:0}.module-status{display:flex;justify-content:space-between;border-top:1px solid #edf0f4;margin-top:14px;padding-top:12px;color:#69788b;font-size:10px}.module-status span{color:#b58b13;font-size:14px}
        .client-note{display:flex;gap:13px;background:#fff;border:1px solid var(--line);border-radius:12px;margin-top:18px;padding:19px}.note-icon{flex:none;width:29px;height:29px;border-radius:50%;background:#e8f5ed;color:#247749;display:grid;place-items:center;font-weight:800}.client-note h3{font-size:13px;margin:2px 0 7px}.client-note p{font-size:12px;line-height:1.7;color:var(--muted);margin:0}.content footer{padding:26px 0 5px;text-align:center;color:#8390a0;font-size:10px}
        @media(max-width:1100px){.module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.welcome-symbol{font-size:100px}}
        @media(max-width:650px){.shell{grid-template-columns:1fr}.sidebar{min-height:auto;padding:17px 14px}.brand{padding-bottom:18px}.nav-label,.sidebar-footer{display:none}.sidebar{display:block}.nav-item{display:inline-flex;padding:9px;margin:0 3px 3px 0;font-size:11px}.content{padding:20px 15px}.topbar h1{font-size:21px}.admin-chip{padding:6px}.admin-chip strong{font-size:10px}.welcome{padding:23px 20px}.welcome-symbol{display:none}.section-heading{align-items:flex-start;flex-direction:column}.module-grid{grid-template-columns:1fr}.module-card{min-height:auto}.module-card p{min-height:0}}
      `}</style>
    </main>
  );
}
