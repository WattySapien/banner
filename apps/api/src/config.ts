import dotenv from "dotenv";
import path from "node:path";

// npm workspace scripts run from apps/api, while direct commands may run from
// the repository root. Avoid import.meta here because Netlify bundles Functions
// as CommonJS, where import.meta.dirname is undefined.
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });
dotenv.config({ quiet: true });

const port = Number.parseInt(process.env.PORT ?? "5000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`Invalid PORT value: ${process.env.PORT}`);
const sessionDays=Number.parseInt(process.env.SESSION_DAYS??"7",10);
if(!Number.isInteger(sessionDays)||sessionDays<1||sessionDays>90) throw new Error("SESSION_DAYS must be an integer between 1 and 90");

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  host: process.env.HOST ?? "127.0.0.1",
  isProduction: process.env.NODE_ENV === "production",
  allowedOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000").split(",").map((value)=>value.trim()).filter(Boolean),
  sessionDays,
} as const;
