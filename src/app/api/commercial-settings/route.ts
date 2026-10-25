import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().replace(/\s+/g," ").slice(0,max) : "";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({error:"No autenticado."},{status:401,headers:noStore});
  if (session.role !== "admin") return NextResponse.json({error:"Solo el administrador puede configurar la comercialización."},{status:403,headers:noStore});
  try {
    await bootstrapDatabase();
    const db=getDb();
    const [products,plans,banks]=await Promise.all([
      db.execute("SELECT id,name,edition,status FROM products ORDER BY name"),
      db.execute("SELECT id,product_id,name,description,price_amount,currency,duration_days,max_activations,active FROM commercial_plans ORDER BY created_at DESC"),
      db.execute("SELECT id,bank_code,bank_name,identity_document,phone_number,account_number,active FROM payment_bank_accounts ORDER BY created_at DESC")
    ]);
    return NextResponse.json({products:products.rows,plans:plans.rows,banks:banks.rows},{headers:noStore});
  } catch { return NextResponse.json({error:"No se pudo cargar la configuración comercial."},{status:503,headers:noStore}); }
}

export async function POST(request:NextRequest) {
  const session=await getSession();
  if(!session) return NextResponse.json({error:"No autenticado."},{status:401,headers:noStore});
  if(session.role!=="admin") return NextResponse.json({error:"Solo el administrador puede configurar la comercialización."},{status:403,headers:noStore});
  try {
    await bootstrapDatabase();
    const body:unknown=await request.json();
    if(!body||typeof body!=="object") return NextResponse.json({error:"Solicitud inválida."},{status:400,headers:noStore});
    const d=body as Record<string,unknown>;
    const action=clean(d.action,30);
    const db=getDb();
    if(action==="create-plan") {
      const productId=clean(d.productId,80), name=clean(d.name,100), description=clean(d.description,500);
      const price=Number(d.priceAmount), currency=clean(d.currency,3).toUpperCase();
      const duration=d.durationDays===""||d.durationDays===null||d.durationDays===undefined?null:Number(d.durationDays);
      const max=Number(d.maxActivations);
      if(!productId||!name||!Number.isFinite(price)||price<0||!/^[A-Z]{3}$/.test(currency)||!Number.isInteger(max)||max<1||max>100||
        (duration!==null&&(!Number.isInteger(duration)||duration<1||duration>36500))) return NextResponse.json({error:"Revisa nombre, precio, moneda, duración y número de equipos."},{status:400,headers:noStore});
      const p=await db.execute({sql:"SELECT id FROM products WHERE id=? AND status='active' LIMIT 1",args:[productId]});
      if(!p.rows.length) return NextResponse.json({error:"El producto no existe o está inactivo."},{status:400,headers:noStore});
      const id=randomUUID();
      await db.batch([
        {sql:"INSERT INTO commercial_plans (id,product_id,name,description,price_amount,currency,duration_days,max_activations,active) VALUES (?,?,?,?,?,?,?,?,1)",args:[id,productId,name,description||null,price,currency,duration,max]},
        {sql:"INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",args:[randomUUID(),session.sub,"commercial_plan_created","commercial_plan",id,JSON.stringify({productId,name,price,currency,duration,max})]}
      ],"write");
      return NextResponse.json({ok:true,id},{status:201,headers:noStore});
    }
    if(action==="create-bank") {
      const bankCode=clean(d.bankCode,20);
      const bankName=bankCode==="BDV"?"Banco de Venezuela":bankCode==="MERCANTIL"?"Mercantil":"";
      const identity=clean(d.identityDocument,40), phone=clean(d.phoneNumber,40), account=clean(d.accountNumber,40);
      if(!bankName||!identity||!phone) return NextResponse.json({error:"Selecciona uno de los bancos admitidos e indica documento y teléfono."},{status:400,headers:noStore});
      const id=randomUUID();
      await db.batch([
        {sql:"INSERT INTO payment_bank_accounts (id,bank_code,bank_name,holder_name,identity_document,phone_number,account_number,active) VALUES (?,?,?,?,?,?,?,1)",args:[id,bankCode,bankName,"",identity,phone,account||null]},
        {sql:"INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",args:[randomUUID(),session.sub,"payment_bank_created","payment_bank_account",id,JSON.stringify({bankCode,bankName,identity,phone})]}
      ],"write");
      return NextResponse.json({ok:true,id},{status:201,headers:noStore});
    }
    if(action==="update-bank") {
      const id=clean(d.id,80), bankCode=clean(d.bankCode,20);
      const bankName=bankCode==="BDV"?"Banco de Venezuela":bankCode==="MERCANTIL"?"Mercantil":"";
      const identity=clean(d.identityDocument,40), phone=clean(d.phoneNumber,40), account=clean(d.accountNumber,40);
      if(!id||!bankName||!identity||!phone) return NextResponse.json({error:"Selecciona el banco e indica documento y teléfono."},{status:400,headers:noStore});
      const r=await db.execute({sql:"UPDATE payment_bank_accounts SET bank_code=?,bank_name=?,identity_document=?,phone_number=?,account_number=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",args:[bankCode,bankName,identity,phone,account||null,id]});
      if(r.rowsAffected===0) return NextResponse.json({error:"No se encontró la cuenta bancaria."},{status:404,headers:noStore});
      await db.execute({sql:"INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",args:[randomUUID(),session.sub,"payment_bank_updated","payment_bank_account",id,JSON.stringify({bankCode,bankName,identity,phone})]});
      return NextResponse.json({ok:true},{headers:noStore});
    }
    if(action==="delete-bank") {
      const id=clean(d.id,80);
      if(!id) return NextResponse.json({error:"Identificador requerido."},{status:400,headers:noStore});
      const existing=await db.execute({sql:"SELECT id FROM payment_bank_accounts WHERE id=? LIMIT 1",args:[id]});
      if(!existing.rows.length) return NextResponse.json({error:"No se encontró la cuenta bancaria."},{status:404,headers:noStore});
      // Keep historical payment reports valid: remove the account from public use by deactivating it.
      await db.batch([
        {sql:"UPDATE payment_bank_accounts SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?",args:[id]},
        {sql:"INSERT INTO audit_log (id,user_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",args:[randomUUID(),session.sub,"payment_bank_deleted","payment_bank_account",id,JSON.stringify({deactivated:true})]}
      ],"write");
      return NextResponse.json({ok:true,archived:true},{headers:noStore});
    }
    if(action==="toggle-plan"||action==="toggle-bank") {
      const id=clean(d.id,80), active=d.active===true?1:0;
      if(!id) return NextResponse.json({error:"Identificador requerido."},{status:400,headers:noStore});
      const table=action==="toggle-plan"?"commercial_plans":"payment_bank_accounts";
      const r=await db.execute({sql:`UPDATE ${table} SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,args:[active,id]});
      if(r.rowsAffected===0) return NextResponse.json({error:"No se encontró el registro."},{status:404,headers:noStore});
      return NextResponse.json({ok:true},{headers:noStore});
    }
    return NextResponse.json({error:"Acción no reconocida."},{status:400,headers:noStore});
  } catch { return NextResponse.json({error:"No se pudo guardar la configuración comercial."},{status:503,headers:noStore}); }
}
