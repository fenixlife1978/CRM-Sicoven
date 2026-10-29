"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  ShoppingCart,
  Send,
  FileText,
  Boxes,
  BarChart3,
  Headphones,
  ArrowRight,
  Upload,
  Info,
  Copy,
  Download,
  Printer,
  RefreshCw,
  Search,
  Lock,
  Sparkles,
  X,
  AlertCircle,
  LayoutGrid
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
    name: "Básico",
    description: "Ideal para pequeñas empresas y emprendedores.",
    price_amount: 29,
    currency: "USD",
    duration_days: 30,
    max_activations: 1,
    features: [
      "Registro de ingresos y gastos",
      "Inventario básico",
      "Reportes contables",
      "Soporte técnico"
    ]
  },
  {
    id: "plan-profesional",
    product_id: "prod-sicoven",
    name: "Profesional",
    description: "Para empresas en crecimiento con mayor control.",
    price_amount: 49,
    currency: "USD",
    duration_days: 30,
    max_activations: 2,
    popular: true,
    features: [
      "Todo lo del plan Básico",
      "Módulo de inventario completo",
      "Cuentas por cobrar y pagar",
      "Reportes avanzados",
      "Soporte prioritario"
    ]
  },
  {
    id: "plan-empresarial",
    product_id: "prod-sicoven",
    name: "Empresarial",
    description: "La solución completa para grandes operaciones.",
    price_amount: 79,
    currency: "USD",
    duration_days: 30,
    max_activations: 5,
    features: [
      "Todo lo del plan Profesional",
      "Múltiples usuarios",
      "Sucursales y almacenes",
      "Integración bancaria",
      "Soporte VIP"
    ]
  }
];

export default function BuySoftwarePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [whatsappAdminPhone, setWhatsappAdminPhone] = useState("04125773996");

  const [productId, setProductId] = useState("");
  const [planId, setPlanId] = useState("");
  const [customerType, setCustomerType] = useState<"person" | "company">("person");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [identityDocument, setIdentityDocument] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceFull, setReferenceFull] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  );
  const [sourceBank, setSourceBank] = useState("Banco de Venezuela");
  const [destinationBankId, setDestinationBankId] = useState("");
  const [receiptFileName, setReceiptFileName] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // License Tracking and Certificate State
  const [activeReport, setActiveReport] = useState<ActiveReport | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Search by document / reference modal
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupDoc, setLookupDoc] = useState("");
  const [lookupRef, setLookupRef] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Catalog and recover last reported payment if exists
  useEffect(() => {
    fetch("/api/commercial-catalog", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) {
          const prods = d.products && d.products.length > 0 ? d.products : [
            { id: "prod-sicoven", name: "SICOVEN", edition: "Sistema Contable y de Gestión", version: "2.0" }
          ];
          setProducts(prods);

          let fetchedPlans: Plan[] = (d.plans && d.plans.length > 0) ? d.plans : DEFAULT_PLANS;
          fetchedPlans = fetchedPlans.map((p: Plan, index: number) => {
            const def = DEFAULT_PLANS[index] || DEFAULT_PLANS[0];
            return {
              ...p,
              popular: p.name.toLowerCase().includes("profesional") || p.popular,
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
              identity_document: "V-13313521-5",
              phone_number: "04125773996",
              account_number: "01020000000000000000"
            },
            {
              id: "bank-mercantil",
              bank_code: "MERCANTIL",
              bank_name: "Banco Mercantil",
              holder_name: "EFASfreelancer C.A.",
              identity_document: "V-13313521-5",
              phone_number: "04125773996",
              account_number: "01050000000000000000"
            }
          ];
          setBanks(initialBanks);
          setWhatsappAdminPhone(d.whatsappAdminPhone || "04125773996");

          if (prods[0]) setProductId(prods[0].id);
          if (fetchedPlans[1]) {
            setPlanId(fetchedPlans[1].id);
            setAmount(String(fetchedPlans[1].price_amount));
          } else if (fetchedPlans[0]) {
            setPlanId(fetchedPlans[0].id);
            setAmount(String(fetchedPlans[0].price_amount));
          }
          if (initialBanks[0]) setDestinationBankId(initialBanks[0].id);
        }
      })
      .catch(() => {
        setProducts([{ id: "prod-sicoven", name: "SICOVEN", edition: "Sistema Contable y de Gestión", version: "2.0" }]);
        setPlans(DEFAULT_PLANS);
        setPlanId("plan-profesional");
        setAmount("49");
        setBanks([
          {
            id: "bank-bdv",
            bank_code: "BDV",
            bank_name: "Banco de Venezuela",
            holder_name: "EFASfreelancer C.A.",
            identity_document: "V-13313521-5",
            phone_number: "04125773996"
          },
          {
            id: "bank-mercantil",
            bank_code: "MERCANTIL",
            bank_name: "Banco Mercantil",
            holder_name: "EFASfreelancer C.A.",
            identity_document: "V-13313521-5",
            phone_number: "04125773996"
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

  const productPlans = plans.filter((p) => p.product_id === productId || plans.length <= 3);
  const selectedPlan = productPlans.find((p) => p.id === planId) || productPlans[0] || DEFAULT_PLANS[1];
  const selectedBank = banks.find((b) => b.id === destinationBankId) || banks[0];

  useEffect(() => {
    if (selectedPlan) {
      setAmount(String(selectedPlan.price_amount));
    }
  }, [selectedPlan]);

  const selectPlanById = (id: string) => {
    setPlanId(id);
    const p = plans.find((pl) => pl.id === id);
    if (p) {
      setAmount(String(p.price_amount));
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

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setLookupError("");
    setLookupLoading(true);
    try {
      const res = await fetch("/api/payment-reports/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityDocument: lookupDoc,
          referenceFull: lookupRef
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se encontró el reporte.");

      const matched: ActiveReport = {
        reportId: data.reportId,
        status: data.status,
        customerName: data.certificate?.customerName || "Titular",
        identityDocument: data.certificate?.identityDocument || lookupDoc,
        phone: data.certificate?.customerPhone || "",
        email: data.certificate?.customerEmail || "",
        productName: data.productName || "SICOVEN",
        planName: data.planName || "Plan",
        amount: data.amount || 0,
        referenceLastSix: data.referenceLastSix || lookupRef,
        paymentDate: data.paymentDate || "",
        reviewNote: data.reviewNote,
        reviewedAt: data.reviewedAt,
        certificate: data.certificate
      };
      setActiveReport(matched);
      localStorage.setItem("crm_sicoven_last_report", JSON.stringify(matched));
      setShowLookupModal(false);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Error al buscar reporte");
    } finally {
      setLookupLoading(false);
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

    setSending(true);
    try {
      const payload = {
        productId: productId || products[0]?.id || "prod-sicoven",
        planId: selectedPlan.id,
        customerType,
        firstName: customerType === "person" ? firstName : "",
        lastName: customerType === "person" ? lastName : "",
        legalName: customerType === "company" ? legalName : "",
        identityDocument: identityDocument.trim().toUpperCase(),
        taxId: taxId.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        amount: Number(amount),
        referenceFull: referenceFull.trim(),
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

      setSuccess(`¡Reporte recibido con éxito! Número de seguimiento: ${d.reportId}. Tu pago ha quedado registrado y en revisión para la emisión de tu licencia.`);

      const newReport: ActiveReport = {
        reportId: d.reportId,
        status: "pending_review",
        customerName: customerType === "person" ? `${firstName} ${lastName}`.trim() : legalName,
        identityDocument: identityDocument.toUpperCase(),
        phone,
        email,
        productName: products.find((p) => p.id === productId)?.name || "SICOVEN",
        planName: selectedPlan.name,
        amount: Number(amount),
        referenceFull,
        paymentDate
      };
      setActiveReport(newReport);
      localStorage.setItem("crm_sicoven_last_report", JSON.stringify(newReport));

      window.scrollTo({ top: 300, behavior: "smooth" });
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
    <div className="min-h-screen bg-[#f3f6fa] text-[#1c2e45] font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation Bar (NO LINKS TO CRM DASHBOARD OR LOGIN) */}
      <header className="bg-[#0f243c] text-white py-3.5 px-4 sm:px-8 border-b border-[#1b3655] shadow-md sticky top-0 z-40">
        <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Original EFASfreelancer Logo & SICOVEN Title (Static Brand, Non-Clickable) */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-center sm:text-left">
            <div className="bg-white/95 px-3 py-1.5 rounded-xl shadow-sm border border-slate-200/20 flex items-center">
              <img
                src="/efasfreelancer-logo.svg"
                alt="EFASfreelancer Soluciones Digitales"
                className="h-8 sm:h-9 w-auto object-contain"
              />
            </div>

            <div className="hidden sm:block h-7 w-[1px] bg-slate-600/70 mx-1" />

            <div>
              <h1 className="font-bold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                <span>SICOVEN</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/30 text-sky-200 border border-blue-400/30 font-semibold">
                  Planes y Pagos
                </span>
              </h1>
              <p className="text-xs text-sky-200/90 hidden sm:block">
                Activa tu sistema, trabaja sin interrupciones
              </p>
            </div>
          </div>

          {/* Secure Purchase Badge & Search Certificate Trigger */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setShowLookupModal(true)}
              className="text-xs text-sky-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-sky-400" />
              <span>Consultar mi Licencia</span>
            </button>

            <div className="flex items-center gap-2 bg-[#173352]/70 px-3 py-1.5 rounded-full border border-[#23476f]/50">
              <ShieldCheck className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <div className="text-left text-xs leading-none">
                <span className="font-semibold text-white block">Compra segura</span>
                <span className="text-[10px] text-slate-300">Tus datos están protegidos</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1360px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Unlocked License & Certificate Banner (If user has reported a payment) */}
        {activeReport && (
          <section className="mb-8 rounded-2xl overflow-hidden border shadow-lg transition-all">
            {activeReport.status === "approved" ? (
              <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-[#0e3b33] text-white p-6 sm:p-8 border-emerald-500/40">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      ¡Pago Aprobado y Licencia Emitida!
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Tu Certificado de Licencia está listo
                    </h2>
                    <p className="text-emerald-100/90 text-sm max-w-2xl">
                      El pago de tu plan <strong>{activeReport.planName}</strong> para <strong>{activeReport.customerName}</strong> ha sido verificado con éxito. Ya puedes activar tu software SICOVEN.
                    </p>

                    {activeReport.certificate?.licenseKey && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 pt-2">
                        <span className="text-xs text-emerald-200/90 font-medium">Clave de activación:</span>
                        <div className="bg-black/40 border border-emerald-400/40 px-4 py-2 rounded-lg font-mono text-base font-bold text-emerald-300 tracking-wider flex items-center gap-3 shadow-inner">
                          <span>{activeReport.certificate.licenseKey}</span>
                          <button
                            onClick={() => copyLicenseKey(activeReport.certificate!.licenseKey)}
                            title="Copiar clave"
                            className="p-1 hover:text-white text-emerald-400 transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        {copiedKey && (
                          <span className="text-xs text-emerald-300 font-semibold bg-emerald-800/60 px-2 py-1 rounded">
                            ¡Copiada al portapapeles!
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <button
                      onClick={() => setShowCertificateModal(true)}
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-black shadow-lg hover:from-amber-300 hover:to-amber-400 transition-all text-sm uppercase tracking-wide cursor-pointer hover:scale-[1.02]"
                    >
                      <Download className="w-4 h-4" />
                      Descargar Certificado de Licencia
                    </button>
                    <button
                      onClick={() => checkReportStatus(activeReport.reportId)}
                      disabled={checkingStatus}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-800/50 hover:bg-emerald-800 text-white font-medium text-xs border border-emerald-600/40 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? "animate-spin" : ""}`} />
                      Actualizar
                    </button>
                  </div>
                </div>
              </div>
            ) : activeReport.status === "pending_review" ? (
              <div className="bg-gradient-to-r from-[#17304f] to-[#1d3d63] text-white p-6 sm:p-7 border-blue-400/30">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full text-xs font-bold border border-amber-400/30">
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                      Pago en Revisión Administrativa · Reporte #{activeReport.reportId.slice(0, 8)}
                    </div>
                    <h3 className="text-xl font-bold text-white">
                      Verificación en curso: Tu Certificado se desbloqueará aquí
                    </h3>
                    <p className="text-blue-100/80 text-xs sm:text-sm max-w-2xl leading-relaxed">
                      Hemos recibido tu reporte de pago de <strong>{activeReport.amount} USD</strong> para el plan <strong>{activeReport.planName}</strong>. En cuanto el abono sea conciliado, se emitirá automáticamente tu licencia y podrás descargar tu certificado.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700/60 text-slate-400 font-semibold text-xs border border-slate-600/50 cursor-not-allowed"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Certificado Bloqueado (Pendiente de Aprobación)
                    </button>
                    <button
                      onClick={() => checkReportStatus(activeReport.reportId)}
                      disabled={checkingStatus}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? "animate-spin" : ""}`} />
                      {checkingStatus ? "Consultando…" : "Verificar Estado Ahora"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-900/90 text-white p-6 border-red-500/40">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-300 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg text-white">Reporte de pago no validado</h4>
                    <p className="text-xs text-red-200">
                      Motivo: {activeReport.reviewNote || "No se pudo constatar la transferencia bancaria con la referencia suministrada."}
                    </p>
                    <p className="text-xs text-red-300 mt-2">
                      Si consideras que es un error, por favor comunícate directamente con soporte por WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 2-Column Grid Layout matching user screenshot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Free Trial, Pricing Plans & Features        */}
          {/* ========================================================= */}
          <div className="lg:col-span-6 xl:col-span-6 space-y-6">
            {/* 1. Free Trial Banner */}
            <section className="bg-[#f0f7ff] border border-[#cde2fe] rounded-2xl p-6 sm:p-7 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#1b62b3] text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <Clock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-black text-[#102a45] tracking-tight">
                    Prueba gratuita de 24 horas
                  </h2>
                  <p className="text-sm text-[#274766] leading-snug">
                    ¡Comienza a usar SICOVEN de inmediato! Tu sistema{" "}
                    <strong className="text-[#102a45] font-bold">
                      estará disponible en modo prueba por 24 horas máximo
                    </strong>
                    .
                  </p>
                  <p className="text-xs text-[#4b6a8a] leading-relaxed">
                    Te invitamos a ver nuestros planes de pago para activar tu sistema sin interrupciones y con todas sus funcionalidades.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Nuestros Planes Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="w-5 h-5 text-[#0066cc]" />
                <div>
                  <h2 className="text-xl font-black text-[#102a45] tracking-tight">
                    Nuestros Planes
                  </h2>
                  <p className="text-xs text-[#526a84]">
                    Elige el plan que mejor se adapte a tus necesidades.
                  </p>
                </div>
              </div>

              {/* 3 Plans Grid (Horizontal layout matching screenshot) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {productPlans.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  const isPopular = plan.popular;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => selectPlanById(plan.id)}
                      className={`relative rounded-2xl bg-white transition-all cursor-pointer flex flex-col justify-between p-5 border ${
                        isSelected
                          ? "border-[#0066cc] shadow-md ring-2 ring-[#0066cc]/20"
                          : isPopular
                          ? "border-[#0066cc] shadow-sm"
                          : "border-[#e0e7ee] hover:border-blue-300"
                      }`}
                    >
                      {/* Popular Badge */}
                      {isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0066cc] text-white text-[10px] font-black tracking-wider uppercase py-0.5 px-3 rounded-full shadow-sm">
                          Más popular
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <h3 className="font-black text-lg text-[#102a45]">
                            {plan.name}
                          </h3>
                          <p className="text-[11px] text-[#5e748d] min-h-[30px] leading-tight mt-1">
                            {plan.description || "Solución completa para tu negocio."}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-[#102a45]">
                              $ {plan.price_amount}
                            </span>
                            <span className="text-xs text-[#5e748d] font-medium">
                              / {plan.duration_days ? `${plan.duration_days} días` : "mes"}
                            </span>
                          </div>
                        </div>

                        {/* Feature items */}
                        <ul className="space-y-2 pt-2 text-xs">
                          {(plan.features || [
                            "Registro de ingresos y gastos",
                            "Inventario básico",
                            "Reportes contables",
                            "Soporte técnico"
                          ]).map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-[#2c435a] leading-tight">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Button */}
                      <div className="mt-5 pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectPlanById(plan.id);
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all tracking-wide cursor-pointer ${
                            isPopular || isSelected
                              ? "bg-[#0066cc] text-white shadow hover:bg-[#0052a3]"
                              : "border border-[#0066cc] text-[#0066cc] bg-white hover:bg-blue-50"
                          }`}
                        >
                          {isSelected ? "Plan seleccionado ✓" : "Seleccionar plan"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. ¿Qué incluye cada plan? Section */}
            <section className="bg-white border border-[#e0e7ee] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0066cc] flex items-center justify-center font-bold">
                  ★
                </div>
                <div>
                  <h3 className="font-extrabold text-[#102a45] text-base">
                    ¿Qué incluye cada plan?
                  </h3>
                  <p className="text-xs text-[#637992]">
                    Todas las versiones incluyen actualizaciones y soporte técnico.
                  </p>
                </div>
              </div>

              {/* 4 Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 bg-[#f8fafc] border border-slate-100 rounded-xl text-center space-y-2">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-blue-100/70 text-[#0066cc] flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102a45] leading-tight">
                    Contabilidad completa
                  </div>
                </div>

                <div className="p-3.5 bg-[#f8fafc] border border-slate-100 rounded-xl text-center space-y-2">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-blue-100/70 text-[#0066cc] flex items-center justify-center">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102a45] leading-tight">
                    Inventario y almacén
                  </div>
                </div>

                <div className="p-3.5 bg-[#f8fafc] border border-slate-100 rounded-xl text-center space-y-2">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-blue-100/70 text-[#0066cc] flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102a45] leading-tight">
                    Reportes y estadísticas
                  </div>
                </div>

                <div className="p-3.5 bg-[#f8fafc] border border-slate-100 rounded-xl text-center space-y-2">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-blue-100/70 text-[#0066cc] flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-[#102a45] leading-tight">
                    Seguridad y respaldo
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Bottom Support Banner */}
            <section className="bg-white border border-[#e0e7ee] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0066cc] flex items-center justify-center flex-shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#102a45]">
                    ¿Necesitas ayuda?
                  </h4>
                  <p className="text-xs text-[#5e748d]">
                    Estamos para asesorarte. Contáctanos por WhatsApp o visita nuestro portal.
                  </p>
                </div>
              </div>

              <a
                href={`https://wa.me/${whatsappAdminPhone.replace(/\D/g, "").replace(/^0/, "58")}?text=${encodeURIComponent("Hola, deseo recibir asesoría sobre los planes de SICOVEN.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap px-4 py-2 border border-[#0066cc] text-[#0066cc] rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5"
              >
                <span>Contactar asesor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </section>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Formulario de Compra y Reporte de Pago      */}
          {/* ========================================================= */}
          <div className="lg:col-span-6 xl:col-span-6 bg-white border border-[#dde4ec] rounded-2xl p-6 sm:p-8 shadow-sm">
            {/* Header */}
            <div className="flex items-start gap-3 pb-6 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#102a45] tracking-tight">
                  Formulario de Compra y Reporte de Pago
                </h2>
                <p className="text-xs text-[#637992] mt-0.5">
                  Completa tus datos y reporta tu pago para procesar la activación de tu licencia.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Cargando opciones comerciales…</p>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-6">
                {/* 1. Datos del titular */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-[#102a45]">
                      1. Datos del titular
                    </h3>
                    {/* Customer type toggle */}
                    <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setCustomerType("person")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          customerType === "person" ? "bg-white text-[#102a45] font-bold shadow-sm" : "text-slate-500"
                        }`}
                      >
                        Persona natural
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerType("company")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          customerType === "company" ? "bg-white text-[#102a45] font-bold shadow-sm" : "text-slate-500"
                        }`}
                      >
                        Empresa
                      </button>
                    </div>
                  </div>

                  {customerType === "person" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                          Nombres *
                        </label>
                        <input
                          required
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Ej. Juan Carlos"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                          Apellidos *
                        </label>
                        <input
                          required
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Ej. Pérez García"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                          Cédula / RIF *
                        </label>
                        <input
                          required
                          type="text"
                          value={identityDocument}
                          onChange={(e) => setIdentityDocument(e.target.value)}
                          placeholder="Ej. V-12345678"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                          RIF Personal (Opcional)
                        </label>
                        <input
                          type="text"
                          value={taxId}
                          onChange={(e) => setTaxId(e.target.value)}
                          placeholder="Ej. V123456780"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                          Razón Social / Nombre Comercial *
                        </label>
                        <input
                          required
                          type="text"
                          value={legalName}
                          onChange={(e) => setLegalName(e.target.value)}
                          placeholder="Ej. Distribuidora Los Andes C.A."
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                          RIF Jurídico *
                        </label>
                        <input
                          required
                          type="text"
                          value={identityDocument}
                          onChange={(e) => {
                            setIdentityDocument(e.target.value);
                            setTaxId(e.target.value);
                          }}
                          placeholder="Ej. J-12345678-0"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                          Representante Legal (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Juan Pérez"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Teléfono *
                      </label>
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ej. 0412 123 4567"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ej. correo@dominio.com"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0066cc]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Producto y plan seleccionado */}
                <div className="space-y-3 pt-2">
                  <h3 className="font-extrabold text-sm text-[#102a45]">
                    2. Producto y plan seleccionado
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Producto *
                      </label>
                      <select
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#d6dfe7] text-sm bg-white text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.edition ? `· ${p.edition}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Plan *
                      </label>
                      <select
                        value={planId}
                        onChange={(e) => selectPlanById(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#d6dfe7] text-sm bg-white text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {productPlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Precio
                      </label>
                      <div className="px-3 py-2.5 rounded-lg bg-[#f8fafc] border border-[#d6dfe7] text-sm font-bold text-[#102a45]">
                        $ {selectedPlan?.price_amount || 49} / mes
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Datos del pago (Con logos oficiales Banco de Venezuela y Mercantil) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-[#102a45]">
                      3. Datos del pago (Pago Móvil / Transferencia)
                    </h3>
                  </div>

                  {/* Bank selector cards with official uploaded logos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
                    {banks.map((b) => {
                      const isBDV = b.bank_code === "BDV" || b.bank_name.toLowerCase().includes("venezuela");
                      const isSelected = selectedBank?.id === b.id;
                      const logoSrc = isBDV
                        ? "/assets/aistudio/banco_de_venezuela_128_25540008.png"
                        : "/assets/aistudio/banco_mercantil_128_df07a2c8.png";

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setDestinationBankId(b.id)}
                          className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
                            isSelected
                              ? "border-[#0066cc] bg-blue-50/70 shadow-sm ring-2 ring-[#0066cc]/20"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="w-14 h-10 bg-white rounded-lg p-1 border border-slate-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                            <img
                              src={logoSrc}
                              alt={b.bank_name}
                              className="max-h-8 max-w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#102a45] block truncate">
                              {b.bank_name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Pago Móvil: {b.phone_number}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Bank Detailed Card with Official Logo */}
                  {selectedBank && (
                    <div className="bg-[#f8fafc] border border-[#d7e2ed] rounded-xl p-4 text-xs space-y-3 shadow-xs">
                      <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                        <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-xs">
                          <img
                            src={
                              selectedBank.bank_code === "BDV" || selectedBank.bank_name.toLowerCase().includes("venezuela")
                                ? "/assets/aistudio/banco_de_venezuela_128_25540008.png"
                                : "/assets/aistudio/banco_mercantil_128_df07a2c8.png"
                            }
                            alt={selectedBank.bank_name}
                            className="h-7 w-auto object-contain"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Cuenta Receptora Oficial
                          </span>
                          <strong className="text-sm font-bold text-[#102a45]">
                            {selectedBank.bank_name}
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[#2c435a]">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Titular:</span>
                          <strong className="font-semibold text-xs">{selectedBank.holder_name || "EFASfreelancer C.A."}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Cédula / RIF:</span>
                          <strong className="font-semibold text-xs">{selectedBank.identity_document}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Teléfono Pago Móvil:</span>
                          <strong className="font-semibold text-xs text-[#0066cc] font-mono">{selectedBank.phone_number}</strong>
                        </div>
                        {selectedBank.account_number && (
                          <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-100">
                            <span className="text-[10px] text-slate-500 block">Número de cuenta bancaria:</span>
                            <span className="font-mono text-xs text-[#102a45] font-semibold">{selectedBank.account_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Monto pagado *
                      </label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Ej. 49.00"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Fecha del pago *
                      </label>
                      <input
                        required
                        type="date"
                        max={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                        Banco de origen *
                      </label>
                      <select
                        value={sourceBank}
                        onChange={(e) => setSourceBank(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#d6dfe7] text-sm bg-white text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                      Referencia bancaria completa *
                    </label>
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      minLength={6}
                      maxLength={30}
                      pattern="[0-9]{6,30}"
                      value={referenceFull}
                      onChange={(e) => setReferenceFull(e.target.value.replace(/\D/g, "").slice(0, 30))}
                      placeholder="Todos los dígitos de la referencia"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono tracking-wider"
                    />
                    <p className="mt-1 text-xs text-slate-500">Escribe la referencia completa tal como aparece en el comprobante; no ingreses solo los últimos seis dígitos.</p>
                  </div>
                </div>

                {/* 4. Reporte de pago & WhatsApp Notice */}
                <div className="space-y-3 pt-2">
                  <h3 className="font-extrabold text-sm text-[#102a45]">
                    4. Reporte de pago
                  </h3>

                  {/* Info Notice */}
                  <div className="bg-[#eff6ff] border border-[#bed8fb] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#1e4a7a]">
                    <Info className="w-4 h-4 text-[#0066cc] flex-shrink-0 mt-0.5" />
                    <span>
                      Al enviar el reporte de pago, podrás notificar directamente por WhatsApp al administrador de EFASfreelancer para agilizar la aprobación y entrega de tu licencia.
                    </span>
                  </div>

                  {/* Big WhatsApp Banner Button */}
                  <a
                    href={`https://wa.me/${whatsappAdminPhone.replace(/\D/g, "").replace(/^0/, "58")}?text=${encodeURIComponent([
                      "Hola, EFASfreelancer. He realizado el reporte de pago en SICOVEN para activación de licencia.",
                      `Titular: ${customerType === "person" ? `${firstName} ${lastName}`.trim() : legalName}`,
                      `Documento/RIF: ${identityDocument}`,
                      `Plan: ${selectedPlan?.name}`,
                      `Monto: ${amount} USD`,
                      `Referencia bancaria completa: ${referenceFull}`,
                      "Quedo a la espera de la validación y emisión de mi certificado."
                    ].join("\n"))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white p-3.5 rounded-xl font-bold text-sm flex items-center justify-between shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </div>
                      <span>Avisar por WhatsApp y solicitar aprobación</span>
                    </div>
                    <span className="font-mono text-emerald-100 bg-black/15 px-2.5 py-1 rounded text-xs">
                      {whatsappAdminPhone.length >= 7
                        ? `${whatsappAdminPhone.slice(0, 4)} ••• ${whatsappAdminPhone.slice(-4)}`
                        : "0412 ••• 3996"}
                    </span>
                  </a>

                  {/* Two boxes side-by-side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* File upload box */}
                    <div className="border border-dashed border-[#ccd7e4] rounded-xl p-3.5 bg-[#fbfcfe] text-center space-y-1">
                      <p className="text-[11px] font-semibold text-[#3b536e]">
                        También puedes enviar el comprobante de pago (opcional)
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setReceiptFileName(file.name);
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>{receiptFileName ? receiptFileName : "Seleccionar archivo"}</span>
                      </button>
                      <p className="text-[9px] text-slate-400">
                        Formatos: JPG, PNG, PDF. Máx. 5 MB.
                      </p>
                    </div>

                    {/* Important box */}
                    <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-[#f8fafc] text-xs text-[#415b77] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#102a45]">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span>Importante</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Una vez reportado el pago y aprobado, el sistema generará automáticamente tu certificado de licencia según el plan adquirido.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. Resumen */}
                <div className="pt-2">
                  <h3 className="font-extrabold text-sm text-[#102a45] mb-2">
                    5. Resumen
                  </h3>
                  <div className="bg-[#f0f5fa] border border-[#dce5ef] rounded-xl p-4 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Producto:</span>
                      <strong className="text-sm font-bold text-[#102a45]">
                        {products.find((p) => p.id === productId)?.name || "SICOVEN"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Plan:</span>
                      <strong className="text-sm font-bold text-[#102a45]">
                        {selectedPlan?.name || "Profesional"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Precio:</span>
                      <strong className="text-sm font-bold text-[#0066cc]">
                        $ {selectedPlan?.price_amount || 49} / mes
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Feedback notices */}
                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>{success}</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={sending || !selectedPlan}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-md transition-all ${
                    sending || !selectedPlan
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-[#143252] hover:bg-[#0c2239] cursor-pointer"
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? "Enviando reporte de pago…" : "Enviar reporte de pago"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL: OFFICIAL CERTIFICATE OF LICENSE (DOWNLOAD / PRINT) */}
      {/* ========================================================= */}
      {showCertificateModal && activeReport?.certificate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Actions Bar (hidden when printing) */}
            <div className="bg-[#0f243c] text-white p-4 flex items-center justify-between border-b border-slate-700 print:hidden">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Certificado Oficial de Licencia SICOVEN</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintCertificate}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Guardar PDF</span>
                </button>
                <button
                  onClick={() => setShowCertificateModal(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PRINTABLE CERTIFICATE DOCUMENT WITH ORIGINAL EFASFREELANCER LOGO */}
            <div id="printable-certificate" className="p-8 sm:p-12 bg-[#fdfefe] relative text-[#1c2e45]">
              {/* Outer Security Border */}
              <div className="border-4 border-[#0c2540] p-6 sm:p-8 rounded-xl relative overflow-hidden bg-white shadow-inner">
                {/* Original EFASfreelancer Watermark in background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                  <img
                    src="/efasfreelancer-logo.svg"
                    alt=""
                    className="w-[480px] h-auto object-contain"
                  />
                </div>

                {/* Certificate Header with Original EFASfreelancer Logo */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between border-b-2 border-slate-200 pb-6 mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src="/efasfreelancer-logo.svg"
                      alt="EFASfreelancer Soluciones Digitales"
                      className="h-12 sm:h-14 w-auto object-contain"
                    />
                    <div className="border-l-2 border-slate-200 pl-4 text-left">
                      <h2 className="text-xl font-black text-[#0c2540] tracking-tight uppercase">
                        SICOVEN
                      </h2>
                      <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">
                        Sistema Contable y de Gestión · RIF V-13313521-5
                      </p>
                    </div>
                  </div>

                  <div className="text-center sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-widest">
                      Certificado Nº
                    </span>
                    <span className="text-sm font-mono font-bold text-[#0c2540]">
                      {activeReport.certificate.certificateId}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold block mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      EMISIÓN OFICIAL Y VÁLIDA
                    </span>
                  </div>
                </div>

                {/* Certificate Title */}
                <div className="text-center my-6 space-y-1">
                  <span className="text-xs font-black uppercase tracking-[0.25em] text-[#0066cc]">
                    Documento de Autenticidad
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-[#0c2540] uppercase tracking-tight">
                    Certificado de Licencia de Software
                  </h1>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto">
                    Se certifica por medio del presente documento la titularidad y validez legal de uso del sistema según las condiciones comerciales adquiridas.
                  </p>
                </div>

                {/* Key Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-[#f8fafc] border border-slate-200 rounded-xl my-6 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Titular Autorizado
                    </span>
                    <strong className="text-sm font-bold text-[#0c2540] block mt-0.5">
                      {activeReport.certificate.customerName}
                    </strong>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {activeReport.certificate.identityDocument}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Software y Edición
                    </span>
                    <strong className="text-sm font-bold text-[#0c2540] block mt-0.5">
                      {activeReport.certificate.productName}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {activeReport.certificate.productEdition || "Sistema Contable"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Plan y Capacidad
                    </span>
                    <strong className="text-sm font-bold text-[#0066cc] block mt-0.5">
                      {activeReport.certificate.licenseTypeName}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {activeReport.certificate.maxActivations} Equipo(s) autorizado(s)
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Vencimiento
                    </span>
                    <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                      {activeReport.certificate.expiresAt
                        ? new Date(activeReport.certificate.expiresAt).toLocaleDateString("es-VE", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                          })
                        : "Vigencia permanente / según suscripción"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Estado de Pago
                    </span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                      PAGADO Y CONCILIADO
                    </span>
                  </div>
                </div>

                {/* PROMINENT LICENSE KEY BOX */}
                <div className="bg-[#0c2540] text-white p-5 rounded-xl text-center space-y-2 my-6 shadow-md border-2 border-[#194b7a]">
                  <span className="text-[11px] text-sky-200 uppercase font-black tracking-widest block">
                    Clave de Activación Oficial del Software
                  </span>
                  <div className="font-mono text-xl sm:text-2xl font-black text-amber-300 tracking-wider py-1 select-all">
                    {activeReport.certificate.licenseKey}
                  </div>
                  <p className="text-[10px] text-sky-100/70">
                    Introduce esta clave exactamente como aparece en la ventana de activación de SICOVEN para Windows.
                  </p>
                </div>

                {/* Quick Activation Steps */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 text-xs">
                  <h4 className="font-bold text-[#0c2540] uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                    <span>Guía rápida para activar tu sistema</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                    <li>Inicia <strong>SICOVEN</strong> en tu computadora con Windows.</li>
                    <li>Ve al menú principal y haz clic en <strong>&quot;Licencia&quot;</strong> o <strong>&quot;Activar Producto&quot;</strong>.</li>
                    <li>Pega tu clave oficial <strong>{activeReport.certificate.licenseKey}</strong> y presiona <strong>&quot;Activar&quot;</strong>.</li>
                  </ol>
                </div>

                {/* Footer and Signatures */}
                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-400">
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

      {/* ========================================================= */}
      {/* MODAL: LOOKUP PAST REPORT OR LICENSE                      */}
      {/* ========================================================= */}
      {showLookupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowLookupModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-lg text-[#102a45]">
                  Consultar Certificado
                </h3>
                <p className="text-xs text-slate-500">
                  Ingresa tus datos para recuperar tu licencia aprobada.
                </p>
              </div>
            </div>

            <form onSubmit={handleLookup} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                  Cédula de Identidad o RIF *
                </label>
                <input
                  required
                  type="text"
                  value={lookupDoc}
                  onChange={(e) => setLookupDoc(e.target.value)}
                  placeholder="Ej. V-12345678 o J-12345678-0"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3a526d] mb-1">
                  Referencia bancaria completa *
                </label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value.replace(/\D/g, "").slice(0, 30))}
                  placeholder="Ej. 789012"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#d6dfe7] text-sm text-[#102a45] font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {lookupError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                  {lookupError}
                </div>
              )}

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full py-3 bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold rounded-xl text-sm transition-all shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                {lookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{lookupLoading ? "Consultando…" : "Buscar Licencia"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer (No CRM dashboard link) */}
      <footer className="mt-12 py-8 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">
          EFASfreelancer Soluciones Digitales · RIF V-13313521-5
        </p>
        <p>SICOVEN CRM · Pago Móvil y transferencias sujetos a conciliación bancaria.</p>
      </footer>
    </div>
  );
}
