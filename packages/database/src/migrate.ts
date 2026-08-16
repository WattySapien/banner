import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({path:path.resolve(import.meta.dirname,"../../../.env"),quiet:true});

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required");

const migrationFiles = ["0001_banking_schema.sql", "0002_account_numbers.sql", "0003_internal_transfers.sql", "0004_peer_transfers.sql"];
const migrations = await Promise.all(migrationFiles.map((file) => fs.readFile(path.resolve(import.meta.dirname, `../migrations/${file}`), "utf8")));
const migration = migrations.join("\n");
const candidates: Array<{ label:string; url:string }> = [{ label:"direct", url }];
const runtimeUrl = process.env.DATABASE_URL;

if (runtimeUrl) {
  const sessionPooler = new URL(runtimeUrl);
  if (sessionPooler.hostname.endsWith(".pooler.supabase.com") && sessionPooler.port === "6543") {
    sessionPooler.port = "5432";
    if (sessionPooler.toString() !== url) candidates.push({ label:"session-pooler", url:sessionPooler.toString() });
  }
}

const retryableConnectionCodes = new Set(["28P01","CONNECT_TIMEOUT","ECONNREFUSED","ENETDOWN","ENETUNREACH","ENOTFOUND","EHOSTUNREACH","ETIMEDOUT"]);

for (const [index,candidate] of candidates.entries()) {
  const sql = postgres(candidate.url, { max:1, prepare:false, connect_timeout:20 });
  try {
    await sql.unsafe(migration);
    console.log(`Applied ${migrationFiles.join(", ")} using ${candidate.label}`);
    break;
  } catch (error) {
    const code=error&&typeof error==="object"&&"code" in error&&typeof error.code==="string"?error.code:"UNKNOWN";
    const hasFallback=index<candidates.length-1;
    if(!hasFallback||!retryableConnectionCodes.has(code)) throw error;
    console.warn(`Migration connection via ${candidate.label} failed (${code}); trying the IPv4 session pooler`);
  } finally {
    await sql.end({ timeout:5 });
  }
}
