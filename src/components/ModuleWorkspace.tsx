"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Kind = "clientes" | "productos" | "licencias" | "activaciones";
type RecordItem = Record<string, unknown> & { id?: string };

const config: Record<Kind, { title: string; endpoint: string; collection: string }> = {
  clientes: { title: "Clientes", endpoint: "/api/customers", collection: "customers" },
  productos: { title: "Productos", endpoint: "/api/products", collection: "products" },
  licencias: { title: "Licencias", endpoint: "/api/licenses", collection: "licenses" },
  activaciones: { title: "Activaciones", endpoint: "/api/activations", collection: "activations" }
};

function pdfEscape(value: string) {
  return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^\\x20-\\x7E]/g, "?").replace(/\\\\/g, "\\\\\\\\").replace(/\\(/g, "\\\\(").replace(/\\)/g, "\\\\)");
}

function downloadCertificate(certificate: Record<string, unknown>) {
  const terms = (certificate.terms && typeof certificate.terms === "object" ? certificate.terms : {}) as Record<string, unknown>;
  const lines = [
    "CERTIFICADO DE LICENCIA DE SOFTWARE - CRM SICOVEN",
    `Certificado: ${String(certificate.certificateId ?? "")}`,
    `Cliente: ${String(certificate.customerName ?? "")}`,
    `Correo: ${String(certificate.customerEmail ?? "No indicado")}`,
    `Telefono: ${String(certificate.customerPhone ?? "No indicado")}`,
    `Producto: ${String(certificate.productName ?? "")} ${String(certificate.productEdition ?? "")}`,
    `Version: ${String(certificate.productVersion ?? "No indicada")}`,
    `Tipo de licencia: ${String(certificate.licenseTypeName ?? "")}`,
    `Clave confidencial: ${String(certificate.licenseKey ?? "")}`,
    `Equipos/terminales autorizados: ${String(certificate.maxActivations ?? 1)}`,
    `Inicio: ${String(certificate.startsAt ?? "Desde la activacion")}`,
    `Vigencia: ${certificate.expiresAt ? String(certificate.expiresAt) : "VITALICIA - SIN FECHA DE EXPIRACION"}`,
    `Dias maximos offline antes de revalidar: ${String(certificate.offlineDays ?? 7)}`,
    "",
    "INSTALACION Y ACTIVACION",
    "La instalacion y activacion inicial requieren obligatoriamente internet en el equipo.",
    "Despues de activar, el sistema puede trabajar offline dentro del plazo firmado autorizado.",
    "Al iniciar, el software comprobara la licencia cuando haya conectividad.",
    "Si el servidor confirma una revocacion, se cerrara la sesion y se bloqueara el acceso.",
    "Un equipo totalmente desconectado no puede recibir una revocacion hasta reconectarse;",
    "la autorizacion offline caduca segun el plazo indicado arriba.",
    "",
    "CUIDADO DE LA CLAVE",
    "Guarde la clave en un lugar seguro. No la publique ni la comparta.",
    "La clave y este certificado son confidenciales; conservelos para soporte.",
    "",
    "CONDICIONES COMERCIALES",
    `Soporte: ${String(terms.supportTerms || "Segun el acuerdo comercial con el proveedor.")}`,
    `Actualizaciones: ${String(terms.updateTerms || "Segun el acuerdo comercial con el proveedor.")}`,
    `Terminales adicionales: ${String(terms.extraActivationTerms || "Requieren autorizacion y extension de licencia antes de usarse.")}`,
    `Terminos: ${String(terms.terms || "El uso esta sujeto a la licencia concedida y a la politica de activacion y revocacion.")}`,
    "",
    "Para cambiar el equipo, solicite autorizacion al proveedor. La activacion anterior puede ser revocada."
  ];
  const stream = `BT /F1 10 Tf 48 790 Td 14 TL ${lines.map((line, index) => `${index ? "T* " : ""}(${pdfEscape(line)}) Tj`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\\nstream\\n${stream}\\nendstream`
  ];
  let pdf = "%PDF-1.4\\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${index + 1} 0 obj\\n${object}\\nendobj\\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \\n`; });
  pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xref}\\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `certificado-${String(certificate.certificateId ?? "sicoven")}.pdf`;
  anchor.click(); URL.revokeObjectURL(url);
}

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
  const [licenseTypes, setLicenseTypes] = useState<RecordItem[]>([]);
  const [certificate, setCertificate] = useState<Record<string, unknown> | null>(null);
  const [editingPlan, setEditingPlan] = useState<RecordItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(kind === "clientes" ? `${current.endpoint}?q=${encodeURIComponent(query)}` : current.endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudieron cargar los registros.");
      setItems(Array.isArray(result[current.collection]) ? result[current.collection] : []);
      if (kind === "licencias") {
        const [c, p, t] = await Promise.all([fetch("/api/customers", { cache: "no-store" }), fetch("/api/products", { cache: "no-store" }), fetch("/api/license-types", { cache: "no-store" })]);
        const cr = await c.json(), pr = await p.json(), tr = await t.json();
        if (c.ok) setCustomers(cr.customers || []);
        if (p.ok) setProducts(pr.products || []);
        if (t.ok) setLicenseTypes(tr.licenseTypes || []);
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
      if (result.certificate) setCertificate(result.certificate as Record<string, unknown>);
      setNotice(kind === "licencias" ? "Licencia emitida. Descarga el certificado PDF y guarda la clave de forma segura." : "Registro guardado correctamente.");
      formElement.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al guardar."); }
    finally { setBusy(false); }
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const planData = {
      ...data, id: editingPlan?.id, durationDays: data.durationDays === "" ? null : Number(data.durationDays),
      maxActivations: Number(data.maxActivations), offlineDays: Number(data.offlineDays),
      active: editingPlan ? true : true
    };
    try {
      const response = await fetch("/api/license-types", { method: editingPlan ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(planData) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el plan.");
      setNotice(editingPlan ? "Tipo de licencia actualizado." : "Tipo de licencia creado.");
      setEditingPlan(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al guardar el plan."); }
    finally { setBusy(false); }
  }

  async function togglePlan(plan: RecordItem) {
    const active = Number(plan.active) === 1;
    const payload = {
      id: plan.id, name: plan.name, durationDays: plan.duration_days === null ? null : Number(plan.duration_days),
      maxActivations: Number(plan.max_activations), offlineDays: Number(plan.offline_days),
      supportTerms: text(plan.support_terms) === "—" ? "" : plan.support_terms,
      updateTerms: text(plan.update_terms) === "—" ? "" : plan.update_terms,
      extraActivationTerms: text(plan.extra_activation_terms) === "—" ? "" : plan.extra_activation_terms,
      terms: text(plan.terms) === "—" ? "" : plan.terms,
      priceLabel: text(plan.price_label) === "—" ? "" : plan.price_label, active: !active
    };
    try {
      const response = await fetch("/api/license-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cambiar el estado.");
      setNotice(!active ? "Tipo de licencia activado." : "Tipo de licencia desactivado; no se podrá usar en nuevas emisiones.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al cambiar el estado."); }
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
    <header><div><Link href="/">← Resumen</Link><p className="eyebrow">CRM SICOVEN</p><h1>{current.title}</h1><p className="muted">Registros consultados desde la base de datos central.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}>Actualizar</button></header>
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
      <label>Tipo de licencia<select name="licenseTypeId" required defaultValue=""><option value="" disabled>Seleccionar plan</option>{licenseTypes.filter(t => Number(t.active) === 1).map(t => <option key={text(t.id)} value={text(t.id)}>{text(t.name)} · {t.duration_days === null ? "Vitalicia" : `${text(t.duration_days)} días`} · {text(t.max_activations)} equipo(s)</option>)}</select></label>
      <label>Inicio de vigencia<input name="startsAt" type="date" /></label><p className="muted">La duración y los equipos autorizados los determina el tipo de licencia. La vigencia vitalicia se guarda sin fecha de vencimiento.</p><button disabled={busy}>{busy ? "Emitiendo…" : "Emitir licencia"}</button>
    </form>{issuedKey && <div className="key-box"><strong>Clave de licencia (cópiala ahora)</strong><code>{issuedKey}</code><button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(issuedKey)}>Copiar clave</button></div>}
    {certificate && <div className="key-box"><div><strong>Certificado listo para descargar</strong><p className="muted">Incluye clave, vigencia, equipos, política offline, condiciones e instrucciones de instalación.</p></div><button type="button" onClick={() => downloadCertificate(certificate)}>Descargar certificado PDF</button></div>}</section>
    <section className="panel"><h2>{editingPlan ? "Editar tipo de licencia" : "Crear tipo de licencia"}</h2><p className="muted">La duración vacía significa vitalicia. El plazo offline limita cuánto puede operar un equipo sin revalidar la licencia.</p>
      <form onSubmit={submitPlan} className="form-grid">
        <label>Nombre del plan<input name="name" required defaultValue={text(editingPlan?.name) === "—" ? "" : text(editingPlan?.name)} placeholder="Ej. Perpetua Profesional" /></label>
        <label>Duración en días (vacío = vitalicia)<input name="durationDays" type="number" min="1" max="36500" defaultValue={editingPlan?.duration_days === null || editingPlan?.duration_days === undefined ? "" : text(editingPlan.duration_days)} /></label>
        <label>Equipos/terminales autorizados<input name="maxActivations" type="number" min="1" max="100" defaultValue={text(editingPlan?.max_activations) === "—" ? "1" : text(editingPlan?.max_activations)} required /></label>
        <label>Días offline antes de exigir revalidación<input name="offlineDays" type="number" min="1" max="30" defaultValue={text(editingPlan?.offline_days) === "—" ? "7" : text(editingPlan?.offline_days)} required /></label>
        <label>Precio o referencia comercial<input name="priceLabel" defaultValue={text(editingPlan?.price_label) === "—" ? "" : text(editingPlan?.price_label)} /></label>
        <label>Condiciones de soporte<input name="supportTerms" defaultValue={text(editingPlan?.support_terms) === "—" ? "" : text(editingPlan?.support_terms)} /></label>
        <label>Actualizaciones<input name="updateTerms" defaultValue={text(editingPlan?.update_terms) === "—" ? "" : text(editingPlan?.update_terms)} /></label>
        <label>Terminales adicionales<input name="extraActivationTerms" defaultValue={text(editingPlan?.extra_activation_terms) === "—" ? "" : text(editingPlan?.extra_activation_terms)} placeholder="Requiere extensión de licencia…" /></label>
        <label className="wide">Términos de uso<textarea name="terms" rows={3} defaultValue={text(editingPlan?.terms) === "—" ? "" : text(editingPlan?.terms)} /></label>
        <button disabled={busy}>{busy ? "Guardando…" : editingPlan ? "Guardar cambios" : "Crear tipo de licencia"}</button>{editingPlan && <button type="button" className="secondary" onClick={() => setEditingPlan(null)}>Cancelar edición</button>}
      </form>
      {licenseTypes.length > 0 && <div className="table-wrap"><table><thead><tr><th>Plan</th><th>Vigencia</th><th>Equipos</th><th>Offline</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{licenseTypes.map(t => <tr key={text(t.id)}><td>{text(t.name)}</td><td>{t.duration_days === null ? "Vitalicia" : `${text(t.duration_days)} días`}</td><td>{text(t.max_activations)}</td><td>{text(t.offline_days)} días</td><td>{Number(t.active) === 1 ? "Activo" : "Inactivo"}</td><td><button type="button" className="secondary" onClick={() => setEditingPlan(t)}>Editar</button> <button type="button" className="danger" onClick={() => void togglePlan(t)}>{Number(t.active) === 1 ? "Desactivar" : "Activar"}</button></td></tr>)}</tbody></table></div>}
    </section>}
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
