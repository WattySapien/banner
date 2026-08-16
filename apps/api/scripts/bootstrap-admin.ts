import { closeDatabase, getDatabase } from "@clipx/database";
import { storage } from "../src/storage.js";
import "../src/config.js";

const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password=process.env.ADMIN_PASSWORD;
if(!email||!password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
if(password.length<12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters");

try{
  const sql=getDatabase();
  const [existing]=await sql<Array<{id:string}>>`SELECT id FROM users WHERE lower(email)=lower(${email})`;
  const userId=existing?.id??(await storage.createLocalUser(email,password,process.env.ADMIN_FIRST_NAME?.trim()||"ClipX",process.env.ADMIN_LAST_NAME?.trim()||"Administrator")).id;
  await sql`UPDATE users SET is_admin=1,is_active=1,updated_at=now() WHERE id=${userId}`;
  console.log(`Administrator ready: ${email}`);
}finally{
  await closeDatabase();
}
