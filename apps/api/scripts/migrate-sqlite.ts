import path from "node:path";
import Database from "better-sqlite3";
import postgres from "postgres";
import "../src/config.js";

const sourcePath=process.env.SQLITE_DATABASE_PATH??path.resolve(import.meta.dirname,"../../../clipx.db");
const targetUrl=process.env.DIRECT_DATABASE_URL??process.env.DATABASE_URL;
if(!targetUrl) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required");

const source=new Database(sourcePath,{readonly:true,fileMustExist:true});
const target=postgres(targetUrl,{max:1});
const rows=(table:string)=>source.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string,unknown>>;

try{
  const sourceCounts:Record<string,number>={};
  const tableNames=["users","local_credentials","accounts","transactions","cards","beneficiaries","cash_flow","user_preferences"];
  for(const table of tableNames) sourceCounts[table]=rows(table).length;

  await target.begin(async(sql)=>{
    for(const row of rows("users")) await sql`INSERT INTO users (id,email,first_name,last_name,profile_image_url,is_admin,is_active,created_at,updated_at,last_active_at) VALUES (${String(row.id)},${String(row.email)},${String(row.first_name)},${String(row.last_name)},${row.profile_image_url as string|null},${Number(row.is_admin)},${Number(row.is_active)},${String(row.created_at)},${String(row.updated_at)},${String(row.last_active_at)}) ON CONFLICT (id) DO UPDATE SET email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name,profile_image_url=excluded.profile_image_url,is_admin=excluded.is_admin,is_active=excluded.is_active,updated_at=excluded.updated_at,last_active_at=excluded.last_active_at`;
    for(const row of rows("local_credentials")) await sql`INSERT INTO local_credentials (user_id,password_hash,password_salt,updated_at) VALUES (${String(row.user_id)},${String(row.password_hash)},${String(row.password_salt)},${String(row.updated_at)}) ON CONFLICT (user_id) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt,updated_at=excluded.updated_at`;
    for(const row of rows("user_preferences")) await sql`INSERT INTO user_preferences (user_id,transaction_alerts,monthly_summary,show_balances) VALUES (${String(row.user_id)},${Number(row.transaction_alerts)},${Number(row.monthly_summary)},${Number(row.show_balances)}) ON CONFLICT (user_id) DO UPDATE SET transaction_alerts=excluded.transaction_alerts,monthly_summary=excluded.monthly_summary,show_balances=excluded.show_balances`;
    for(const row of rows("accounts")) await sql`INSERT INTO accounts (id,user_id,name,type,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps) VALUES (${String(row.id)},${String(row.user_id)},${String(row.name)},${String(row.type)},${String(row.masked_number)},${String(row.currency)},${Number(row.balance_cents)},${Number(row.available_balance_cents)},${row.interest_rate_bps===null?null:Number(row.interest_rate_bps)}) ON CONFLICT (id) DO UPDATE SET user_id=excluded.user_id,name=excluded.name,type=excluded.type,masked_number=excluded.masked_number,currency=excluded.currency,balance_cents=excluded.balance_cents,available_balance_cents=excluded.available_balance_cents,interest_rate_bps=excluded.interest_rate_bps`;
    for(const row of rows("transactions")) await sql`INSERT INTO transactions (id,account_id,description,merchant,category,amount_cents,direction,status,reference,created_at) VALUES (${String(row.id)},${String(row.account_id)},${String(row.description)},${String(row.merchant)},${String(row.category)},${Number(row.amount_cents)},${String(row.direction)},${String(row.status)},${String(row.reference)},${String(row.created_at)}) ON CONFLICT (id) DO UPDATE SET account_id=excluded.account_id,description=excluded.description,merchant=excluded.merchant,category=excluded.category,amount_cents=excluded.amount_cents,direction=excluded.direction,status=excluded.status,reference=excluded.reference,created_at=excluded.created_at`;
    for(const row of rows("cards")) await sql`INSERT INTO cards (id,account_id,holder_name,last_four,network,type,status,spending_limit_cents,expires) VALUES (${String(row.id)},${String(row.account_id)},${String(row.holder_name)},${String(row.last_four)},${String(row.network)},${String(row.type)},${String(row.status)},${Number(row.spending_limit_cents)},${String(row.expires)}) ON CONFLICT (id) DO UPDATE SET account_id=excluded.account_id,holder_name=excluded.holder_name,last_four=excluded.last_four,network=excluded.network,type=excluded.type,status=excluded.status,spending_limit_cents=excluded.spending_limit_cents,expires=excluded.expires`;
    for(const row of rows("beneficiaries")) await sql`INSERT INTO beneficiaries (id,user_id,name,bank_name,masked_account,initials) VALUES (${String(row.id)},${String(row.user_id)},${String(row.name)},${String(row.bank_name)},${String(row.masked_account)},${String(row.initials)}) ON CONFLICT (id) DO UPDATE SET user_id=excluded.user_id,name=excluded.name,bank_name=excluded.bank_name,masked_account=excluded.masked_account,initials=excluded.initials`;
    for(const row of rows("cash_flow")) await sql`INSERT INTO cash_flow (user_id,month,sort_order,income_cents,spending_cents) VALUES (${String(row.user_id)},${String(row.month)},${Number(row.sort_order)},${Number(row.income_cents)},${Number(row.spending_cents)}) ON CONFLICT (user_id,month) DO UPDATE SET sort_order=excluded.sort_order,income_cents=excluded.income_cents,spending_cents=excluded.spending_cents`;
  });

  const targetCounts:Record<string,number>={};
  for(const table of tableNames){const [result]=await target.unsafe<Array<{count:number}>>(`SELECT count(*)::int count FROM ${table}`);targetCounts[table]=Number(result.count);}
  const mismatches=tableNames.filter((table)=>targetCounts[table]<sourceCounts[table]);
  if(mismatches.length) throw new Error(`Migration verification failed for: ${mismatches.join(", ")}`);
  console.log(JSON.stringify({source:sourcePath,sourceCounts,targetCounts},null,2));
}finally{
  source.close();
  await target.end();
}
