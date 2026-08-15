import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({path:path.resolve(import.meta.dirname,"../../../.env"),quiet:true});

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required");

const sql = postgres(url, { max: 1 });
try {
  const migration = await fs.readFile(path.resolve(import.meta.dirname, "../migrations/0001_banking_schema.sql"), "utf8");
  await sql.unsafe(migration);
  console.log("Applied 0001_banking_schema.sql");
} finally {
  await sql.end();
}
