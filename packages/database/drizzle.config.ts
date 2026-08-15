import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({path:path.resolve(import.meta.dirname,"../../.env"),quiet:true});

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required");

export default defineConfig({
  out: "./migrations",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
});
