"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Report = {
  id: string; product_name: string; plan_name: string; customer_type: string;
  first_name?: string | null; last_name?: string | null; legal_name?: string | null;
  identity_document: string; tax_id?: string | null; email?: string | null; phone: string;
  amount: number; reference_last_six: string; payment_date: string; source_bank: string;
  destination_bank: string; status: string; created_at: string; review_note?: string | null;
};

export default function CommercialPayments() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<Record<string,string>>({});
  const [soundEnabled, setSoundEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/payment-reports", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los pagos.");
      setReports(data.reports || []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error de conexión."); }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [load]);

  async function review(report: Report, decision: "approve" | "reject") {
    if (decision === "approve" && !window.confirm("¿Confirmaste el abono en la cuenta bancaria? Solo apruebes después de verificar el pago real.")) return;
    if (decision === "reject" && !window.confirm("¿Rechazar este reporte de pago?")) return;
    setBusy(report.id);
    try {
      const response = await fetch(`/api/payment-reports/${encodeURIComponent(report.id)}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note[report.id] || "" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo procesar el reporte.");
      if (decision === "approve" && data.licenseKey) {
        const message = `PAGO APROBADO\nCliente: ${data.certificate.customerName}\nProducto: ${data.certificate.productName}\nPlan: ${data.certificate.licenseTypeName}\nClave: ${data.licenseKey}\n\nCopia esta clave ahora. No se volverá a mostrar en el CRM.`;
        window.alert(message);
      } else window.alert("Reporte rechazado.");
      await load();
    } catch (e) { window.alert(e instanceof Error ? e.message : "Error inesperado."); }
    finally { setBusy(""); }
  }

  const pending = reports.filter(r => r.status === "pending_review").length;
  return <main className="page">
    <header className="top"><div><Link href="/" className="back">← Centro de control</Link><p className="eyebrow">COMERCIALIZACIÓN</p><h1>Reportes de Pago Móvil</h1><p className="sub">Bandeja administrativa de solicitudes comerciales. Los pagos se verifican manualmente.</p></div><button className="refresh" onClick={() => void load()}>Actualizar</button></header>
    <section className="stats"><div><span>Pendientes de revisión</span><strong>{pending}</strong></div><div><span>Reportes registrados</span><strong>{reports.length}</strong></div><div><span>Notificación</span><strong>En esta pantalla</strong><small>Actualización cada 30 segundos</small></div></section>
    {error && <p className="error" role="alert">{error}</p>}
    {reports.length === 0 && !error && <section className="empty"><h2>No hay reportes de pago</h2><p>Cuando un cliente envíe el formulario público, aparecerá aquí.</p></section>}
    <section className="list">{reports.map(r => <article className="report" key={r.id}>
      <div className="reportHead"><div><span className={`status ${r.status}`}>{r.status === "pending_review" ? "Pendiente" : r.status === "approved" ? "Aprobado" : "Rechazado"}</span><h2>{r.customer_type === "company" ? r.legal_name : `${r.first_name || ""} ${r.last_name || ""}`.trim()}</h2><p>{r.product_name} · {r.plan_name}</p></div><strong className="amount">{Number(r.amount).toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
      <dl><div><dt>Cédula / RIF</dt><dd>{r.identity_document}{r.tax_id ? ` · ${r.tax_id}` : ""}</dd></div><div><dt>Teléfono</dt><dd>{r.phone}</dd></div><div><dt>Correo</dt><dd>{r.email || "No indicado"}</dd></div><div><dt>Fecha del pago</dt><dd>{r.payment_date}</dd></div><div><dt>Banco de origen</dt><dd>{r.source_bank}</dd></div><div><dt>Banco destino</dt><dd>{r.destination_bank}</dd></div><div><dt>Últimos 6 de referencia</dt><dd>{r.reference_last_six}</dd></div><div><dt>Recibido</dt><dd>{new Date(r.created_at).toLocaleString("es-VE")}</dd></div></dl>
      {r.status === "pending_review" ? <><label className="noteLabel">Nota de revisión (opcional)<textarea value={note[r.id] || ""} onChange={e => setNote(prev => ({...prev,[r.id]:e.target.value}))} maxLength={500} placeholder="Motivo del rechazo o nota para auditoría" /></label><div className="actions"><button className="reject" disabled={busy===r.id} onClick={() => void review(r,"reject")}>{busy===r.id ? "Procesando…" : "Rechazar"}</button><button className="approve" disabled={busy===r.id} onClick={() => void review(r,"approve")}>{busy===r.id ? "Procesando…" : "Confirmé el pago · Aprobar y emitir licencia"}</button></div></> : <p className="reviewNote">Nota: {r.review_note || "Sin observaciones"}</p>}
    </article>)}</section>
    <style>{`
      *{box-sizing:border-box}.page{max-width:1100px;margin:0 auto;padding:24px 18px 50px;color:#14283d}.top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}.back{color:#315a7e;text-decoration:none;font-size:13px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:1.6px;color:#8a6b18;margin:18px 0 6px}.top h1{font-size:clamp(24px,4vw,34px);margin:0}.sub{color:#64758a;font-size:13px;line-height:1.6}.refresh{padding:11px 15px;border:1px solid #d8e1ea;border-radius:8px;background:white}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}.stats>div{background:white;border:1px solid #e0e7ee;border-radius:12px;padding:16px}.stats span,.stats small{display:block;color:#6d7d90;font-size:11px}.stats strong{display:block;font-size:23px;margin:7px 0;color:#153b5b}.stats small{font-size:10px}.error{background:#fff1f0;color:#9a2424;padding:12px;border-radius:8px}.empty{background:#fff;border:1px dashed #cdd7e1;padding:28px;text-align:center;border-radius:12px}.empty p{color:#68798c;font-size:13px}.list{display:grid;gap:14px}.report{background:white;border:1px solid #dfe7ef;border-radius:13px;padding:19px;box-shadow:0 4px 15px #10243a06}.reportHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.reportHead h2{font-size:17px;margin:9px 0 4px;overflow-wrap:anywhere}.reportHead p{font-size:12px;color:#6a7b8e;margin:0}.amount{font-size:22px;white-space:nowrap;color:#153b5b}.status{display:inline-block;font-size:10px;font-weight:800;padding:5px 8px;border-radius:20px;background:#fff0d8;color:#815b0b}.status.approved{background:#e3f5eb;color:#226c43}.status.rejected{background:#fbe9e9;color:#9b3030}dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:20px 0}dt{font-size:10px;color:#7b8a9a;margin-bottom:5px}dd{font-size:12px;font-weight:600;margin:0;overflow-wrap:anywhere}.noteLabel{display:block;font-size:11px;color:#5b6b7d}.noteLabel textarea{display:block;width:100%;min-height:65px;margin-top:6px;padding:10px;border:1px solid #d7e0e9;border-radius:8px;font:inherit;font-size:12px}.actions{display:flex;justify-content:flex-end;gap:9px;margin-top:12px;flex-wrap:wrap}.actions button{border:0;border-radius:8px;padding:11px 14px;font-weight:700;font-size:12px;cursor:pointer}.actions button:disabled{opacity:.5}.reject{background:#f7e8e8;color:#942d2d}.approve{background:#163e60;color:white}.reviewNote{font-size:12px;color:#65778b}@media(max-width:700px){.top{align-items:flex-start}.stats{grid-template-columns:1fr 1fr}.stats>div:last-child{grid-column:1/-1}dl{grid-template-columns:repeat(2,minmax(0,1fr))}.report{padding:14px}.amount{font-size:17px}}@media(max-width:420px){.top{display:block}.refresh{margin-top:10px}.reportHead{display:block}.amount{display:block;margin-top:12px}.actions button{width:100%}}
    `}</style>
  </main>;
}
