import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  normalizeAction,
  preflightServer,
  validateAutomationOptions,
  validateEmail,
  validateLocalUrl,
  validatePositiveInteger,
  validateTransferAmount,
} from "./clipx-automation.js";
import { ensureAutomationFixtures, generateBackendTransactionHistory } from "./fixture-bootstrap.js";

test("automation input validation is strict and aligned with API limits", () => {
  assert.equal(normalizeAction("1"), "create-account");
  assert.equal(normalizeAction("history"), "create-transaction-history");
  assert.equal(validatePositiveInteger("5", "Count", 50), 5);
  assert.throws(() => validatePositiveInteger("5abc", "Count", 50), /must be an integer/);
  assert.throws(() => validatePositiveInteger("2.9", "Count", 50), /must be an integer/);
  assert.equal(validateTransferAmount("10.25"), 10.25);
  assert.throws(() => validateTransferAmount("10.001"), /two decimal places/);
  assert.throws(() => validateTransferAmount("50000.01"), /between/);
  assert.equal(validateEmail(" Test@Example.com "), "test@example.com");
});

test("automation accepts only credential-free local HTTP URLs", () => {
  assert.equal(validateLocalUrl("http://127.0.0.1:3000/path"), "http://127.0.0.1:3000");
  assert.throws(() => validateLocalUrl("https://example.com"), /restricted to the local/);
  assert.throws(() => validateLocalUrl("ftp://localhost/resource"), /http or https/);
  assert.throws(() => validateLocalUrl("http://user:pass@localhost:3000"), /must not contain credentials/);
});

test("database mutation opt-in is mandatory", () => {
  assert.throws(() => validateAutomationOptions({
    action: "create-account",
    baseUrl: "http://localhost:3000",
    email: "test@example.com",
    password: "Password123",
    firstName: "Test",
    lastName: "User",
  }), /mutations are disabled/);
});

test("backend history validation does not require a browser password", () => {
  const options = validateAutomationOptions({
    action: "create-backend-history",
    baseUrl: "http://localhost:3000",
    email: "test@example.com",
    transactionCount: 3,
    transferAmount: 12.5,
    allowDatabaseMutations: true,
  });
  assert.equal(options.password, undefined);
  assert.equal(options.transactionCount, 3);
});

test("health preflight rejects unhealthy or unsupported responses", async () => {
  const healthy = await preflightServer("http://localhost:3000", async () => ({
    ok: true,
    json: async () => ({ status: "ok", storage: "sqlite" }),
  }));
  assert.equal(healthy.storage, "sqlite");
  await assert.rejects(() => preflightServer("http://localhost:3000", async () => ({
    ok: false,
    status: 503,
  })), /HTTP 503/);
});

test("SQLite fixture bootstrap provisions prerequisites idempotently", async () => {
  process.env.CARD_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  const directory = await mkdtemp(path.join(os.tmpdir(), "clipx-automation-fixture-"));
  const databasePath = path.join(directory, "clipx.db");
  const { SQLiteStorage } = await import("../apps/api/src/storage.sqlite.ts");
  const storage = new SQLiteStorage(databasePath);
  try {
    const user = await storage.createLocalUser("fixture@clipx.local", "Password123", "Fixture", "User");
    await assert.rejects(() => ensureAutomationFixtures({
      storageKind: "sqlite",
      email: user.email,
      requiredBalanceCents: 5_000,
      sqlitePath: databasePath,
    }), /mutations are disabled/);

    const first = await ensureAutomationFixtures({
      storageKind: "sqlite",
      email: user.email,
      requiredBalanceCents: 5_000,
      allowMutations: true,
      nodeEnv: "test",
      sqlitePath: databasePath,
    });
    assert.equal(first.createdAccount, true);
    assert.equal(first.createdBeneficiary, true);
    assert.equal(first.availableBalance, 50);
    assert.equal((await storage.getAccounts(user.id)).length, 1);
    assert.equal((await storage.getBeneficiaries(user.id)).length, 1);

    const second = await ensureAutomationFixtures({
      storageKind: "sqlite",
      email: user.email,
      requiredBalanceCents: 5_000,
      allowMutations: true,
      nodeEnv: "test",
      sqlitePath: databasePath,
    });
    assert.equal(second.createdAccount, false);
    assert.equal(second.createdBeneficiary, false);
    assert.equal(second.balanceAdded, 0);

    const history = await generateBackendTransactionHistory({
      storageKind: "sqlite",
      accountId: first.accountId,
      count: 4,
      amountCents: 1_000,
      note: "Backend fixture",
      allowMutations: true,
      nodeEnv: "test",
      sqlitePath: databasePath,
    });
    assert.equal(history.length, 4);
    assert.ok(history.every((entry) => entry.reference.startsWith("HST-")));
    assert.equal((await storage.getTransactions(user.id)).length, 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
