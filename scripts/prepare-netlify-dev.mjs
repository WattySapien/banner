import fs from "node:fs/promises";
import path from "node:path";

const netlifyStateDirectory = path.resolve(process.cwd(), "apps/web/.netlify");
await fs.mkdir(netlifyStateDirectory, { recursive: true });
await fs.writeFile(
  path.join(netlifyStateDirectory, "package.json"),
  `${JSON.stringify({ private: true, type: "commonjs" }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
