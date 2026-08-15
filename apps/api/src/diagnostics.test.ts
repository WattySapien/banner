import assert from "node:assert/strict";
import test from "node:test";
import { atStage, classifyError } from "./diagnostics.js";

test("database authentication errors expose a safe stage and code", async () => {
  const databaseError = Object.assign(new Error("password authentication failed for a private database user"), { code: "28P01" });
  const caught = await atStage("signup.database.check_duplicate", async () => {
    throw databaseError;
  }).catch((error: unknown) => error);

  assert.deepEqual(classifyError(caught), {
    status: 503,
    code: "DATABASE_AUTH_FAILED",
    message: "Database authentication failed",
    stage: "signup.database.check_duplicate",
  });
  assert.equal(JSON.stringify(classifyError(caught)).includes("private database user"), false);
});

test("connection errors are categorized without returning raw details", async () => {
  const connectionError = Object.assign(new Error("private connection details"), { code: "CONNECT_TIMEOUT" });
  const caught = await atStage("health.database.ping", async () => {
    throw connectionError;
  }).catch((error: unknown) => error);

  assert.deepEqual(classifyError(caught), {
    status: 503,
    code: "DATABASE_TIMEOUT",
    message: "Database connection timed out",
    stage: "health.database.ping",
  });
});

test("database operation deadlines identify the safe application stage", async () => {
  const timeoutError = Object.assign(new Error("private database operation details"), { code: "DATABASE_OPERATION_TIMEOUT" });
  const caught = await atStage("admin.customer.database.create", async () => {
    throw timeoutError;
  }).catch((error: unknown) => error);

  assert.deepEqual(classifyError(caught), {
    status: 503,
    code: "DATABASE_OPERATION_TIMEOUT",
    message: "Database operation timed out",
    stage: "admin.customer.database.create",
  });
});
