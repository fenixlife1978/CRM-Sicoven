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


function downloadCertificate(certificate: Record<string, unknown>) {
  const terms = (certificate.terms && typeof certificate.terms === "object" ? certificate.terms : {}) as Record<string, unknown>;
  const rows: [string, unknown][] = [
    ["N.º de certificado", certificate.certificateId],
    ["Fecha de emisión", certificate.issuedAt ? new Date(String(certificate.issuedAt)).toLocaleDateString("es-VE") : new Date().toLocaleDateString("es-VE")],
    ["Titular de la licencia", certificate.customerName],
    ["Correo electrónico", certificate.customerEmail || "No indicado"],
    ["Teléfono", certificate.customerPhone || "No indicado"],
    ["Producto licenciado", [certificate.productName, certificate.productEdition].filter(Boolean).join(" · ")],
    ["Versión", certificate.productVersion || "No indicada"],
    ["Tipo de licencia", certificate.licenseTypeName],
    ["Equipos autorizados", certificate.maxActivations ?? 1],
    ["Inicio de vigencia", certificate.startsAt || "Desde la activación"],
    ["Vencimiento", certificate.expiresAt || "Vitalicia — sin fecha de expiración"],
    ...(certificate.replacementFee !== undefined ? [["Costo de reposición pagado", `${certificate.replacementFee} ${certificate.replacementCurrency || "USD"}`] as [string, unknown]] : []),
  ];
  const esc = (value: unknown) => String(value ?? "—").replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char] || char));
  const table = rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join("");
  const page = window.open("", "_blank", "width=900,height=1000");
  if (!page) { window.alert("El navegador bloqueó la ventana del certificado. Permite las ventanas emergentes e inténtalo de nuevo."); return; }
  page.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificado ${esc(certificate.certificateId)}</title><style>
  @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172b42;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{position:relative;min-height:265mm;border:1px solid #d7e0e9;padding:18mm 15mm 13mm;overflow:hidden}
  .watermark{position:absolute;width:118mm;height:auto;left:50%;top:50%;transform:translate(-50%,-50%);opacity:.075;z-index:0}
  .content{position:relative;z-index:1}.masthead{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #173f70;padding-bottom:12px}
  .logo{width:83mm;height:auto}.issuer{text-align:right;font-size:10px;line-height:1.6;color:#334c65}.issuer strong{display:block;font-size:12px;color:#123c72}
  .kicker{margin:20px 0 5px;text-align:center;text-transform:uppercase;letter-spacing:3px;font-size:9px;font-weight:700;color:#65788d}
  h1{text-align:center;font-size:25px;letter-spacing:1px;margin:0;color:#123c72}.subtitle{text-align:center;font-size:11px;color:#607287;margin:7px 0 20px}
  .badge{margin:0 auto 20px;width:max-content;max-width:100%;border:1px solid #b9d8c6;background:#f0f8f3;color:#236742;padding:7px 18px;border-radius:3px;font-size:10px;font-weight:bold;letter-spacing:1px}
  table{width:100%;border-collapse:collapse;font-size:10.5px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid #dfe6ed;vertical-align:top}th{width:34%;color:#52667b;font-weight:600;background:#f4f7fa}td{font-weight:600;color:#1b3047;overflow-wrap:anywhere}
  .key{margin:16px 0;padding:13px;border:1px dashed #9eafc0;background:#ffffffd9}.key small{display:block;color:#607287;text-transform:uppercase;letter-spacing:1px;font-size:8px;margin-bottom:6px}.key strong{font-family:Consolas,monospace;font-size:13px;overflow-wrap:anywhere}
  .conditions{margin-top:17px;font-size:9px;line-height:1.65;color:#455a70}.conditions h2{font-size:10px;color:#123c72;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px}.conditions p{margin:4px 0}
  .footer{margin-top:18px;padding-top:10px;border-top:1px solid #d7e0e9;display:flex;justify-content:space-between;gap:12px;font-size:8px;color:#6c7c8d}.stamp{font-weight:bold;color:#123c72}
  .actions{display:flex;justify-content:center;gap:10px;margin:16px auto}.actions button{border:0;background:#123c72;color:#fff;padding:11px 18px;border-radius:5px;font-weight:bold;cursor:pointer}.actions .secondary{background:#e8edf2;color:#233a51}
  @media print{.actions{display:none}.sheet{border:0;min-height:0;padding:0}.watermark{opacity:.075}}
  </style></head><body><div class="actions"><button onclick="window.print()">Imprimir / Guardar como PDF</button><button class="secondary" onclick="window.close()">Cerrar</button></div><article class="sheet"><img class="watermark" src="/efasfreelancer-logo.svg" alt=""><div class="content">
  <header class="masthead"><img class="logo" src="/efasfreelancer-logo.svg" alt="EFASfreelancer Soluciones Digitales"><div class="issuer"><strong>EFASfreelancer</strong>Soluciones Digitales<br>RIF: V-13313521-5<br>Empresa otorgante de la licencia</div></header>
  <p class="kicker">Documento oficial de autorización</p><h1>CERTIFICADO DE LICENCIA</h1><p class="subtitle">Constancia de emisión y condiciones de uso del software licenciado</p><div class="badge">LICENCIA EMITIDA</div>
  <table>${table}</table><div class="key"><small>Clave de licencia · información confidencial</small><strong>${esc(certificate.licenseKey)}</strong></div>
  <section class="conditions"><h2>1. Activación y validación</h2><p>La activación inicial requiere conexión a Internet y validación en línea con los servidores autorizados de EFASfreelancer Soluciones Digitales. No se admite activación sin conexión. El usuario debe disponer de conectividad para completar el proceso de activación.</p><h2>2. Alcance de la autorización</h2><p>Esta licencia autoriza el uso del producto identificado en este certificado, para el titular indicado y dentro del número de equipos o terminales expresamente autorizado. La vigencia y las capacidades concedidas se rigen por los datos de este documento y por el plan contratado.</p><h2>3. Uso y custodia</h2><p>La clave de licencia es confidencial y debe conservarse de forma segura. El titular es responsable de su custodia y de impedir su uso no autorizado. No se permite copiar, distribuir, revender, ceder ni utilizar la licencia fuera del alcance contratado sin autorización escrita de la empresa otorgante.</p><h2>4. Formateo y sustitución del equipo</h2><p>La licencia activada queda vinculada al equipo donde se realizó la activación inicial. Si el cliente formatea ese equipo, reinstala Windows o necesita trasladar el programa a otro equipo por esa causa, la licencia anterior no podrá reutilizarse ni recuperarse automáticamente. El cliente deberá solicitar al distribuidor una licencia de reposición y pagar el costo módico que este establezca. Al emitirse la reposición, la licencia anterior y sus activaciones quedarán automáticamente revocadas y desactivadas. Esta reposición aplica únicamente a casos de formateo o sustitución del equipo; no sustituye el procedimiento comercial de ampliación de terminales.</p><h2>5. Ampliación de equipos autorizados</h2><p>Las activaciones consumen cupos de la licencia y no se liberan automáticamente por desinstalar o dejar de utilizar un equipo. Si se agota la cantidad de equipos autorizados, el titular deberá solicitar una ampliación a su distribuidor. Una vez registrada la ampliación en CRM-Sicoven, se actualizará el límite de la misma licencia y la misma clave podrá utilizarse para activar equipos adicionales hasta alcanzar la nueva cantidad autorizada. La ampliación no revoca las activaciones anteriores ni emite una nueva clave. El cambio de equipo por formateo o sustitución se rige por la condición específica de reposición indicada en este certificado.</p><h2>6. Condiciones comerciales</h2><p><strong>Soporte:</strong> ${esc(terms.supportTerms || "Según el plan contratado y el acuerdo comercial.")}</p><p><strong>Actualizaciones:</strong> ${esc(terms.updateTerms || "Según el plan contratado y el acuerdo comercial.")}</p><p><strong>Terminales adicionales:</strong> ${esc(terms.extraActivationTerms || "Requieren autorización y ampliación formal de la licencia.")}</p><p><strong>Condiciones particulares:</strong> ${esc(terms.terms || "La licencia se limita al producto, titular, vigencia y capacidad autorizada que figuran en este certificado.")}</p><h2>7. Conservación del certificado</h2><p>Conserve este documento como comprobante de autorización y mantenga la clave protegida. Para consultas, soporte, traslado de equipo o ampliaciones, contacte con EFASfreelancer Soluciones Digitales.</p></section>
  <footer class="footer"><span>EFASfreelancer Soluciones Digitales · RIF V-13313521-5</span><span class="stamp">CERTIFICADO DE LICENCIA · ${esc(certificate.certificateId)}</span></footer></div></article></body></html>`);
  page.document.close();
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
  const [editingProduct, setEditingProduct] = useState<RecordItem | null>(null);
  const [selectedLicenseId, setSelectedLicenseId] = useState("");

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
      const response = await fetch(kind === "productos" && editingProduct ? "/api/products/" + encodeURIComponent(text(editingProduct.id)) : current.endpoint, { method: kind === "productos" && editingProduct ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar.");
      if (result.licenseKey) setIssuedKey(result.licenseKey);
      if (result.certificate) setCertificate(result.certificate as Record<string, unknown>);
      setNotice(kind === "licencias" ? "Licencia emitida. Descarga el certificado PDF y guarda la clave de forma segura." : kind === "productos" && editingProduct ? "Producto actualizado correctamente." : "Registro guardado correctamente.");
      if (kind === "productos") setEditingProduct(null);
      formElement.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al guardar."); }
    finally { setBusy(false); }
  }

  async function deleteProduct(product: RecordItem) {
    if (!window.confirm("¿Eliminar el producto “" + text(product.name) + "”? Si tiene licencias, planes o reportes de pago asociados, se desactivará para conservar el historial.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/products/" + encodeURIComponent(text(product.id)), { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo eliminar el producto.");
      setNotice(result.archived ? "Producto desactivado para conservar los registros asociados." : "Producto eliminado.");
      if (editingProduct?.id === product.id) setEditingProduct(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al eliminar el producto."); }
    finally { setBusy(false); }
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const planData = {
      ...data, id: editingPlan?.id, durationDays: data.durationDays === "" ? null : Number(data.durationDays),
      maxActivations: Number(data.maxActivations), offlineDays: Number(data.offlineDays), priceAmount: Number(data.priceAmount || 0), expansionPrice: Number(data.expansionPrice || 0),
      active: editingPlan ? Number(editingPlan.active) === 1 : true
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
      maxActivations: Number(plan.max_activations), offlineDays: Number(plan.offline_days ?? 7),
      supportTerms: text(plan.support_terms) === "—" ? "" : plan.support_terms,
      updateTerms: text(plan.update_terms) === "—" ? "" : plan.update_terms,
      extraActivationTerms: text(plan.extra_activation_terms) === "—" ? "" : plan.extra_activation_terms,
      terms: text(plan.terms) === "—" ? "" : plan.terms,
      priceLabel: text(plan.price_label) === "—" ? "" : plan.price_label, billingCycle: plan.billing_cycle || "once", priceAmount: Number(plan.price_amount || 0), currency: plan.currency || "USD", expansionPrice: Number(plan.expansion_price || 0), expansionBillingCycle: plan.expansion_billing_cycle || "once", active: !active
    };
    try {
      const response = await fetch("/api/license-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cambiar el estado.");
      setNotice(!active ? "Tipo de licencia activado." : "Tipo de licencia desactivado; no se podrá usar en nuevas emisiones.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al cambiar el estado."); }
  }

  async function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = { ...data, licenseId: selectedLicenseId, newLimit: Number(data.newLimit), unitPrice: Number(data.unitPrice || 0) };
    try {
      const response = await fetch("/api/license-capacity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo ampliar la licencia.");
      setNotice(result.paymentStatus === "pending" ? `Ampliación registrada. Cargo pendiente: ${result.amount} ${result.currency}. La licencia conserva su identificador.` : "Ampliación administrativa aplicada sin cargo.");
      setSelectedLicenseId(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al ampliar la licencia."); }
    finally { setBusy(false); }
  }

  async function replaceLicense(id: string) {
    const feeInput = window.prompt("Costo módico de reposición fijado por el distribuidor y ya cobrado (USD). Introduce 0 solo si se autorizó sin cargo:", "10");
    if (feeInput === null) return;
    const fee = Number(feeInput.trim().replace(",", "."));
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) { setError("Introduce un importe de reposición válido."); return; }
    if (!window.confirm(`Confirma que el cliente solicitó reposición por formateo/sustitución y que el importe de ${fee.toFixed(2)} USD ya fue cobrado o autorizado sin cargo. Se emitirá una clave nueva y la licencia anterior quedará automáticamente revocada junto con todas sus activaciones.`)) return;
    setBusy(true); setError(""); setNotice(""); setIssuedKey(""); setCertificate(null);
    try {
      const response = await fetch("/api/licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "replace-after-format", licenseId: id, replacementFee: fee, currency: "USD", feePaid: true, reason: "Reposición solicitada por formateo o sustitución del equipo" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo reponer la licencia.");
      setIssuedKey(String(result.licenseKey || ""));
      if (result.certificate) setCertificate(result.certificate as Record<string, unknown>);
      setNotice(`Reposición emitida. La licencia anterior quedó revocada. Cargo registrado: ${fee.toFixed(2)} USD. Descarga el nuevo certificado y entrega la clave nueva al cliente.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Error al reponer la licencia."); }
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
    <header><div><Link href="/">← Resumen</Link><p className="eyebrow">EFASfreelancer · SOLUCIONES DIGITALES</p><h1>{current.title}</h1><p className="muted">Registros consultados desde la base de datos central.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}>Actualizar</button></header>
    {kind === "clientes" && <section className="panel"><h2>Registrar cliente</h2><form onSubmit={submit} className="form-grid">
      <label>Tipo de cliente<select name="type" required><option value="person">Persona natural</option><option value="company">Empresa</option></select></label>
      <label>Nombres<input name="firstName" placeholder="Nombres" /></label><label>Apellidos<input name="lastName" placeholder="Apellidos" /></label><label>Cédula<input name="identityDocument" placeholder="V-12345678" /></label><label>RIF personal (opcional)<input name="personalTaxId" /></label><label>Profesión / actividad<input name="profession" /></label>
      <label>Razón social<input name="legalName" /></label><label>RIF empresa<input name="taxId" /></label><label>Nombre comercial<input name="tradeName" /></label><label>Representante legal<input name="legalRepresentative" /></label>
      <label>Correo<input name="email" type="email" /></label><label>Teléfono<input name="phone" /></label><label className="wide">Dirección<input name="address" /></label><label className="wide">Notas<textarea name="notes" rows={2} /></label>
      <button disabled={busy}>{busy ? "Guardando…" : "Guardar cliente"}</button>
    </form></section>}
    {kind === "productos" && <section className="panel"><h2>{editingProduct ? "Editar producto" : "Registrar producto"}</h2><form key={text(editingProduct?.id)} onSubmit={submit} className="form-grid">
      <label>Nombre del sistema<input name="name" required maxLength={160} placeholder="Ej. SICOVEN" defaultValue={editingProduct ? text(editingProduct.name) : ""} /></label><label>Edición<input name="edition" placeholder="Profesional, estándar…" defaultValue={editingProduct && text(editingProduct.edition) !== "—" ? text(editingProduct.edition) : ""} /></label><label>Versión<input name="version" defaultValue={editingProduct && text(editingProduct.version) !== "—" ? text(editingProduct.version) : ""} /></label><label className="wide">Descripción<textarea name="description" rows={2} defaultValue={editingProduct && text(editingProduct.description) !== "—" ? text(editingProduct.description) : ""} /></label><button disabled={busy}>{busy ? "Guardando…" : editingProduct ? "Guardar cambios" : "Guardar producto"}</button>{editingProduct && <button type="button" className="secondary" onClick={() => setEditingProduct(null)}>Cancelar edición</button>}
    </form></section>}
    {kind === "licencias" && <><section className="panel"><h2>Emitir licencia</h2><form onSubmit={submit} className="form-grid">
      <label>Cliente<select name="customerId" required defaultValue=""><option value="" disabled>Seleccionar cliente</option>{customers.map(c => <option key={text(c.id)} value={text(c.id)}>{text(c.display_name)}</option>)}</select></label>
      <label>Producto<select name="productId" required defaultValue=""><option value="" disabled>Seleccionar producto</option>{products.map(p => <option key={text(p.id)} value={text(p.id)}>{text(p.name)} {p.edition ? `· ${text(p.edition)}` : ""}</option>)}</select></label>
      <label>Tipo de licencia<select name="licenseTypeId" required defaultValue=""><option value="" disabled>Seleccionar plan</option>{licenseTypes.filter(t => Number(t.active) === 1).map(t => <option key={text(t.id)} value={text(t.id)}>{text(t.name)} · {t.duration_days === null ? "Vitalicia" : `${text(t.duration_days)} días`} · {text(t.max_activations)} equipo(s)</option>)}</select></label>
      <label>Inicio de vigencia<input name="startsAt" type="date" /></label><p className="muted">La duración y los equipos autorizados los determina el tipo de licencia. La vigencia vitalicia se guarda sin fecha de vencimiento.</p><button disabled={busy}>{busy ? "Emitiendo…" : "Emitir licencia"}</button>
    </form>{issuedKey && <div className="key-box"><strong>Clave de licencia (cópiala ahora)</strong><code>{issuedKey}</code><button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(issuedKey)}>Copiar clave</button></div>}
    {certificate && <div className="key-box"><div><strong>Certificado listo para descargar</strong><p className="muted">Incluye identificación de la licencia, titular, producto, vigencia, capacidad autorizada, clave confidencial y condiciones de uso.</p></div><button type="button" onClick={() => downloadCertificate(certificate)}>Descargar certificado PDF</button></div>}</section>
    <section className="panel"><h2>{editingPlan ? "Editar tipo de licencia" : "Crear tipo de licencia"}</h2><p className="muted">La duración vacía significa vitalicia. La activación de todas las licencias requiere conexión a Internet.</p>
      <form onSubmit={submitPlan} className="form-grid">
        <label>Nombre del plan<input name="name" required defaultValue={text(editingPlan?.name) === "—" ? "" : text(editingPlan?.name)} placeholder="Ej. Perpetua Profesional" /></label>
        <label>Duración en días (vacío = vitalicia)<input name="durationDays" type="number" min="1" max="36500" defaultValue={editingPlan?.duration_days === null || editingPlan?.duration_days === undefined ? "" : text(editingPlan.duration_days)} /></label>
        <label>Equipos/terminales autorizados<input name="maxActivations" type="number" min="1" max="100" defaultValue={text(editingPlan?.max_activations) === "—" ? "1" : text(editingPlan?.max_activations)} required /></label>
        <label>Días de uso sin conexión (1–30)<input name="offlineDays" type="number" min="1" max="30" defaultValue={editingPlan?.offline_days === null || editingPlan?.offline_days === undefined ? "7" : text(editingPlan.offline_days)} required /><small>Lo controla el administrador del CRM; al vencer, SICOVEN exige revalidación por internet.</small></label>
        <label>Precio o referencia comercial<input name="priceLabel" defaultValue={text(editingPlan?.price_label) === "—" ? "" : text(editingPlan?.price_label)} /></label>
        <label>Precio de licencia<input name="priceAmount" type="number" min="0" step="0.01" defaultValue={text(editingPlan?.price_amount) === "—" ? "0" : text(editingPlan?.price_amount)} /></label>
        <label>Periodicidad de licencia<select name="billingCycle" defaultValue={text(editingPlan?.billing_cycle) === "—" ? "once" : text(editingPlan?.billing_cycle)}><option value="once">Pago único / vitalicia</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label>
        <label>Moneda (ISO 4217)<input name="currency" maxLength={3} defaultValue={text(editingPlan?.currency) === "—" ? "USD" : text(editingPlan?.currency)} /></label>
        <label>Precio por unidad de ampliación<input name="expansionPrice" type="number" min="0" step="0.01" defaultValue={text(editingPlan?.expansion_price) === "—" ? "0" : text(editingPlan?.expansion_price)} /></label>
        <label>Periodicidad de ampliación<select name="expansionBillingCycle" defaultValue={text(editingPlan?.expansion_billing_cycle) === "—" ? "once" : text(editingPlan?.expansion_billing_cycle)}><option value="once">Pago único</option><option value="monthly">Mensual recurrente</option><option value="yearly">Anual recurrente</option></select></label>
        <label>Condiciones de soporte<input name="supportTerms" defaultValue={text(editingPlan?.support_terms) === "—" ? "" : text(editingPlan?.support_terms)} /></label>
        <label>Actualizaciones<input name="updateTerms" defaultValue={text(editingPlan?.update_terms) === "—" ? "" : text(editingPlan?.update_terms)} /></label>
        <label>Terminales adicionales<input name="extraActivationTerms" defaultValue={text(editingPlan?.extra_activation_terms) === "—" ? "" : text(editingPlan?.extra_activation_terms)} placeholder="Requiere extensión de licencia…" /></label>
        <label className="wide">Términos de uso<textarea name="terms" rows={3} defaultValue={text(editingPlan?.terms) === "—" ? "" : text(editingPlan?.terms)} /></label>
        <button disabled={busy}>{busy ? "Guardando…" : editingPlan ? "Guardar cambios" : "Crear tipo de licencia"}</button>{editingPlan && <button type="button" className="secondary" onClick={() => setEditingPlan(null)}>Cancelar edición</button>}
      </form>
      {licenseTypes.length > 0 && <div className="table-wrap"><table><thead><tr><th>Plan</th><th>Vigencia</th><th>Equipos</th><th>Días offline</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{licenseTypes.map(t => <tr key={text(t.id)}><td>{text(t.name)}</td><td>{t.duration_days === null ? "Vitalicia" : `${text(t.duration_days)} días`}</td><td>{text(t.max_activations)}</td><td>{text(t.offline_days ?? 7)}</td><td>{text(t.price_amount)} {text(t.currency)} / {text(t.billing_cycle)}</td><td>{Number(t.active) === 1 ? "Activo" : "Inactivo"}</td><td><button type="button" className="secondary" onClick={() => setEditingPlan(t)}>Editar</button> <button type="button" className="danger" onClick={() => void togglePlan(t)}>{Number(t.active) === 1 ? "Desactivar" : "Activar"}</button></td></tr>)}</tbody></table></div>}
    </section></>}
    {kind === "licencias" && selectedLicenseId && <section className="panel"><h2>Ampliar capacidad de licencia</h2><p className="muted">Licencia: {selectedLicenseId}. El identificador no cambia. Las ampliaciones solo aumentan el límite y quedan auditadas.</p><form className="form-grid" onSubmit={submitCapacity}>
      <label>Capacidad<select name="capacityKind" defaultValue="devices"><option value="devices">Equipos/dispositivos autorizados</option></select></label>
      <label>Nuevo límite total<input name="newLimit" type="number" min="1" max="10000" required /></label>
      <label>Modalidad<select name="mode" defaultValue="administrative"><option value="administrative">Administrativa / cortesía / cobro externo</option><option value="paid">Comercial con cargo registrado en CRM</option></select></label>
      <label>Precio por unidad adicional<input name="unitPrice" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <label>Periodicidad del cargo<select name="billingCycle" defaultValue="once"><option value="once">Pago único</option><option value="monthly">Mensual recurrente</option><option value="yearly">Anual recurrente</option></select></label>
      <label>Moneda<input name="currency" defaultValue="USD" maxLength={3} /></label>
      <label className="wide">Motivo / referencia de pago<textarea name="notes" rows={2} /></label>
      <button disabled={busy}>{busy ? "Procesando…" : "Registrar ampliación"}</button><button type="button" className="secondary" onClick={() => setSelectedLicenseId("")}>Cancelar</button>
    </form></section>}
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
    {kind === "clientes" && <div className="search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, cédula, RIF o correo…" /><button className="secondary" onClick={() => void load()}>Buscar</button></div>}
    <section className="panel"><div className="list-heading"><h2>Registros</h2><span>{loading ? "Cargando…" : `${items.length} registros mostrados`}</span></div>
      {loading ? <p className="muted">Consultando Turso…</p> : items.length === 0 ? <p className="muted">No hay registros que mostrar.</p> :
      <div className="table-wrap"><table><thead><tr>{(kind === "clientes" ? ["Nombre","Tipo","Documento","Correo","Estado"] : kind === "productos" ? ["Producto","Edición","Versión","Licencias","Estado","Acciones"] : kind === "licencias" ? ["Cliente","Producto","Clave","Estado","Equipos"] : ["Cliente","Producto","Equipo","Estado","Activación","Acción"]).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{items.map((item,i) => <tr key={text(item.id) || i}>
        {kind === "clientes" && <><td>{text(item.display_name)}</td><td>{text(item.type) === "person" ? "Persona" : "Empresa"}</td><td>{text(item.identity_document || item.tax_id)}</td><td>{text(item.email)}</td><td>{text(item.status)}</td></>}
        {kind === "productos" && <><td>{text(item.name)}</td><td>{text(item.edition)}</td><td>{text(item.version)}</td><td>{text(item.license_count)}</td><td>{text(item.status)}</td><td><button type="button" className="secondary" disabled={busy} onClick={() => { setEditingProduct(item); setError(""); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button> <button type="button" className="danger" disabled={busy} onClick={() => void deleteProduct(item)}>Eliminar</button></td></>}
        {kind === "licencias" && <><td>{text(item.customer_name)}</td><td>{text(item.product_name)}</td><td>{text(item.license_key_hint)}</td><td>{text(item.status)}</td><td>{text(item.active_activations)} / {text(item.max_activations)} <button type="button" className="secondary" onClick={() => setSelectedLicenseId(text(item.id))}>Ampliar</button> {item.status !== "revoked" && item.status !== "expired" && <button type="button" className="danger" disabled={busy} onClick={() => void replaceLicense(text(item.id))}>Reposición por formateo</button>}</td></>}
        {kind === "activaciones" && <><td>{text(item.customer_name)}</td><td>{text(item.product_name)}</td><td>{text(item.device_label || item.installation_id)}</td><td>{text(item.status)}</td><td>{text(item.activated_at)}</td><td>{item.status === "active" ? <button className="danger" onClick={() => void revoke(text(item.id))}>Revocar</button> : "—"}</td></>}
      </tr>)}</tbody></table></div>}
    </section>
    <style>{`
      .workspace{max-width:1400px;margin:0 auto;padding:28px clamp(14px,4vw,48px);color:#182536}.workspace header{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:24px}.workspace header a{font-size:12px;color:#526b83;text-decoration:none}.workspace h1{font-size:28px;color:#10243a;margin:9px 0}.workspace h2{font-size:15px;margin:0 0 16px;color:#10243a}.eyebrow{font-size:10px;letter-spacing:1.5px;color:#9a7610;font-weight:800;margin:18px 0 0}.muted{font-size:12px;color:#667487;line-height:1.6}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:18px 0}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.form-grid label{font-size:11px;font-weight:700;color:#526174;display:grid;gap:6px}.form-grid input,.form-grid select,.form-grid textarea,.search input{width:100%;min-width:0;border:1px solid #d8e1ea;border-radius:7px;padding:10px;background:#fff;color:#182536}.form-grid button{align-self:end}.wide{grid-column:1/-1}.workspace button{background:#10243a;color:#fff;border:0;border-radius:7px;padding:10px 14px;font-size:12px;font-weight:700}.workspace button:disabled{opacity:.6}.workspace button.secondary{background:#fff;color:#10243a;border:1px solid #d8e1ea}.workspace button.danger{background:#fff0ef;color:#a32b24;border:1px solid #f0c5c2}.notice,.error{padding:11px 13px;border-radius:8px;font-size:12px}.notice{background:#e8f5ed;color:#247749}.error{background:#fff0ef;color:#a32b24}.search{display:flex;gap:8px;margin:16px 0}.list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.list-heading span{font-size:11px;color:#667487}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #edf0f4}th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#667487;background:#f8fafc}td{color:#27384a}.key-box{display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:#fff8e7;border:1px solid #f1dfa8;padding:13px;border-radius:8px;margin-top:16px}.key-box strong{font-size:12px}.key-box code{font-size:13px;font-weight:800;overflow-wrap:anywhere}.key-box button{margin-left:auto}@media(max-width:800px){.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.workspace{padding:18px 12px}.workspace header{align-items:flex-start}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.panel{padding:14px}.key-box button{margin-left:0}.workspace h1{font-size:24px}}
    `}</style>
  </main>;
}
