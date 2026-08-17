import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer as createViteServer } from "vite";
import { runAutomation } from "./clipx-automation.js";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const hasChrome = chromeCandidates.some((candidate) => fs.existsSync(candidate));

function closeNodeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function getAvailablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  await closeNodeServer(server);
  return port;
}

test("transaction-history workflow runs end to end against isolated SQLite", { skip: !hasChrome, timeout: 90_000 }, async () => {
  process.env.NODE_ENV = "development";
  delete process.env.DATABASE_URL;
  process.env.CARD_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
  const webPort = await getAvailablePort();
  process.env.CORS_ORIGINS = `http://127.0.0.1:${webPort}`;
  const directory = await mkdtemp(path.join(os.tmpdir(), "clipx-automation-e2e-"));
  const databasePath = path.join(directory, "clipx.db");
  const [{ SQLiteStorage }, { createApp }] = await Promise.all([
    import("../apps/api/src/storage.sqlite.ts"),
    import("../apps/api/src/app.ts"),
  ]);
  const storage = new SQLiteStorage(databasePath);
  const user = await storage.createLocalUser("automation-e2e@clipx.local", "Password123", "Automation", "E2E");
  const apiServer = createApp(storage).listen(0, "127.0.0.1");
  await once(apiServer, "listening");
  const apiAddress = apiServer.address();
  assert.ok(apiAddress && typeof apiAddress === "object");

  const webRoot = path.resolve(import.meta.dirname, "../apps/web");
  const originalWorkingDirectory = process.cwd();
  process.chdir(webRoot);
  let vite;
  try {
    vite = await createViteServer({
      root: webRoot,
      configFile: path.join(webRoot, "vite.config.ts"),
      logLevel: "error",
      server: {
        host: "127.0.0.1",
        port: webPort,
        strictPort: true,
        proxy: {
          "/api": {
            target: `http://127.0.0.1:${apiAddress.port}`,
            changeOrigin: true,
          },
        },
      },
    });
    await vite.listen();
    const result = await runAutomation({
      action: "create-transaction-history",
      baseUrl: `http://127.0.0.1:${webPort}`,
      email: user.email,
      password: "Password123",
      transactionCount: 1,
      transferAmount: 1,
      note: "Isolated E2E entry",
      balanceReserve: 5,
      allowDatabaseMutations: true,
      sqlitePath: databasePath,
      headless: true,
    });
    assert.equal(result.transactions.length, 1);
    assert.match(result.transactions[0].reference, /^TRF-/);
    assert.equal((await storage.getTransactions(user.id)).length, 1);
  } finally {
    if (vite) await vite.close();
    await closeNodeServer(apiServer);
    process.chdir(originalWorkingDirectory);
    await rm(directory, { recursive: true, force: true });
  }
});
