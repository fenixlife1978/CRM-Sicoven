import { NextRequest, NextResponse } from "next/server";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId")?.trim() || "";
  if (!productId || productId.length > 80) {
    return NextResponse.json(
      { error: "Debes ingresar desde «Ver planes» de un producto del catálogo." },
      { status: 400, headers: noStore }
    );
  }

  try {
    await bootstrapDatabase();
    const db = getDb();
    const productResult = await db.execute({
      sql: "SELECT id,name,product_code,edition,version,description FROM products WHERE id=? AND status='active' LIMIT 1",
      args: [productId]
    });

    const product = productResult.rows[0];
    if (!product) {
      return NextResponse.json(
        { error: "El producto solicitado no existe o no tiene una oferta activa. Regresa al catálogo y selecciona «Ver planes»." },
        { status: 404, headers: noStore }
      );
    }

    const [plans, banks, whatsapp, features] = await Promise.all([
      db.execute({
        sql: "SELECT cp.id,cp.product_id,cp.name,cp.description,cp.price_amount,cp.currency,cp.duration_days,cp.max_activations FROM commercial_plans cp WHERE cp.product_id=? AND cp.active=1 ORDER BY cp.price_amount",
        args: [productId]
      }),
      db.execute("SELECT id,bank_code,bank_name,identity_document,phone_number,account_number FROM payment_bank_accounts WHERE active=1 ORDER BY bank_name,created_at DESC"),
      db.execute("SELECT setting_value FROM commercial_settings WHERE setting_key='whatsapp_admin_phone' LIMIT 1"),
      db.execute({sql:"SELECT plan_id,feature_text,sort_order FROM commercial_plan_features WHERE plan_id IN (SELECT id FROM commercial_plans WHERE product_id=? AND active=1) ORDER BY plan_id,sort_order,created_at",args:[productId]})
    ]);
    const planRows=plans.rows.map(plan=>({...plan,features:features.rows.filter(feature=>String(feature.plan_id)===String(plan.id)).map(feature=>String(feature.feature_text))}));

    return NextResponse.json({
      products: [product],
      plans: planRows,
      banks: banks.rows,
      whatsappAdminPhone: String(whatsapp.rows[0]?.setting_value || "04125773996")
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "El catálogo comercial no está disponible temporalmente." }, { status: 503, headers: noStore });
  }
}
