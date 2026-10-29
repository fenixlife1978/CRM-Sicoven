"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ShieldCheck,
  Check,
  Send,
  Download,
  Printer,
  RefreshCw,
  Lock,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
  Copy
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  product_code?: string | null;
  edition?: string | null;
  version?: string | null;
  description?: string | null;
};

type Plan = {
  id: string;
  product_id: string;
  name: string;
  description?: string | null;
  price_amount: number;
  currency: string;
  duration_days?: number | null;
  max_activations: number;
  popular?: boolean;
  features?: string[];
};

type Bank = {
  id: string;
  bank_code: string;
  bank_name: string;
  holder_name?: string | null;
  identity_document: string;
  phone_number: string;
  account_number?: string | null;
};

type CertificateData = {
  certificateId: string;
  issuedAt: string;
  licenseKey: string;
  licenseTypeName: string;
  startsAt: string;
  expiresAt: string | null;
  maxActivations: number;
  customerName: string;
  identityDocument: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  productName: string;
  productEdition?: string | null;
  productVersion?: string | null;
};

type ActiveReport = {
  reportId: string;
  status: "pending_review" | "approved" | "rejected";
  customerName: string;
  identityDocument: string;
  phone: string;
  email: string;
  productName: string;
  planName: string;
  amount: number;
  referenceLastSix: string;
  referenceFull?: string;
  paymentDate: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  certificate?: CertificateData | null;
};

const DEFAULT_PLANS: Plan[] = [
  {
    id: "plan-basico",
    product_id: "prod-sicoven",
    name: "Plan Básico",
    description: "Ideal para pequeños negocios",
    price_amount: 49,
    currency: "USD",
    duration_days: 90,
    max_activations: 1,
    features: ["1 equipo", "1 usuario", "Soporte por 3 meses"]
  },
  {
    id: "plan-estandar",
    product_id: "prod-sicoven",
    name: "Plan Estándar",
    description: "Para negocios en crecimiento",
    price_amount: 89,
    currency: "USD",
    duration_days: 180,
    max_activations: 3,
    popular: true,
    features: ["3 equipos", "3 usuarios", "Soporte por 6 meses"]
  },
  {
    id: "plan-profesional",
    product_id: "prod-sicoven",
    name: "Plan Profesional",
    description: "Para operaciones avanzadas",
    price_amount: 149,
    currency: "USD",
    duration_days: 365,
    max_activations: 5,
    features: ["5 equipos", "Usuarios ilimitados", "Soporte por 12 meses"]
  }
];

export default function BuySoftwarePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [whatsappAdminPhone, setWhatsappAdminPhone] = useState("04125773996");

  const [productId, setProductId] = useState("");
  const [planId, setPlanId] = useState("");
  const [fullName, setFullName] = useState("");
  const [identityDocument, setIdentityDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [amount, setAmount] = useState("");
  const [referenceFull, setReferenceFull] = useState("");
  const [referenceTouched, setReferenceTouched] = useState(false);
  const [paymentDate, setPaymentDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  );
  const [sourceBank, setSourceBank] = useState("Banco de Venezuela");
  const [destinationBankId, setDestinationBankId] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // License Tracking and Certificate State
  const [activeReport, setActiveReport] = useState<ActiveReport | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Real-time reference validation
  const cleanReference = referenceFull.trim();
  const isReferenceNumeric = cleanReference.length > 0 && /^\d+$/.test(cleanReference);
  const isReferenceMinLength = cleanReference.length >= 6;
  const isReferenceValid = isReferenceNumeric && isReferenceMinLength;

  let referenceError = "";
  if (referenceTouched || cleanReference.length > 0) {
    if (!cleanReference) {
      referenceError = "La referencia bancaria es obligatoria.";
    } else if (!isReferenceNumeric) {
      referenceError = "La referencia solo debe contener números (0-9).";
    } else if (!isReferenceMinLength) {
      referenceError = `Mínimo 6 dígitos numéricos (llevas ${cleanReference.length} de 6).`;
    }
  }

  // Load Catalog and recover last reported payment if exists
  useEffect(() => {
    fetch("/api/commercial-catalog", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) {
          const prods = d.products && d.products.length > 0 ? d.products : [
            { id: "prod-sicoven", name: "Sistema POS Profesional", edition: "SICOVEN ERP", version: "2.0", description: "Controla tus ventas, inventario y caja desde un solo lugar. Ideal para tiendas, bodegas y comercios." }
          ];
          setProducts(prods);

          let fetchedPlans: Plan[] = (d.plans && d.plans.length > 0) ? d.plans : DEFAULT_PLANS;
          fetchedPlans = fetchedPlans.map((p: Plan, index: number) => {
            const def = DEFAULT_PLANS[index] || DEFAULT_PLANS[0];
            return {
              ...p,
              popular: p.name.toLowerCase().includes("estándar") || p.name.toLowerCase().includes("profesional") || p.popular,
              features: p.features || def.features
            };
          });

          setPlans(fetchedPlans);
          const initialBanks = d.banks && d.banks.length > 0 ? d.banks : [
            {
              id: "bank-bdv",
              bank_code: "BDV",
              bank_name: "Banco de Venezuela",
              holder_name: "EFASfreelancer C.A.",
              identity_document: "J-12345678-9",
              phone_number: "0412 123 4567",
              account_number: "0102-1234-56-7890123456"
            },
            {
              id: "bank-mercantil",
              bank_code: "MERCANTIL",
              bank_name: "Banco Mercantil",
              holder_name: "EFASfreelancer C.A.",
              identity_document: "J-12345678-9",
              phone_number: "0412 123 4567",
              account_number: "0105-1234-56-7890123456"
            }
          ];
          setBanks(initialBanks);
          setWhatsappAdminPhone(d.whatsappAdminPhone || "04125773996");

          if (prods[0]) setProductId(prods[0].id);
          if (fetchedPlans[0]) {
            setPlanId(fetchedPlans[0].id);
            setAmount(String(fetchedPlans[0].price_amount));
          }
          if (initialBanks[0]) setDestinationBankId(initialBanks[0].id);
        }
      })
      .catch(() => {
        setProducts([{ id: "prod-sicoven", name: "Sistema POS Profesional", edition: "SICOVEN", version: "2.0", description: "Controla tus ventas, inventario y caja desde un solo lugar. Ideal para tiendas, bodegas y comercios." }]);
        setPlans(DEFAULT_PLANS);
        setPlanId("plan-basico");
        setAmount("49.00");
        setBanks([
          {
            id: "bank-bdv",
            bank_code: "BDV",
            bank_name: "Banco de Venezuela",
            holder_name: "EFASfreelancer C.A.",
            identity_document: "J-12345678-9",
            phone_number: "0412 123 4567",
            account_number: "0102-1234-56-7890123456"
          },
          {
            id: "bank-mercantil",
            bank_code: "MERCANTIL",
            bank_name: "Banco Mercantil",
            holder_name: "EFASfreelancer C.A.",
            identity_document: "J-12345678-9",
            phone_number: "0412 123 4567",
            account_number: "0105-1234-56-7890123456"
          }
        ]);
        setDestinationBankId("bank-bdv");
      })
      .finally(() => setLoading(false));

    // Try reading last reported payment from localStorage
    try {
      const saved = localStorage.getItem("crm_sicoven_last_report");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.reportId) {
          setActiveReport(parsed);
          checkReportStatus(parsed.reportId);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const selectedProduct = products.find((p) => p.id === productId) || products[0];
  const productPlans = plans.filter((p) => p.product_id === productId || plans.length <= 3);
  const selectedPlan = productPlans.find((p) => p.id === planId) || productPlans[0] || DEFAULT_PLANS[0];
  const selectedBank = banks.find((b) => b.id === destinationBankId) || banks[0];

  useEffect(() => {
    if (selectedPlan) {
      setAmount(Number(selectedPlan.price_amount).toFixed(2));
    }
  }, [selectedPlan]);

  const selectPlanById = (id: string) => {
    setPlanId(id);
    const p = plans.find((pl) => pl.id === id);
    if (p) {
      setAmount(Number(p.price_amount).toFixed(2));
    }
  };

  async function checkReportStatus(reportId: string) {
    if (!reportId) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/payment-reports/${reportId}/certificate`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActiveReport((prev) => {
          const updated: ActiveReport = {
            reportId: data.reportId,
            status: data.status,
            customerName: data.certificate?.customerName || prev?.customerName || "Cliente",
            identityDocument: data.certificate?.identityDocument || prev?.identityDocument || "",
            phone: data.certificate?.customerPhone || prev?.phone || "",
            email: data.certificate?.customerEmail || prev?.email || "",
            productName: data.certificate?.productName || data.productName || prev?.productName || "SICOVEN",
            planName: data.certificate?.licenseTypeName || data.planName || prev?.planName || "Plan",
            amount: data.amount || prev?.amount || 0,
            referenceLastSix: data.referenceLastSix || prev?.referenceLastSix || "",
            paymentDate: data.paymentDate || prev?.paymentDate || "",
            reviewNote: data.reviewNote || prev?.reviewNote,
            reviewedAt: data.reviewedAt || prev?.reviewedAt,
            certificate: data.certificate || prev?.certificate
          };
          localStorage.setItem("crm_sicoven_last_report", JSON.stringify(updated));
          return updated;
        });
      }
    } catch {
      // Silent error during polling
    } finally {
      setCheckingStatus(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedPlan) {
      setError("Por favor selecciona un plan antes de continuar.");
      return;
    }

    if (!isReferenceValid) {
      setReferenceTouched(true);
      setError("La referencia bancaria debe ser numérica y contener al menos 6 dígitos.");
      return;
    }

    setSending(true);
    try {
      // Determine person or company from fullName
      const isCompany = identityDocument.toUpperCase().startsWith("J-") || identityDocument.toUpperCase().startsWith("G-");
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || fullName.trim();
      const lastName = nameParts.slice(1).join(" ") || "Cliente";

      const payload = {
        productId: productId || products[0]?.id || "prod-sicoven",
        planId: selectedPlan.id,
        customerType: isCompany ? "company" : "person",
        firstName: isCompany ? "" : firstName,
        lastName: isCompany ? "" : lastName,
        legalName: isCompany ? fullName.trim() : "",
        identityDocument: identityDocument.trim().toUpperCase(),
        taxId: identityDocument.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        amount: Number(amount),
        referenceFull: cleanReference,
        referenceLastSix: cleanReference.slice(-6),
        paymentDate,
        sourceBank,
        destinationBankId: selectedBank?.id || banks[0]?.id
      };

      const r = await fetch("/api/payment-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo registrar el reporte de pago.");

      setSuccess(`¡Reporte recibido con éxito! Número de seguimiento: ${d.reportId}. Tu pago ha quedado registrado y en verificación para la emisión de tu licencia.`);

      const newReport: ActiveReport = {
        reportId: d.reportId,
        status: "pending_review",
        customerName: fullName.trim(),
        identityDocument: identityDocument.toUpperCase(),
        phone,
        email,
        productName: selectedProduct?.name || "SICOVEN",
        planName: selectedPlan.name,
        amount: Number(amount),
        referenceLastSix: cleanReference.slice(-6),
        referenceFull: cleanReference,
        paymentDate
      };
      setActiveReport(newReport);
      localStorage.setItem("crm_sicoven_last_report", JSON.stringify(newReport));

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el reporte.");
    } finally {
      setSending(false);
    }
  }

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] text-[#1c2e45] font-sans antialiased text-[13px] leading-normal selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header Bar matching Image 1 */}
      <header className="bg-[#0c243e] text-white py-2.5 px-4 sm:px-8 border-b border-[#183659] shadow-sm sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4">
          {/* Logo Horizontal Original de EFASfreelancer */}
          <div className="flex items-center gap-3">
            <div className="bg-white px-3 py-1.5 rounded-lg shadow-xs flex items-center">
              <img
                src="/efasfreelancer-logo.svg"
                alt="EFASfreelancer Soluciones Digitales"
                className="h-7 sm:h-8 w-auto object-contain"
              />
            </div>
          </div>

          {/* Smooth In-Page Nav Links (No redirection to CRM dashboard) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-200">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Inicio
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("seccion-planes");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Productos
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("seccion-planes");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Planes
            </button>
            <a
              href={`https://wa.me/${whatsappAdminPhone.replace(/\D/g, "").replace(/^0/, "58")}?text=${encodeURIComponent("Hola, necesito soporte sobre la adquisición y activación de SICOVEN.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Soporte</span>
            </a>
            <a
              href={`https://wa.me/${whatsappAdminPhone.replace(/\D/g, "").replace(/^0/, "58")}?text=${encodeURIComponent("Hola, deseo más información sobre los planes de SICOVEN.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors cursor-pointer"
            >
              Contacto
            </a>
          </nav>

          {/* Secure Purchase Badge */}
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-white flex-shrink-0" />
            <div className="text-left text-xs leading-none hidden sm:block">
              <span className="font-bold text-white block text-[11px]">Compra Segura</span>
              <span className="text-[9px] text-slate-300">Tus datos están protegidos</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container - Compact 2-column layout matching Image 1 */}
      <main className="max-w-[1280px] mx-auto p-3 sm:p-5 lg:p-6">
        {/* Unlocked License & Certificate Banner (If user has reported a payment) */}
        {activeReport && (
          <section className="mb-5 rounded-xl overflow-hidden border shadow-sm transition-all">
            {activeReport.status === "approved" ? (
              <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-[#0e3b33] text-white p-4 sm:p-5 border-emerald-500/40">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-500/30 uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" />
                      ¡Pago Aprobado y Licencia Emitida!
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      Tu Certificado de Licencia está listo
                    </h2>
                    <p className="text-emerald-100/90 text-xs max-w-2xl">
                      El pago de tu plan <strong>{activeReport.planName}</strong> para <strong>{activeReport.customerName}</strong> ha sido verificado con éxito.
                    </p>

                    {activeReport.certificate?.licenseKey && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-emerald-200 font-medium">Clave de activación:</span>
                        <div className="bg-black/40 border border-emerald-400/40 px-3 py-1.5 rounded-md font-mono text-sm font-bold text-emerald-300 tracking-wider flex items-center gap-2">
                          <span>{activeReport.certificate.licenseKey}</span>
                          <button
                            onClick={() => copyLicenseKey(activeReport.certificate!.licenseKey)}
                            title="Copiar clave"
                            className="p-1 hover:text-white text-emerald-400 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {copiedKey && (
                          <span className="text-xs text-emerald-300 font-semibold bg-emerald-800/60 px-2 py-0.5 rounded">
                            ¡Copiada!
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <button
                      onClick={() => setShowCertificateModal(true)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-black shadow hover:from-amber-300 hover:to-amber-400 transition-all text-xs uppercase tracking-wide cursor-pointer hover:scale-[1.01]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar Certificado
                    </button>
                    <button
                      onClick={() => checkReportStatus(activeReport.reportId)}
                      disabled={checkingStatus}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-800/50 hover:bg-emerald-800 text-white font-medium text-xs border border-emerald-600/40 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${checkingStatus ? "animate-spin" : ""}`} />
                      Actualizar
                    </button>
                  </div>
                </div>
              </div>
            ) : activeReport.status === "pending_review" ? (
              <div className="bg-gradient-to-r from-[#17304f] to-[#1d3d63] text-white p-4 sm:p-5 border-blue-400/30">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-400/30">
                      <Lock className="w-3 h-3" />
                      Pago en Revisión · Reporte #{activeReport.reportId.slice(0, 8)}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Verificación en curso: Tu Certificado se desbloqueará aquí
                    </h3>
                    <p className="text-blue-100/80 text-xs max-w-2xl">
                      Reporte de pago registrado por <strong>{activeReport.amount} USD</strong> para el plan <strong>{activeReport.planName}</strong>. En cuanto sea conciliado, se desbloqueará automáticamente la descarga de tu certificado de licencia.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => checkReportStatus(activeReport.reportId)}
                      disabled={checkingStatus}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? "animate-spin" : ""}`} />
                      {checkingStatus ? "Consultando…" : "Verificar Estado"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-900/90 text-white p-4 border-red-500/40 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="block text-sm font-bold text-white">Reporte de pago no validado</strong>
                  <p className="text-red-200 mt-0.5">{activeReport.reviewNote || "No se pudo constatar la transferencia bancaria con la referencia suministrada."}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2-Column Main Layout - Compacted matching Image 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Product Banner, Plans Stack & Download Card  */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Product Header Card with Official SICOVEN Emblem */}
            <div className="bg-white border border-[#d8e2eb] rounded-xl p-4 shadow-2xs">
              <div className="flex items-start gap-3.5">
                {/* Official SICOVEN Icon Emblem ("S" with two yellow stripes underneath) */}
                <div className="w-14 h-14 rounded-xl bg-[#0c243e] p-1 flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-200/50">
                  <img
                    src="/sicoven-emblem.svg"
                    alt="Icono Oficial SICOVEN"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-[#0c243e] tracking-tight">
                      SICOVEN
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md">
                      Sistema Contable
                    </span>
                  </div>
                  <p className="text-xs text-[#4e657f] leading-snug">
                    Sistema integral contable y de gestión. Controla ventas, inventario, facturación y caja desde un solo lugar.
                  </p>
                </div>
              </div>

              {/* 3 Pills: Fácil de usar, Reportes en tiempo real, Soporte técnico */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-[#2f4966] font-medium">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80">
                  <span>✎</span>
                  <span>Fácil de usar</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80">
                  <span>📊</span>
                  <span>Reportes en tiempo real</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80">
                  <span>⚙</span>
                  <span>Soporte técnico</span>
                </span>
              </div>
            </div>

            {/* 2. "Selecciona un plan" Vertical Stack matching Image 1 */}
            <div id="seccion-planes" className="space-y-2.5">
              <h3 className="font-black text-sm text-[#0c243e] tracking-tight">
                Selecciona un plan
              </h3>

              <div className="space-y-2.5">
                {productPlans.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => selectPlanById(plan.id)}
                      className={`relative rounded-xl bg-white p-3.5 sm:p-4 border transition-all cursor-pointer shadow-2xs ${
                        isSelected
                          ? "border-[#0066cc] ring-2 ring-[#0066cc]/20 shadow-xs"
                          : "border-[#d8e2eb] hover:border-blue-300"
                      }`}
                    >
                      {/* Checkmark circle in top right matching Image 1 */}
                      {isSelected && (
                        <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        {/* Plan Name & Price */}
                        <div className="sm:col-span-6 space-y-0.5">
                          <h4 className="font-black text-sm text-[#0c243e]">
                            {plan.name}
                          </h4>
                          <p className="text-[11px] text-[#637992]">
                            {plan.description || "Ideal para negocios en crecimiento"}
                          </p>
                          <div className="pt-1.5">
                            <span className="text-xl font-black text-[#0c243e]">
                              $ {Number(plan.price_amount).toFixed(2)}
                            </span>
                            <span className="text-[11px] text-[#637992] font-medium ml-1">
                              / {plan.duration_days ? `${plan.duration_days} días` : "mes"}
                            </span>
                          </div>
                        </div>

                        {/* Plan Features column matching Image 1 */}
                        <div className="sm:col-span-6 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-3 pt-2 sm:pt-0">
                          <ul className="space-y-1 text-xs text-[#2c4561]">
                            {(plan.features || [
                              "1 equipo",
                              "1 usuario",
                              "Soporte técnico"
                            ]).map((feat, idx) => (
                              <li key={idx} className="flex items-center gap-1.5">
                                <span className="text-[#0066cc] font-bold text-xs">✓</span>
                                <span className="text-[11.5px]">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Info Notice */}
            <div className="bg-[#eff6ff] border border-[#cbe0fb] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#1d4674]">
              <span className="text-[#0066cc] font-bold text-sm">ⓘ</span>
              <p className="text-[11.5px] leading-snug">
                El plan seleccionado incluye el acceso al software y actualizaciones durante el período contratado.
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Reportar Pago Móvil Form matching Image 1   */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 bg-white border border-[#d8e2eb] rounded-xl p-4 sm:p-6 shadow-2xs">
            {/* Header */}
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-xl font-black text-[#0c243e] tracking-tight">
                Reportar Pago Móvil
              </h2>
              <p className="text-xs text-[#5b728b] mt-0.5">
                Completa el formulario con los datos de tu pago para que podamos verificarlo y activar tu licencia.
              </p>
            </div>

            {loading ? (
              <div className="py-12 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Cargando formulario comercial…</p>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-4">
                {/* 1. Datos del cliente (nuevo cliente) */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center font-black text-xs">
                      1
                    </span>
                    <h3 className="font-extrabold text-xs text-[#0c243e] uppercase tracking-wide">
                      Datos del cliente (nuevo cliente)
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#3b536e] mb-1">
                      Nombre y apellidos o razón social *
                    </label>
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. Juan Pérez o Comercial ABC, C.A."
                      className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-[#3b536e] mb-1">
                        Cédula o RIF *
                      </label>
                      <input
                        required
                        type="text"
                        value={identityDocument}
                        onChange={(e) => setIdentityDocument(e.target.value)}
                        placeholder="Ej. V-12345678 o J123456789"
                        className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#3b536e] mb-1">
                        Teléfono *
                      </label>
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ej. 0412 123 4567"
                        className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-[#3b536e] mb-1">
                        Correo electrónico (opcional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ej. usuario@correo.com"
                        className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#3b536e] mb-1">
                        Dirección (opcional)
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Ej. Av. Principal, Casa 123"
                        className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Datos del pago móvil */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center font-black text-xs">
                      2
                    </span>
                    <h3 className="font-extrabold text-xs text-[#0c243e] uppercase tracking-wide">
                      Datos del pago móvil
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#3b536e] mb-1">
                      Monto pagado *
                    </label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Ej. 50.00"
                        className="w-full px-3 py-2 pr-12 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        USD
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#3b536e] mb-1">
                      Plan seleccionado *
                    </label>
                    <select
                      value={planId}
                      onChange={(e) => selectPlanById(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                    >
                      {productPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — $ {Number(p.price_amount).toFixed(2)} USD
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-[#3b536e]">
                          Referencia bancaria (mín. 6 dígitos) *
                        </label>
                        {cleanReference.length > 0 && (
                          <span className={`text-[10px] font-mono ${isReferenceValid ? "text-emerald-600 font-bold" : "text-amber-600 font-semibold"}`}>
                            {cleanReference.length} dígitos {isReferenceValid ? "✓" : ""}
                          </span>
                        )}
                      </div>
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        minLength={6}
                        maxLength={30}
                        value={referenceFull}
                        onChange={(e) => {
                          setReferenceFull(e.target.value.replace(/\D/g, "").slice(0, 30));
                          if (!referenceTouched) setReferenceTouched(true);
                        }}
                        onBlur={() => setReferenceTouched(true)}
                        placeholder="Ej. 482731"
                        className={`w-full px-3 py-2 rounded-lg border text-xs text-[#0c243e] font-mono tracking-wider focus:outline-none focus:ring-2 ${
                          referenceError
                            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20"
                            : isReferenceValid
                            ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20 bg-emerald-50/10"
                            : "border-[#d4dfe8] focus:border-[#0066cc] focus:ring-blue-500/20"
                        }`}
                      />
                      {referenceError ? (
                        <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span>{referenceError}</span>
                        </p>
                      ) : isReferenceValid ? (
                        <p className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                          <span>Referencia numérica válida.</span>
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#3b536e] mb-1">
                        Fecha del pago *
                      </label>
                      <input
                        required
                        type="date"
                        max={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Bancos */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center font-black text-xs">
                      3
                    </span>
                    <h3 className="font-extrabold text-xs text-[#0c243e] uppercase tracking-wide">
                      Bancos
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#3b536e] mb-1">
                      Banco de origen *
                    </label>
                    <select
                      value={sourceBank}
                      onChange={(e) => setSourceBank(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                    >
                      <option>Banco de Venezuela</option>
                      <option>Mercantil</option>
                      <option>Banesco</option>
                      <option>BBVA Provincial</option>
                      <option>BNC</option>
                      <option>Bancamiga</option>
                      <option>Otro banco nacional</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-[#3b536e] mb-1">
                        Banco receptor *
                      </label>
                      <select
                        value={destinationBankId}
                        onChange={(e) => setDestinationBankId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] text-xs text-[#0c243e] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      >
                        {banks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bank_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#3b536e] mb-1">
                        Cuenta receptora
                      </label>
                      <input
                        readOnly
                        type="text"
                        value={selectedBank?.account_number || "0102-1234-56-7890123456"}
                        className="w-full px-3 py-2 rounded-lg border border-[#d4dfe8] bg-[#f8fafc] text-xs text-[#4b6075] font-mono"
                      />
                    </div>
                  </div>

                  {/* Bank Info Card with Official Logo matching Image 1 */}
                  {selectedBank && (
                    <div className="bg-[#f0f7fe] border border-[#d1e4fa] rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            selectedBank.bank_code === "BDV" || selectedBank.bank_name.toLowerCase().includes("venezuela")
                              ? "/assets/aistudio/banco_de_venezuela_128_25540008.png"
                              : "/assets/aistudio/banco_mercantil_128_df07a2c8.png"
                          }
                          alt={selectedBank.bank_name}
                          className="h-9 w-auto object-contain flex-shrink-0"
                        />
                        <div>
                          <strong className="text-sm font-bold text-[#0c243e] block">
                            {selectedBank.bank_name}
                          </strong>
                          <span className="text-[10px] text-[#0066cc] font-semibold bg-white px-2 py-0.5 rounded border border-blue-200">
                            Pago Móvil
                          </span>
                        </div>
                      </div>

                      <div className="text-right text-xs space-y-0.5 sm:border-l border-blue-200/80 sm:pl-4 text-[#2e4763]">
                        <div>
                          <span className="text-slate-500 mr-2">Cédula o RIF:</span>
                          <strong className="font-semibold">{selectedBank.identity_document}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 mr-2">Teléfono afiliado:</span>
                          <strong className="font-semibold text-[#0066cc] font-mono">{selectedBank.phone_number}</strong>
                        </div>
                        {selectedBank.account_number && (
                          <div>
                            <span className="text-slate-500 mr-2">Cuenta:</span>
                            <span className="font-mono text-[11px] font-semibold">{selectedBank.account_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Feedback notices */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>{success}</span>
                  </div>
                )}

                {/* Submit button matching Image 1 */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={sending || !selectedPlan || !isReferenceValid}
                    title={
                      !isReferenceValid
                        ? "Ingresa una referencia bancaria numérica de al menos 6 dígitos para enviar el reporte"
                        : undefined
                    }
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-md transition-all ${
                      sending || !selectedPlan || !isReferenceValid
                        ? "bg-slate-400 cursor-not-allowed opacity-75"
                        : "bg-[#0c243e] hover:bg-[#14365d] cursor-pointer"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>{sending ? "Enviando reporte de pago…" : "Enviar reporte de pago"}</span>
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Tu información está segura y será verificada por nuestro equipo.</span>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL: OFFICIAL CERTIFICATE OF LICENSE (DOWNLOAD / PRINT) */}
      {/* ========================================================= */}
      {showCertificateModal && activeReport?.certificate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Actions Bar (hidden when printing) */}
            <div className="bg-[#0c243e] text-white p-3.5 flex items-center justify-between border-b border-slate-700 print:hidden">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Certificado Oficial de Licencia SICOVEN</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintCertificate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setShowCertificateModal(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PRINTABLE CERTIFICATE DOCUMENT WITH ORIGINAL EFASFREELANCER LOGO */}
            <div id="printable-certificate" className="p-6 sm:p-10 bg-[#fdfefe] relative text-[#1c2e45]">
              <div className="border-4 border-[#0c243e] p-5 sm:p-7 rounded-xl relative overflow-hidden bg-white shadow-inner">
                {/* Watermark in background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                  <img
                    src="/efasfreelancer-logo.svg"
                    alt=""
                    className="w-[420px] h-auto object-contain"
                  />
                </div>

                {/* Certificate Header with Original EFASfreelancer Logo */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between border-b-2 border-slate-200 pb-4 mb-5 gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src="/efasfreelancer-logo.svg"
                      alt="EFASfreelancer Soluciones Digitales"
                      className="h-10 sm:h-12 w-auto object-contain"
                    />
                    <div className="border-l-2 border-slate-200 pl-3 text-left">
                      <h2 className="text-lg font-black text-[#0c243e] tracking-tight uppercase">
                        SICOVEN
                      </h2>
                      <p className="text-[9px] text-slate-500 font-bold tracking-wider uppercase">
                        Sistema Contable y de Gestión · RIF V-13313521-5
                      </p>
                    </div>
                  </div>

                  <div className="text-center sm:text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-widest">
                      Certificado Nº
                    </span>
                    <span className="text-xs font-mono font-bold text-[#0c243e]">
                      {activeReport.certificate.certificateId}
                    </span>
                    <span className="text-[9px] text-emerald-700 font-bold block mt-0.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      EMISIÓN OFICIAL Y VÁLIDA
                    </span>
                  </div>
                </div>

                {/* Certificate Title */}
                <div className="text-center my-4 space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0066cc]">
                    Documento de Autenticidad
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-[#0c243e] uppercase tracking-tight">
                    Certificado de Licencia de Software
                  </h1>
                </div>

                {/* Key Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-[#f8fafc] border border-slate-200 rounded-xl my-4 text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Titular Autorizado
                    </span>
                    <strong className="text-xs font-bold text-[#0c243e] block mt-0.5 truncate">
                      {activeReport.certificate.customerName}
                    </strong>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {activeReport.certificate.identityDocument}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Software y Edición
                    </span>
                    <strong className="text-xs font-bold text-[#0c243e] block mt-0.5 truncate">
                      {activeReport.certificate.productName}
                    </strong>
                    <span className="text-[10px] text-slate-500">
                      {activeReport.certificate.productEdition || "Sistema Contable"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Plan y Capacidad
                    </span>
                    <strong className="text-xs font-bold text-[#0066cc] block mt-0.5 truncate">
                      {activeReport.certificate.licenseTypeName}
                    </strong>
                    <span className="text-[10px] text-slate-500">
                      {activeReport.certificate.maxActivations} Equipo(s) autorizado(s)
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Fecha de Emisión
                    </span>
                    <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                      {new Date(activeReport.certificate.issuedAt).toLocaleDateString("es-VE", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Vencimiento
                    </span>
                    <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                      {activeReport.certificate.expiresAt
                        ? new Date(activeReport.certificate.expiresAt).toLocaleDateString("es-VE", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                          })
                        : "Vigencia permanente"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Estado de Pago
                    </span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                      PAGADO Y CONCILIADO
                    </span>
                  </div>
                </div>

                {/* PROMINENT LICENSE KEY BOX */}
                <div className="bg-[#0c243e] text-white p-3.5 rounded-xl text-center space-y-1 my-4 shadow border border-[#194b7a]">
                  <span className="text-[10px] text-sky-200 uppercase font-black tracking-widest block">
                    Clave de Activación Oficial del Software
                  </span>
                  <div className="font-mono text-lg sm:text-xl font-black text-amber-300 tracking-wider py-0.5 select-all">
                    {activeReport.certificate.licenseKey}
                  </div>
                  <p className="text-[9.5px] text-sky-100/70">
                    Introduce esta clave exactamente en la ventana de activación de SICOVEN para Windows.
                  </p>
                </div>

                {/* Quick Activation Steps */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5 text-xs">
                  <h4 className="font-bold text-[#0c243e] uppercase tracking-wide text-[10px]">
                    Guía rápida para activar tu sistema:
                  </h4>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-600 text-[10.5px] leading-relaxed">
                    <li>Inicia <strong>SICOVEN</strong> en tu computadora con Windows.</li>
                    <li>Ve al menú principal y haz clic en <strong>&quot;Licencia&quot;</strong> o <strong>&quot;Activar Producto&quot;</strong>.</li>
                    <li>Pega tu clave oficial <strong>{activeReport.certificate.licenseKey}</strong> y presiona <strong>&quot;Activar&quot;</strong>.</li>
                  </ol>
                </div>

                {/* Footer and Signatures */}
                <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[9.5px] text-slate-400">
                  <div className="text-center sm:text-left">
                    <p className="font-bold text-slate-600">SICOVEN CRM & Licensing System</p>
                    <p>EFASfreelancer Soluciones Digitales · Valencia, Venezuela</p>
                  </div>
                  <div className="text-center sm:text-right font-mono">
                    <p>Hash SHA-256 Validado</p>
                    <p>Certificado digital emitido con verificación bancaria</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Clean Footer matching Image 1 */}
      <footer className="mt-8 py-5 border-t border-slate-200/80 text-center text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">
          EFASfreelancer Soluciones Digitales · RIF V-13313521-5
        </p>
        <p className="text-[11px] text-slate-400">
          SICOVEN CRM · Pago Móvil y transferencias sujetos a conciliación bancaria.
        </p>
      </footer>
    </div>
  );
}
