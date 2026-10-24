import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  try {
    await bootstrapDatabase();
    const result = await getDb().execute({
      sql: `SELECT l.id,l.customer_id,l.product_id,l.license_key_hint,l.status,l.starts_at,l.expires_at,l.max_activations,l.created_at,
                   l.license_type_name,l.billing_cycle,l.billing_amount,l.currency,l.next_billing_at,c.display_name AS customer_name,c.email AS customer_email,c.phone AS customer_phone,c.address AS customer_address,
                   p.name AS product_name,p.edition AS product_edition,p.version AS product_version,l.license_terms_json,
                   (SELECT COUNT(*) FROM activations a WHERE a.license_id=l.id AND a.status='active') AS active_activations
            FROM licenses l JOIN customers c ON c.id=l.customer_id JOIN products p ON p.id=l.product_id
            ORDER BY l.created_at DESC LIMIT 250`
    });
    return NextResponse.json({ licenses: result.rows });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar las licencias." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede emitir licencias." }, { status: 403 });
  try {
    await bootstrapDatabase();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const data = body as Record<string, unknown>;
    if (data.action === "replace-after-format") {
      const oldLicenseId = typeof data.licenseId === "string" ? data.licenseId.trim() : "";
      const fee = Number(data.replacementFee);
      const currency = typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency) ? data.currency : "USD";
      const reason = typeof data.reason === "string" ? data.reason.trim().slice(0, 300) : "Reinstalación por formateo o sustitución de equipo";
      if (!oldLicenseId || !Number.isFinite(fee) || fee < 0 || fee > 1000000) {
        return NextResponse.json({ error: "Licencia original e importe de reposición válido son obligatorios." }, { status: 400 });
      }
      const db = getDb();
      const tx = await db.transaction("write");
      try {
        const found = await tx.execute({ sql: `SELECT l.*,c.display_name AS customer_name,c.email AS customer_email,c.phone AS customer_phone,c.address AS customer_address,p.name AS product_name,p.edition AS product_edition,p.version AS product_version
          FROM licenses l JOIN customers c ON c.id=l.customer_id JOIN products p ON p.id=l.product_id WHERE l.id=? LIMIT 1`, args: [oldLicenseId] });
        const old = found.rows[0];
        if (!old) { await tx.rollback(); return NextResponse.json({ error: "No se encontró la licencia original." }, { status: 404 }); }
        if (String(old.status) === "revoked") { await tx.rollback(); return NextResponse.json({ error: "La licencia original ya está revocada; no puede reponerse nuevamente." }, { status: 409 }); }
        const newId = randomUUID();
        const rawKey = `SIC-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
        const keyHash = createHash("sha256").update(rawKey).digest("hex");
        const keyHint = `…${rawKey.slice(-4)}`;
        const issuedAt = new Date().toISOString();
        const terms = old.license_terms_json || JSON.stringify({ durationDays: null, supportTerms: "", updateTerms: "", extraActivationTerms: "", terms: "", offlineDays: 0 });
        await tx.execute({ sql: `INSERT INTO licenses
          (id,customer_id,product_id,license_key_hash,license_key_hint,status,starts_at,expires_at,max_activations,created_by,license_type_id,license_type_name,license_terms_json,offline_days,billing_cycle,billing_amount,currency,next_billing_at)
          VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [newId,String(old.customer_id),String(old.product_id),keyHash,keyHint,issuedAt,old.expires_at ?? null,Number(old.max_activations),session.sub,old.license_type_id ?? null,old.license_type_name ?? "Reposición por formateo",terms,0,old.billing_cycle ?? "once",fee,currency,old.next_billing_at ?? null] });
        await tx.execute({ sql: "UPDATE licenses SET status='revoked' WHERE id=? AND status<>'revoked'", args: [oldLicenseId] });
        await tx.execute({ sql: "UPDATE activations SET status='revoked',revoked_at=CURRENT_TIMESTAMP WHERE license_id=? AND status='active'", args: [oldLicenseId] });
        if (fee > 0) {
          await tx.execute({ sql: "INSERT INTO license_billing_records (id,license_id,record_type,amount,currency,billing_cycle,period_start,due_at,status,description,created_by) VALUES (?,?, 'adjustment',?,?, 'once',?,?, 'pending',?,?)",
            args: [randomUUID(),newId,fee,currency,issuedAt,issuedAt,`Reposición de licencia por formateo/cambio de equipo. ${reason}`,session.sub] });
        }
        await tx.execute({ sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
          args: [randomUUID(),session.sub,"license_replaced_after_format","license",newId,JSON.stringify({oldLicenseId,newLicenseId:newId,fee,currency,reason,oldLicenseRevoked:true})] });
        await tx.commit();
        return NextResponse.json({ ok: true, id: newId, replacedLicenseId: oldLicenseId, licenseKey: rawKey, warning: "Guarda esta clave ahora: no se vuelve a mostrar.", certificate: {
          certificateId: `SIC-CERT-${newId.slice(0,8).toUpperCase()}`, issuedAt, licenseKey: rawKey,
          licenseTypeName: String(old.license_type_name || "Reposición por formateo"), startsAt: issuedAt,
          expiresAt: old.expires_at ?? null, maxActivations: Number(old.max_activations), terms: JSON.parse(String(terms)),
          customerName: old.customer_name, customerEmail: old.customer_email, customerPhone: old.customer_phone,
          customerAddress: old.customer_address, productName: old.product_name, productEdition: old.product_edition,
          productVersion: old.product_version, replacementFee: fee, replacementCurrency: currency,
          replacedCertificateId: oldLicenseId
        } }, { status: 201 });
      } catch {
        await tx.rollback().catch(() => undefined);
        throw new Error("No se pudo reponer la licencia.");
      }
    }
    const customerId = typeof data.customerId === "string" ? data.customerId : "";
    const productId = typeof data.productId === "string" ? data.productId : "";
    const licenseTypeId = typeof data.licenseTypeId === "string" ? data.licenseTypeId : "";
    let maxActivations = Number(data.maxActivations ?? 1);
    let offlineDays = 0;
    let licenseTypeName = "Personalizada";
    let billingCycle = "once";
    let billingAmount = 0;
    let currency = "USD";
    let licenseTerms: Record<string, unknown> = {
      durationDays: null, supportTerms: "", updateTerms: "",
      extraActivationTerms: "", terms: "", offlineDays
    };
    const startsInput = typeof data.startsAt === "string" && data.startsAt ? data.startsAt : null;
    const expiresInput = typeof data.expiresAt === "string" && data.expiresAt ? data.expiresAt : null;
    let expiresAt = expiresInput && /^\d{4}-\d{2}-\d{2}$/.test(expiresInput) ? `${expiresInput}T23:59:59.999Z` : expiresInput;
    let startsAt = startsInput && /^\d{4}-\d{2}-\d{2}$/.test(startsInput) ? `${startsInput}T00:00:00.000Z` : startsInput;
    const db = getDb();
    if (licenseTypeId) {
      const planResult = await db.execute({ sql: "SELECT * FROM license_types WHERE id=? AND active=1 LIMIT 1", args: [licenseTypeId] });
      const plan = planResult.rows[0];
      if (!plan) return NextResponse.json({ error: "El tipo de licencia seleccionado no existe o está inactivo." }, { status: 400 });
      licenseTypeName = String(plan.name);
      billingCycle = ["once","monthly","yearly"].includes(String(plan.billing_cycle)) ? String(plan.billing_cycle) : "once";
      billingAmount = Math.max(0, Number(plan.price_amount ?? 0));
      currency = /^[A-Z]{3}$/.test(String(plan.currency ?? "USD")) ? String(plan.currency) : "USD";
      maxActivations = Number(plan.max_activations);
      offlineDays = 0;
      licenseTerms = {
        durationDays: plan.duration_days === null ? null : Number(plan.duration_days),
        supportTerms: String(plan.support_terms ?? ""),
        updateTerms: String(plan.update_terms ?? ""),
        extraActivationTerms: String(plan.extra_activation_terms ?? ""),
        terms: String(plan.terms ?? ""),
        priceLabel: String(plan.price_label ?? ""),
        billingCycle, billingAmount, currency,
        offlineDays
      };
      if (!startsAt) startsAt = new Date().toISOString();
      if (plan.duration_days !== null && plan.duration_days !== undefined) {
        const expiry = new Date(Date.parse(startsAt) + (Number(plan.duration_days) - 1) * 86400000);
        expiry.setUTCHours(23,59,59,999);
        expiresAt = expiry.toISOString();
      } else {
        expiresAt = null;
      }
    }
    if (!customerId || !productId || !Number.isInteger(maxActivations) || maxActivations < 1 || maxActivations > 100) {
      return NextResponse.json({ error: "Cliente, producto y límite válido de equipos son obligatorios." }, { status: 400 });
    }
    if (startsAt && Number.isNaN(Date.parse(startsAt)) || expiresAt && Number.isNaN(Date.parse(expiresAt))) {
      return NextResponse.json({ error: "Las fechas de vigencia no son válidas." }, { status: 400 });
    }
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      return NextResponse.json({ error: "La fecha de vencimiento debe ser posterior al inicio." }, { status: 400 });
    }
    const related = await db.execute({
      sql: "SELECT (SELECT COUNT(*) FROM customers WHERE id=? AND status='active') AS customer_ok,(SELECT COUNT(*) FROM products WHERE id=? AND status='active') AS product_ok",
      args: [customerId, productId]
    });
    const row = related.rows[0];
    if (!row || Number(row.customer_ok) !== 1 || Number(row.product_ok) !== 1) {
      return NextResponse.json({ error: "El cliente o producto no existe o está inactivo." }, { status: 400 });
    }

    const id = randomUUID();
    const rawKey = `SIC-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyHint = `…${rawKey.slice(-4)}`;
    const now = new Date();
    const nextBilling = billingCycle === "monthly" ? new Date(now.getTime() + 30 * 86400000).toISOString() : billingCycle === "yearly" ? new Date(now.getTime() + 365 * 86400000).toISOString() : null;
    const statements = [
      { sql: "INSERT INTO licenses (id,customer_id,product_id,license_key_hash,license_key_hint,status,starts_at,expires_at,max_activations,created_by,license_type_id,license_type_name,license_terms_json,offline_days,billing_cycle,billing_amount,currency,next_billing_at) VALUES (?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?)", args: [id,customerId,productId,keyHash,keyHint,startsAt,expiresAt,maxActivations,session.sub,licenseTypeId || null,licenseTypeName,JSON.stringify(licenseTerms),offlineDays,billingCycle,billingAmount,currency,nextBilling] },
      { sql: "INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)", args: [randomUUID(),session.sub,"license_issued","license",id,JSON.stringify({customerId,productId,maxActivations,licenseTypeId,licenseTypeName,expiresAt,offlineDays,billingCycle,billingAmount,currency})] }
    ];
    if (billingAmount > 0) statements.push({ sql: "INSERT INTO license_billing_records (id,license_id,record_type,amount,currency,billing_cycle,period_start,period_end,due_at,status,description,created_by) VALUES (?,?, 'initial',?,?,?,?,?,?,'pending',?,?)", args: [randomUUID(),id,billingAmount,currency,billingCycle,now.toISOString(),nextBilling,now.toISOString(),"Emisión de licencia: " + licenseTypeName,session.sub] });
    await db.batch(statements, "write");
    const details = await db.execute({
      sql: "SELECT c.display_name AS customerName,c.email AS customerEmail,c.phone AS customerPhone,c.address AS customerAddress,p.name AS productName,p.edition AS productEdition,p.version AS productVersion FROM customers c,products p WHERE c.id=? AND p.id=?",
      args: [customerId,productId]
    });
    return NextResponse.json({
      ok: true, id, licenseKey: rawKey, warning: "Guarda esta clave ahora: no se vuelve a mostrar.",
      certificate: {
        certificateId: `SIC-CERT-${id.slice(0,8).toUpperCase()}`,
        issuedAt: new Date().toISOString(), licenseKey: rawKey,
        licenseTypeName, startsAt, expiresAt, maxActivations, issuedAt: new Date().toISOString(), terms: licenseTerms,
        ...(details.rows[0] ?? {})
      }
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo emitir la licencia." }, { status: 503 });
  }
}
