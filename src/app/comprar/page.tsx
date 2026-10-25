"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Product = { id: string; name: string; edition?: string | null; description?: string | null };
type Plan = { id: string; product_id: string; name: string; description?: string | null; price_amount: number; currency: string; duration_days?: number | null; max_activations: number };
type Bank = { id: string; bank_code: string; bank_name: string; holder_name: string; identity_document: string; phone_number: string; account_number?: string | null };

export default function BuySoftwarePage() {
  const [products,setProducts] = useState<Product[]>([]);
  const [plans,setPlans] = useState<Plan[]>([]);
  const [banks,setBanks] = useState<Bank[]>([]);
  const [productId,setProductId] = useState("");
  const [planId,setPlanId] = useState("");
  const [customerType,setCustomerType] = useState<"person"|"company">("person");
  const [firstName,setFirstName] = useState("");
  const [lastName,setLastName] = useState("");
  const [legalName,setLegalName] = useState("");
  const [identityDocument,setIdentityDocument] = useState("");
  const [taxId,setTaxId] = useState("");
  const [email,setEmail] = useState("");
  const [phone,setPhone] = useState("");
  const [amount,setAmount] = useState("");
  const [referenceLastSix,setReferenceLastSix] = useState("");
  const [paymentDate,setPaymentDate] = useState(new Date().toISOString().slice(0,10));
  const [sourceBank,setSourceBank] = useState("Banco de Venezuela");
  const [destinationBankId,setDestinationBankId] = useState("");
  const [loading,setLoading] = useState(true);
  const [sending,setSending] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/commercial-catalog",{cache:"no-store"}).then(async r=>{
      const d=await r.json(); if(!r.ok) throw new Error(d.error||"Catálogo no disponible");
      setProducts(d.products||[]);setPlans(d.plans||[]);setBanks(d.banks||[]);
      if(d.products?.[0]) setProductId(d.products[0].id);
      if(d.banks?.[0]) setDestinationBankId(d.banks[0].id);
    }).catch(e=>setError(e instanceof Error?e.message:"No se pudo cargar el catálogo.")).finally(()=>setLoading(false));
  },[]);

  const productPlans = plans.filter(p=>p.product_id===productId);
  const selectedPlan = productPlans.find(p=>p.id===planId) || productPlans[0];

  useEffect(()=>{ if(productPlans.length && !productPlans.some(p=>p.id===planId)) setPlanId(productPlans[0].id); },[productId,plans,planId,productPlans]);

  async function submit(e:FormEvent) {
    e.preventDefault();setError("");setSuccess("");
    if(!selectedPlan){setError("Este producto todavía no tiene planes disponibles.");return;}
    setSending(true);
    try {
      const r=await fetch("/api/payment-reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        productId,planId:selectedPlan.id,customerType,firstName,lastName,legalName,identityDocument,taxId,email,phone,
        amount:Number(amount),referenceLastSix,paymentDate,sourceBank,destinationBankId
      })});
      const d=await r.json();if(!r.ok) throw new Error(d.error||"No se pudo enviar el reporte.");
      setSuccess(`Reporte recibido correctamente. Número de seguimiento: ${d.reportId}. Tu pago debe ser verificado manualmente antes de emitir la licencia.`);
      setReferenceLastSix("");setAmount("");
    } catch(e) {setError(e instanceof Error?e.message:"No se pudo enviar el reporte.");}
    finally {setSending(false);}
  }

  return <main className="wrap">
    <header><Link href="/" className="brand">EFASfreelancer <span>· Soluciones Digitales</span></Link><span className="secure">Compra y licenciamiento</span></header>
    <section className="hero"><p className="eyebrow">SOFTWARE PARA WINDOWS</p><h1>Encuentra tu sistema.<br/>Actívalo con una licencia.</h1><p>Consulta los planes publicados, realiza tu Pago Móvil y reporta la operación. La licencia se emite después de verificar el abono.</p></section>
    {loading?<p className="notice">Cargando productos y planes…</p>:products.length===0?<section className="notice"><h2>Catálogo en preparación</h2><p>En este momento no hay productos públicos con planes configurados.</p></section>:<form onSubmit={submit} className="form">
      <section className="panel"><h2>1. Selecciona el producto y plan</h2><label>Aplicación<select value={productId} onChange={e=>setProductId(e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.edition?` · ${p.edition}`:""}</option>)}</select></label>
      <div className="plans">{productPlans.map(p=><label className={selectedPlan?.id===p.id?"plan selected":"plan"} key={p.id}><input type="radio" name="plan" value={p.id} checked={selectedPlan?.id===p.id} onChange={()=>setPlanId(p.id)}/><span><strong>{p.name}</strong><small>{p.description||`${p.max_activations} equipo(s) autorizados`}</small></span><b>{Number(p.price_amount).toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2})} {p.currency}</b></label>)}</div>
      {selectedPlan && <p className="fine">Equipos autorizados: {selectedPlan.max_activations}{selectedPlan.duration_days? ` · Vigencia: ${selectedPlan.duration_days} días`:" · Vigencia según las condiciones del plan"}.</p>}
      </section>
      <section className="panel"><h2>2. Datos del titular</h2><div className="toggle"><button type="button" className={customerType==="person"?"on":""} onClick={()=>setCustomerType("person")}>Persona natural</button><button type="button" className={customerType==="company"?"on":""} onClick={()=>setCustomerType("company")}>Empresa</button></div>
      {customerType==="person"?<div className="fields"><label>Nombres<input required value={firstName} onChange={e=>setFirstName(e.target.value)} maxLength={100}/></label><label>Apellidos<input required value={lastName} onChange={e=>setLastName(e.target.value)} maxLength={100}/></label><label>Cédula de identidad<input required value={identityDocument} onChange={e=>setIdentityDocument(e.target.value)} maxLength={40}/></label><label>RIF personal (opcional)<input value={taxId} onChange={e=>setTaxId(e.target.value)} maxLength={40}/></label></div>:<div className="fields"><label className="full">Razón social<input required value={legalName} onChange={e=>setLegalName(e.target.value)} maxLength={200}/></label><label>RIF<input required value={taxId||identityDocument} onChange={e=>{setTaxId(e.target.value);setIdentityDocument(e.target.value)}} maxLength={40}/></label><label>Documento / RIF para registro<input required value={identityDocument} onChange={e=>setIdentityDocument(e.target.value)} maxLength={40}/></label></div>}
      <div className="fields"><label>Teléfono<input required value={phone} onChange={e=>setPhone(e.target.value)} maxLength={40} inputMode="tel"/></label><label>Correo electrónico (opcional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label></div>
      </section>
      <section className="panel"><h2>3. Datos del Pago Móvil</h2>{banks.length===0?<p className="notice">El administrador todavía no ha configurado las cuentas receptoras.</p>:<><div className="bankGrid">{banks.map(b=><label className="bank" key={b.id}><input type="radio" name="destinationBank" value={b.id} checked={destinationBankId===b.id} onChange={()=>setDestinationBankId(b.id)}/><span className="bankBrand"><img src={b.bank_code==="BDV"?"/banks/banco_de_venezuela_64.png":"/banks/banco_mercantil_64.png"} alt={b.bank_name} /><strong>{b.bank_name}</strong></span><small>Documento: {b.identity_document}</small><small>Teléfono: {b.phone_number}</small>{b.account_number&&<small>Cuenta: {b.account_number}</small>}</label>)}</div>
      <div className="fields"><label>Monto pagado<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal"/><small>Precio del plan: {selectedPlan?Number(selectedPlan.price_amount).toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+selectedPlan.currency:"—"}</small></label><label>Fecha del pago<input required type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} max={new Date().toISOString().slice(0,10)}/></label><label>Banco de origen<select value={sourceBank} onChange={e=>setSourceBank(e.target.value)}><option>Banco de Venezuela</option><option>Mercantil</option><option>Otro banco nacional</option></select></label><label>Últimos 6 dígitos de referencia<input required value={referenceLastSix} onChange={e=>setReferenceLastSix(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6}/></label></div>
      </>}
      <p className="warning">Enviar este formulario no confirma el pago ni activa una licencia automáticamente. El administrador verificará el abono antes de emitirla.</p>
      {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}
      <button className="submit" disabled={sending||!selectedPlan||banks.length===0}>{sending?"Enviando reporte…":"Enviar reporte de pago"}</button>
      </section>
    </form>}
    <footer>EFASfreelancer Soluciones Digitales · Pago Móvil sujeto a verificación manual.</footer>
    <style>{`*{box-sizing:border-box}body{margin:0}.wrap{max-width:960px;margin:auto;padding:18px 16px 44px;color:#172b40}header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0 20px;border-bottom:1px solid #e1e7ed}.brand{font-weight:900;color:#153b5b;text-decoration:none}.brand span{font-weight:500;color:#718094;font-size:12px}.secure{font-size:10px;color:#718094}.hero{background:linear-gradient(120deg,#10243a,#214c70);color:white;border-radius:15px;padding:clamp(24px,5vw,42px);margin:22px 0}.eyebrow{font-size:10px;letter-spacing:2px;color:#f0c45b;font-weight:800}.hero h1{font-size:clamp(27px,5vw,42px);line-height:1.12;margin:12px 0}.hero p:last-child{max-width:650px;color:#d3dfeb;line-height:1.7;font-size:14px}.form{display:grid;gap:15px}.panel{background:white;border:1px solid #e0e7ee;border-radius:13px;padding:clamp(16px,3vw,24px)}.panel h2{font-size:17px;margin:0 0 18px}.panel label{display:block;font-size:12px;color:#53667b;font-weight:650}.panel input:not([type=radio]),.panel select{display:block;width:100%;margin-top:7px;padding:12px;border:1px solid #d8e1e9;border-radius:8px;background:#fff;color:#172b40;font:inherit;font-weight:400;min-width:0}.panel small{display:block;color:#718094;font-size:10px;margin-top:6px;font-weight:400}.plans{display:grid;gap:8px;margin-top:14px}.plan{display:flex!important;align-items:center;gap:12px;padding:13px;border:1px solid #dfe7ee;border-radius:9px;cursor:pointer}.plan.selected{border-color:#315e80;background:#f4f8fb}.plan input{flex:none}.plan span{flex:1;min-width:0}.plan strong,.plan small{display:block}.plan b{font-size:12px;color:#173f60;white-space:nowrap}.fine{font-size:11px;color:#687a8e}.toggle{display:flex;gap:7px;margin-bottom:16px}.toggle button{border:1px solid #d9e2ea;border-radius:8px;padding:10px 14px;background:white;color:#43596e}.toggle button.on{background:#173f60;color:white;border-color:#173f60}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:15px}.full{grid-column:1/-1}.bankGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.bank{border:1px solid #dce5ed;border-radius:10px;padding:14px;cursor:pointer}.bank input{display:inline-block!important;width:auto!important;margin:0 8px 10px 0!important}.bank strong{font-size:13px;color:#153b5b}.bankBrand{display:flex;align-items:center;gap:10px;min-height:42px;margin-bottom:8px}.bankBrand img{display:block;width:64px;height:40px;object-fit:contain;object-position:left center;flex:none}.bankBrand strong{font-size:12px}.bank small{overflow-wrap:anywhere}.warning,.notice{font-size:12px;line-height:1.7;padding:13px;background:#fff7e7;border-radius:8px;color:#795b1b;margin:15px 0}.error,.success{font-size:12px;padding:12px;border-radius:8px}.error{background:#fff0f0;color:#962e2e}.success{background:#e8f6ee;color:#236b43}.submit{width:100%;padding:14px;border:0;border-radius:9px;background:#173f60;color:white;font-weight:800;cursor:pointer}.submit:disabled{opacity:.5}footer{text-align:center;color:#8190a1;font-size:10px;padding:26px 0 4px}@media(max-width:540px){header{align-items:flex-start;flex-direction:column}.fields,.bankGrid{grid-template-columns:1fr}.plan{align-items:flex-start!important;flex-wrap:wrap}.plan b{margin-left:25px}.panel{padding:16px}}`}</style>
  </main>;
}
