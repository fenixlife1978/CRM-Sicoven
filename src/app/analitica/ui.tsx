"use client";
import { useEffect, useState } from "react";

type Row = Record<string, unknown>;
type Data = { days:number; totals:Row; byProduct:Row[]; bySource:Row[]; daily:Row[]; products:Row[] };
const n = (v:unknown) => Number(v || 0).toLocaleString("es-VE");
const s = (v:unknown) => v == null || v === "" ? "—" : String(v);

export default function AnalyticsDashboard() {
  const [days,setDays] = useState(30);
  const [data,setData] = useState<Data|null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(true);
  useEffect(() => {
    let alive = true;
    setBusy(true); setError("");
    fetch("/api/analytics?days="+days,{cache:"no-store"}).then(async r => { const j=await r.json(); if(!r.ok) throw new Error(j.error||"Error consultando analítica"); return j as Data; }).then(j=>{if(alive)setData(j)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Error de conexión")}).finally(()=>{if(alive)setBusy(false)});
    return ()=>{alive=false};
  },[days]);
  const t=data?.totals||{};
  const cards=[["Visitas",t.page_views],["Visitantes estimados",t.sessions],["Clics en descargar",t.download_clicks],["Clics WhatsApp",t.whatsapp_clicks],["Contactos enviados",t.lead_submits]];
  return <section>
    <div className="toolbar"><div><strong>Resumen de actividad</strong><small>Los clics no equivalen a descargas o instalaciones completadas.</small></div><select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option></select></div>
    {error&&<p className="error">{error}</p>}
    {busy&&!data?<p className="muted">Consultando Turso…</p>:<><div className="metrics">{cards.map(([label,value])=><article key={String(label)}><small>{label}</small><strong>{n(value)}</strong></article>)}</div>
    <article className="panel"><h2>Rendimiento por producto</h2><div className="table-wrap"><table><thead><tr><th>Producto</th><th>Código</th><th>Visitas</th><th>Sesiones</th><th>Clics descarga</th><th>WhatsApp</th><th>Contactos</th></tr></thead><tbody>{(data?.byProduct||[]).map((r,i)=><tr key={s(r.id)||i}><td>{s(r.name)}</td><td>{s(r.product_code)}</td><td>{n(r.page_views)}</td><td>{n(r.sessions)}</td><td>{n(r.download_clicks)}</td><td>{n(r.whatsapp_clicks)}</td><td>{n(r.lead_submits)}</td></tr>)}</tbody></table></div></article>
    <div className="columns"><article className="panel"><h2>Procedencia de visitas y eventos</h2><div className="table-wrap"><table><thead><tr><th>Fuente</th><th>Medio</th><th>Eventos</th></tr></thead><tbody>{(data?.bySource||[]).map((r,i)=><tr key={i}><td>{s(r.source)}</td><td>{s(r.medium)}</td><td>{n(r.events)}</td></tr>)}</tbody></table></div></article><article className="panel"><h2>Actividad diaria</h2><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Visitas</th><th>Clics descarga</th></tr></thead><tbody>{(data?.daily||[]).map((r,i)=><tr key={i}><td>{s(r.day)}</td><td>{n(r.page_views)}</td><td>{n(r.download_clicks)}</td></tr>)}</tbody></table></div></article></div>
    <article className="panel"><h2>Catálogo conectado</h2><div className="product-list">{(data?.products||[]).map((p,i)=><div key={s(p.id)||i}><strong>{s(p.name)}</strong><span>{s(p.product_code)} · {s(p.status)}</span></div>)}</div></article>
    </>}
    <style jsx>{`
      section{color:#17283b}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:20px 0}.toolbar strong,.toolbar small{display:block}.toolbar small,.muted{font-size:12px;color:#718096;margin-top:5px}.toolbar select{border:1px solid #dbe3eb;border-radius:8px;padding:10px;background:white;color:#17283b}.metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.metrics article,.panel{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:17px}.metrics small{display:block;color:#718096;font-size:11px}.metrics strong{display:block;font-size:27px;margin-top:8px;color:#10243a}.panel{margin-top:15px}.panel h2{font-size:15px;margin:0 0 14px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:15px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px;white-space:nowrap}th,td{text-align:left;padding:10px;border-bottom:1px solid #edf1f5}th{color:#718096;font-size:10px;text-transform:uppercase}td{color:#304257}.product-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.product-list div{background:#f7f9fb;border-radius:8px;padding:12px;min-width:0}.product-list strong,.product-list span{display:block;overflow-wrap:anywhere}.product-list span{font-size:10px;color:#718096;margin-top:5px}.error{background:#fff0ef;color:#a32b24;padding:10px;border-radius:8px;font-size:12px}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.columns{grid-template-columns:1fr}.product-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.toolbar{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr 1fr}.metrics article{padding:13px}.metrics strong{font-size:22px}.product-list{grid-template-columns:1fr}}
    `}</style>
  </section>;
}
