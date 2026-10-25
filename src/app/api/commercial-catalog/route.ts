import { NextResponse } from "next/server";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await bootstrapDatabase();
    const db = getDb();
    const [products, plans, banks] = await Promise.all([
      db.execute("SELECT id,name,edition,version,description FROM products WHERE status='active' ORDER BY name"),
      db.execute("SELECT id,product_id,name,description,price_amount,currency,duration_days,max_activations FROM commercial_plans WHERE active=1 ORDER BY product_id,price_amount"),
      db.execute("SELECT id,bank_code,bank_name,identity_document,phone_number,account_number FROM payment_bank_accounts WHERE active=1 ORDER BY bank_name,created_at DESC")
    ]);
    return NextResponse.json({ products: products.rows, plans: plans.rows, banks: banks.rows }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "El catálogo comercial no está disponible temporalmente." }, { status: 503 });
  }
}
