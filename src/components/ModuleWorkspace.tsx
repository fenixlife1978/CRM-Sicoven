"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Kind = "clientes" | "productos" | "licencias" | "activaciones";
type RecordItem = Record<string, unknown> & { id?: string };

const config: Record<Kind, { title: string; endpoint: string; collection: string }> = {
  clientes: { title: "Clientes", endpoint: "/api/customers", collection: "customers" },
  productos: { title: "Productos", endpoint: "/api/products", collection: "products" },
  licencias: { title: "Licencias", endpoint: "/api/licenses", collection: "licenses" },
  activaciones: { title: "Activaciones", endpoint: "/api/activations", collection: "activations" }
};

function text(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function ModuleWorkspace({ kind }: { kind: Kind }) {
  const current = config[kind];
  const [items, setItems] = useState<RecordItem[]>([]);
  const [customers, setCustomers] = useState<RecordItem[]>([]);
  const [products, setProducts] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [issuedKey, setIssuedKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(kind === "clientes" ? `${current.endpoint}?q=${encodeURIComponent(query)}` : current.endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudieron cargar los registros.");
      setItems(Array.isArray(result[current.collection]) ? result[current.collection] : []);
      if (kind === "licencias") {
        const [c, p] = await Promise.all([fetch("/api/customers", { cache: "no-store" }), fetch("/api/products", { cache: "no-store" })]);
        const cr = await c.json(), pr = await p.json();
        if (c.ok) setCustomers(cr.customers || []);
        if (p.ok) setProducts(pr.products || []);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Error de conexión."); }
    finally { setLoading(false); }
  }, [kind, current, query]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice(""); setIssuedKey("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const data = Object.fromEntries(form.entries());
    if (kind === "clientes") {
      if (data.type === "person") {
        delete data.legalName; delete data.taxId; delete data.tradeName; delete data.legalRepresentative;
      } else {
        delete data.firstName; delete data.lastName; delete data.identityDocument; delete data.personalTaxId; delete data.profession;
      }
    }
    try {
      const response = await fetch(current.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar.");
      if (result.licenseKey) setIssuedKey(result.licenseKey);
      setNotice(kind === "licencias" ? "Licencia emitida. Copia la clave ahora; no se volverá a mostrar." : "Registro guardado correctamente.");
      formElement.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al guardar."); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm("¿Revocar definitivamente esta activación?")) return;
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/activations/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activationId: id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo revocar.");
      setNotice("Activación revocada."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al revocar."); }
  }

  return <main className="workspace">
    <header><div><a href="/">← Resumen</a><p className="eyebrow">CRM SICOVEN</p><h1>{current.title}</h1><p className="muted">Registros consultados desde la base de datos central.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}>Actualizar</button></header>
    {kind === "clientes" && <section className="panel"><h2>Registrar cliente</h2><form onSubmit={submit} className="form-grid">
      <label>Tipo de cliente<select name="type" required><option value="person">Persona natural</option><option value="company">Empresa</option></select></label>
      <label>Nombres<input name="firstName" placeholder="Nombres" /></label><label>Apellidos<input name="lastName" placeholder="Apellidos" /></label><label>Cédula<input name="identityDocument" placeholder="V-12345678" /></label><label>RIF personal (opcional)<input name="personalTaxId" /></label><label>Profesión / actividad<input name="profession" /></label>
      <label>Razón social<input name="legalName" /></label><label>RIF empresa<input name="taxId" /></label><label>Nombre comercial<input name="tradeName" /></label><label>Representante legal<input name="legalRepresentative" /></label>
      <label>Correo<input name="email" type="email" /></label><label>Teléfono<input name="phone" /></label><label className="wide">Dirección<input name="address" /></label><label className="wide">Notas<textarea name="notes" rows={2} /></label>
      <button disabled={busy}>{busy ? "Guardando…" : "Guardar cliente"}</button>
    </form></section>}
    {kind === "productos" && <section className="panel"><h2>Registrar producto</h2><form onSubmit={submit} className="form-grid">
      <label>Nombre del sistema<input name="name" required maxLength={160} placeholder="Ej. SICOVEN" /></label><label>Edición<input name="edition" placeholder="Profesional, estándar…" /></label><label>Versión<input name="version" /></label><label className="wide">Descripción<textarea name="description" rows={2} /></label><button disabled={busy}>{busy ? "Guardando…" : "Guardar producto"}</button>
    </form></section>}
    {kind === "licencias" && <section className="panel"><h2>Emitir licencia</h2><form onSubmit={submit} className="form-grid">
      <label>Cliente<select name="customerId" required defaultValue=""><option value="" disabled>Seleccionar cliente</option>{customers.map(c => <option key={text(c.id)} value={text(c.id)}>{text(c.display_name)}</option>)}</select></label>
      <label>Producto<select name="productId" required defaultValue=""><option value="" disabled>Seleccionar producto</option>{products.map(p => <option key={text(p.id)} value={text(p.id)}>{text(p.name)} {p.edition ? `· ${text(p.edition)}` : ""}</option>)}</select></label>
      <label>Máximo de equipos<input name="maxActivations" type="number" min="1" max="100" defaultValue="1" required /></label><label>Inicio de vigencia<input name="startsAt" type="date" /></label><label>Vencimiento<input name="expiresAt" type="date" /></label><button disabled={busy}>{busy ? "Emitiendo…" : "Emitir licencia"}</button>
    </form>{issuedKey && <div className="key-box"><strong>Clave de licencia (cópiala ahora)</strong><code>{issuedKey}</code><button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(issuedKey)}>Copiar clave</button></div>}</section>}
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
    {kind === "clientes" && <div className="search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, cédula, RIF o correo…" /><button className="secondary" onClick={() => void load()}>Buscar</button></div>}
    <section className="panel"><div className="list-heading"><h2>Registros</h2><span>{loading ? "Cargando…" : `${items.length} registros mostrados`}</span></div>
      {loading ? <p className="muted">Consultando Turso…</p> : items.length === 0 ? <p className="muted">No hay registros que mostrar.</p> :
      <div className="table-wrap"><table><thead><tr>{(kind === "clientes" ? ["Nombre","Tipo","Documento","Correo","Estado"] : kind === "productos" ? ["Producto","Edición","Versión","Licencias","Estado"] : kind === "licencias" ? ["Cliente","Producto","Clave","Estado","Equipos"] : ["Cliente","Producto","Equipo","Estado","Activación","Acción"]).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{items.map((item,i) => <tr key={text(item.id) || i}>
        {kind === "clientes" && <><td>{text(item.display_name)}</td><td>{text(item.type) === "person" ? "Persona" : "Empresa"}</td><td>{text(item.identity_document || item.tax_id)}</td><td>{text(item.email)}</td><td>{text(item.status)}</td></>}
        {kind === "productos" && <><td>{text(item.name)}</td><td>{text(item.edition)}</td><td>{text(item.version)}</td><td>{text(item.license_count)}</td><td>{text(item.status)}</td></>}
        {kind === "licencias" && <><td>{text(item.customer_name)}</td><td>{text(item.product_name)}</td><td>{text(item.license_key_hint)}</td><td>{text(item.status)}</td><td>{text(item.active_activations)} / {text(item.max_activations)}</td></>}
        {kind === "activaciones" && <><td>{text(item.customer_name)}</td><td>{text(item.product_name)}</td><td>{text(item.device_label || item.installation_id)}</td><td>{text(item.status)}</td><td>{text(item.activated_at)}</td><td>{item.status === "active" ? <button className="danger" onClick={() => void revoke(text(item.id))}>Revocar</button> : "—"}</td></>}
      </tr>)}</tbody></table></div>}
    </section>
    <style>{`
      .workspace{max-width:1400px;margin:0 auto;padding:28px clamp(14px,4vw,48px);color:#182536}.workspace header{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:24px}.workspace header a{font-size:12px;color:#526b83;text-decoration:none}.workspace h1{font-size:28px;color:#10243a;margin:9px 0}.workspace h2{font-size:15px;margin:0 0 16px;color:#10243a}.eyebrow{font-size:10px;letter-spacing:1.5px;color:#9a7610;font-weight:800;margin:18px 0 0}.muted{font-size:12px;color:#667487;line-height:1.6}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:18px 0}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.form-grid label{font-size:11px;font-weight:700;color:#526174;display:grid;gap:6px}.form-grid input,.form-grid select,.form-grid textarea,.search input{width:100%;min-width:0;border:1px solid #d8e1ea;border-radius:7px;padding:10px;background:#fff;color:#182536}.form-grid button{align-self:end}.wide{grid-column:1/-1}.workspace button{background:#10243a;color:#fff;border:0;border-radius:7px;padding:10px 14px;font-size:12px;font-weight:700}.workspace button:disabled{opacity:.6}.workspace button.secondary{background:#fff;color:#10243a;border:1px solid #d8e1ea}.workspace button.danger{background:#fff0ef;color:#a32b24;border:1px solid #f0c5c2}.notice,.error{padding:11px 13px;border-radius:8px;font-size:12px}.notice{background:#e8f5ed;color:#247749}.error{background:#fff0ef;color:#a32b24}.search{display:flex;gap:8px;margin:16px 0}.list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.list-heading span{font-size:11px;color:#667487}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #edf0f4}th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#667487;background:#f8fafc}td{color:#27384a}.key-box{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:#fff8e7;border:1px solid #f1dfa8;padding:13px;border-radius:8px;margin-top:16px}.key-box strong{font-size:12px}.key-box code{font-size:13px;font-weight:800;overflow-wrap:anywhere}.key-box button{margin-left:auto}@media(max-width:800px){.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.workspace{padding:18px 12px}.workspace header{align-items:flex-start}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.panel{padding:14px}.key-box button{margin-left:0}.workspace h1{font-size:24px}}
    `}</style>
  </main>;
}
