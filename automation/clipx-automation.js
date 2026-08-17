import fs from "node:fs";
import path from "node:path";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import puppeteer from "puppeteer-core";
import { assertAutomationFixtureTarget, createAccountLedgerFixture, ensureAutomationFixtures, generateBackendTransactionHistory } from "./fixture-bootstrap.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const AUTOMATION_ACTIONS = new Set(["create-account", "create-transaction-history", "create-backend-history", "create-account-ledger"]);
const MAX_TRANSACTION_COUNT = 50;
const MAX_TRANSFER_AMOUNT = 50_000;
const MAX_NOTE_LENGTH = 80;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function readMaskedInput(input, output, message) {
  return new Promise((resolve, reject) => {
    const wasRaw = Boolean(input.isRaw);
    let answer = "";
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    output.write(message);

    const finish = (error) => {
      input.off("keypress", onKeypress);
      input.setRawMode(wasRaw);
      output.write("\n");
      if (error) reject(error);
      else resolve(answer);
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") {
        finish(Object.assign(new Error("Automation cancelled."), { code: "AUTOMATION_CANCELLED" }));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish();
        return;
      }
      if (key.name === "backspace") {
        if (answer) {
          answer = answer.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }
      if (!key.ctrl && !key.meta && character) {
        answer += character;
        output.write("*".repeat([...character].length));
      }
    };
    input.on("keypress", onKeypress);
  });
}

function createTerminal(input, output) {
  let readline = createInterface({ input, output });
  return {
    question: (message) => readline.question(message),
    secret: async (message) => {
      if (!input.isTTY || typeof input.setRawMode !== "function") return readline.question(message);
      readline.close();
      try {
        return await readMaskedInput(input, output, message);
      } finally {
        readline = createInterface({ input, output });
      }
    },
    write: (message) => output.write(message),
    close: () => readline.close(),
  };
}

function parseArguments(argv) {
  return Object.fromEntries(argv.map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.length ? value.join("=") : true];
  }));
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error("Chrome was not found. Set CHROME_PATH to your Chrome executable.");
  }
  return executable;
}

export function validateLocalUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Local Ardenvia Bank URL must use http or https.");
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Automation is restricted to the local Ardenvia Bank server; received ${url.hostname}`);
  }
  if (url.username || url.password) throw new Error("Local Ardenvia Bank URL must not contain credentials.");
  return url.origin;
}

async function waitForPath(page, pathname) {
  await page.waitForFunction(
    (expectedPath) => window.location.pathname === expectedPath,
    { timeout: 15_000 },
    pathname,
  );
}

export function normalizeAction(value) {
  if (value === "1" || value === "account" || value === "create") return "create-account";
  if (value === "2" || value === "transactions" || value === "history") return "create-transaction-history";
  if (value === "3" || value === "backend" || value === "backend-history") return "create-backend-history";
  if (value === "4" || value === "ledger" || value === "account-ledger") return "create-account-ledger";
  return value;
}

export function validatePositiveInteger(value, label, maximum) {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return parsed;
}

export function validateEmail(value) {
  const normalized = String(value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address.");
  return normalized;
}

export function validateName(value, label) {
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > 60) throw new Error(`${label} must contain at most 60 characters.`);
  return normalized;
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 8) throw new Error("Password must contain at least eight characters.");
  return value;
}

export function validateTransferAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > MAX_TRANSFER_AMOUNT) {
    throw new Error(`Transfer amount must be between $0.01 and $${MAX_TRANSFER_AMOUNT.toLocaleString("en-US")}.`);
  }
  if (Number(amount.toFixed(2)) !== amount) throw new Error("Transfer amount must have no more than two decimal places.");
  return amount;
}

export function validateNote(value) {
  const note = String(value).trim() || "Automation history entry";
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`Transaction note must contain at most ${MAX_NOTE_LENGTH} characters.`);
  return note;
}

async function askRequired(terminal, label, defaultValue) {
  while (true) {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    const answer = (await terminal.question(`${label}${suffix}: `)).trim();
    if (answer) return answer;
    if (defaultValue) return defaultValue;
    terminal.write(`${label} is required.\n`);
  }
}

async function askForEmail(terminal, label, defaultValue) {
  while (true) {
    try {
      return validateEmail(await askRequired(terminal, label, defaultValue));
    } catch (error) {
      terminal.write(`${error.message}\n`);
    }
  }
}

async function askForName(terminal, label) {
  while (true) {
    try {
      return validateName(await askRequired(terminal, label), label);
    } catch (error) {
      terminal.write(`${error.message}\n`);
    }
  }
}

async function askForPassword(terminal, label) {
  while (true) {
    const answer = await terminal.secret(`${label}: `);
    try {
      return validatePassword(answer);
    } catch (error) {
      terminal.write(`${error.message}\n`);
    }
  }
}

async function askForAction(terminal) {
  terminal.write("\nArdenvia Bank automation\n");
  terminal.write("  1) Create an account\n");
  terminal.write("  2) Create transaction history through the browser\n");
  terminal.write("  3) Generate transaction history through the backend\n\n");

  while (true) {
    const action = normalizeAction((await terminal.question("Select an action (1, 2, or 3): ")).trim().toLowerCase());
    if (AUTOMATION_ACTIONS.has(action)) return action;
    terminal.write("Enter 1 for account creation, 2 for browser history, or 3 for backend history.\n");
  }
}

async function askForInteger(terminal, label, defaultValue, maximum) {
  while (true) {
    const answer = (await terminal.question(`${label} [${defaultValue}]: `)).trim() || String(defaultValue);
    try {
      return validatePositiveInteger(answer, label, maximum);
    } catch (error) {
      terminal.write(`${error.message}\n`);
    }
  }
}

async function askForPositiveAmount(terminal, defaultValue) {
  while (true) {
    const answer = (await terminal.question(`Transfer amount [${defaultValue}]: `)).trim() || String(defaultValue);
    try {
      return validateTransferAmount(answer);
    } catch (error) {
      terminal.write(`${error.message}\n`);
    }
  }
}

async function askForNote(terminal) {
  while (true) {
    const answer = await terminal.question("Transaction note [Automation history entry]: ");
    try {
      return validateNote(answer);
    } catch (error) {
      terminal.write(`${error.message}\n`);
    }
  }
}

async function confirmInTerminal(terminal, message) {
  while (true) {
    const answer = (await terminal.question(`${message} (y/N): `)).trim().toLowerCase();
    if (!answer || answer === "n" || answer === "no") return false;
    if (answer === "y" || answer === "yes") return true;
    terminal.write("Enter y for yes or n for no.\n");
  }
}

export async function promptForAutomationOptions({ input = process.stdin, output = process.stdout } = {}) {
  const terminal = createTerminal(input, output);

  try {
    const action = await askForAction(terminal);
    const baseUrl = await askRequired(terminal, "Local Ardenvia Bank URL", DEFAULT_BASE_URL);

    if (action === "create-account") {
      const firstName = await askForName(terminal, "First name");
      const lastName = await askForName(terminal, "Last name");
      const email = await askForEmail(terminal, "Email");
      const password = await askForPassword(terminal, "Password");
      let passwordConfirmation = await terminal.secret("Confirm password: ");
      while (password !== passwordConfirmation) {
        terminal.write("Password confirmation does not match.\n");
        passwordConfirmation = await terminal.secret("Confirm password: ");
      }

      terminal.write(`\nAccount: ${firstName} ${lastName} <${email}>\n`);
      const confirmed = await confirmInTerminal(terminal, "Create this account?");
      return { action, baseUrl, firstName, lastName, email, password, confirmed };
    }

    const email = await askForEmail(terminal, "Existing account email", "automation@ardenvia.local");
    const password = action === "create-transaction-history" ? await askForPassword(terminal, "Password") : undefined;
    const transactionCount = await askForInteger(terminal, "Number of transactions", 5, MAX_TRANSACTION_COUNT);
    const transferAmount = await askForPositiveAmount(terminal, 10);
    const note = await askForNote(terminal);

    const method = action === "create-backend-history" ? "directly through the backend" : "through the browser";
    terminal.write(`\nCreate ${transactionCount} transaction(s) around $${transferAmount.toFixed(2)} for ${email} ${method}.\n`);
    terminal.write("A test account, beneficiary, or balance may be provisioned in the configured automation database.\n");
    const confirmed = await confirmInTerminal(terminal, "Create this transaction history?");
    return { action, baseUrl, email, password, transactionCount, transferAmount, note, confirmed };
  } finally {
    terminal.close();
  }
}

async function confirmFlagOptions(options, { input = process.stdin, output = process.stdout } = {}) {
  const terminal = createTerminal(input, output);

  try {
    terminal.write("\nArdenvia Bank automation confirmation\n");
    if (options.action === "create-account") {
      terminal.write(`Create account: ${options.firstName || "(missing name)"} ${options.lastName || ""} <${options.email || "missing email"}>\n`);
      return confirmInTerminal(terminal, "Create this account?");
    }

    const method = options.action === "create-backend-history" ? " through the backend" : " through the browser";
    terminal.write(`Create ${options.transactionCount || 5} transaction(s) around $${Number(options.transferAmount || 10).toFixed(2)} for ${options.email || "(missing email)"}${method}.\n`);
    return confirmInTerminal(terminal, "Create this transaction history?");
  } finally {
    terminal.close();
  }
}

export async function preflightServer(baseUrl, fetchImplementation = fetch) {
  let response;
  try {
    response = await fetchImplementation(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new Error(`Ardenvia Bank health check failed at ${baseUrl}: ${error instanceof Error ? error.message : error}`);
  }
  if (!response.ok) throw new Error(`Ardenvia Bank health check returned HTTP ${response.status}.`);
  const health = await response.json();
  if (health?.status !== "ok" || !["postgres", "sqlite"].includes(health?.storage)) {
    throw new Error("Ardenvia Bank health check did not report a supported healthy database.");
  }
  return health;
}

export function validateAutomationOptions(options = {}) {
  const action = normalizeAction(options.action || "create-account");
  if (!AUTOMATION_ACTIONS.has(action)) throw new Error("Action must be 'create-account', 'create-transaction-history', 'create-backend-history', or 'create-account-ledger'.");
  if (!options.allowDatabaseMutations) {
    throw new Error("Automation database mutations are disabled. Set AUTOMATION_DATABASE_MUTATIONS=true only for a dedicated development or test database.");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Automation is disabled when NODE_ENV=production.");

  const baseUrl = validateLocalUrl(options.baseUrl || DEFAULT_BASE_URL);
  const email = validateEmail(options.email);
  const password = action === "create-backend-history" || action === "create-account-ledger" ? undefined : validatePassword(options.password);
  const normalized = { ...options, action, baseUrl, email, password };

  if (action === "create-account") {
    normalized.firstName = validateName(options.firstName, "First name");
    normalized.lastName = validateName(options.lastName, "Last name");
    return normalized;
  }

  normalized.transactionCount = validatePositiveInteger(options.transactionCount ?? 5, "Transaction count", MAX_TRANSACTION_COUNT);
  normalized.transferAmount = validateTransferAmount(options.transferAmount ?? 10);
  normalized.note = validateNote(options.note);
  const balanceReserve = Number(options.balanceReserve ?? 100);
  if (!Number.isFinite(balanceReserve) || balanceReserve < 0 || balanceReserve > MAX_TRANSFER_AMOUNT || Number(balanceReserve.toFixed(2)) !== balanceReserve) {
    throw new Error(`Automation balance reserve must be between $0.00 and $${MAX_TRANSFER_AMOUNT.toLocaleString("en-US")} with no more than two decimal places.`);
  }
  normalized.balanceReserve = balanceReserve;
  return normalized;
}

export async function createOrOpenAccount(page, {
  baseUrl = DEFAULT_BASE_URL,
  email,
  password,
  mode = "create",
  firstName,
  lastName,
}) {
  if (!email || !password) throw new Error("Both email and password are required.");
  if (password.length < 8) throw new Error("Password must contain at least eight characters.");
  if (!["create", "open"].includes(mode)) throw new Error("Account mode must be 'create' or 'open'.");

  const pathname = mode === "create" ? "/signup" : "/login";
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="auth-email"]', { visible: true });
  await page.type('[data-testid="auth-email"]', email);
  await page.type('[data-testid="auth-password"]', password);

  if (mode === "create") {
    if (!firstName || !lastName) throw new Error("First and last name are required to create an account.");
    await page.type('[data-testid="signup-first-name"]', firstName);
    await page.type('[data-testid="signup-last-name"]', lastName);
    await page.type('[data-testid="signup-confirm-password"]', password);
  }

  await page.click(`[data-testid="${mode === "create" ? "signup-submit" : "login-submit"}"]`);

  await waitForPath(page, "/dashboard");
  await page.waitForSelector("#main-content", { visible: true });
  return { mode, email, pathname: page.url() };
}

export async function makeTransfer(page, {
  baseUrl = DEFAULT_BASE_URL,
  amount,
  note = "Puppeteer automation transfer",
}) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Transfer amount must be a positive number.");
  }

  await page.goto(`${baseUrl}/transfer`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("#source")?.querySelectorAll("option").length > 0);
  await page.click('[data-testid="transfer-mode-saved-recipient"]');
  await page.waitForSelector('[data-testid="beneficiary-option"]', { visible: true });
  await page.click('[data-testid="beneficiary-option"]');
  await page.type("#amount", numericAmount.toFixed(2));
  await page.type("#note", note.slice(0, 80));
  const transferResponsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && new URL(response.url()).pathname === "/api/transfers";
  }, { timeout: 15_000 });
  await page.click('[data-testid="transfer-submit"]');
  const transferResponse = await transferResponsePromise;
  if (!transferResponse.ok()) {
    const payload = await transferResponse.json().catch(() => undefined);
    throw new Error(payload?.message || `Transfer request failed with HTTP ${transferResponse.status()}.`);
  }
  await page.waitForSelector('[data-testid="transfer-complete"]', { visible: true, timeout: 15_000 });
  const reference = await page.$eval('[data-testid="transfer-reference"]', (element) => element.textContent?.trim() ?? "");
  if (!reference) throw new Error("The completed transfer did not include a reference.");
  return { amount: numericAmount, reference };
}

export async function createTransactionHistory(page, {
  baseUrl = DEFAULT_BASE_URL,
  count = 5,
  amount = 10,
  note = "Automation history entry",
}) {
  const transactionCount = validatePositiveInteger(count, "Transaction count", 50);
  const transactions = [];

  for (let index = 0; index < transactionCount; index += 1) {
    try {
      const transaction = await makeTransfer(page, {
        baseUrl,
        amount,
        note: `${note} ${index + 1}`.slice(0, 80),
      });
      transactions.push(transaction);
      console.log(`Created transaction ${index + 1}/${transactionCount}: ${transaction.reference}`);
    } catch (cause) {
      const partialResult = {
        requested: transactionCount,
        completed: transactions.length,
        failedAt: index + 1,
        references: transactions.map((transaction) => transaction.reference),
      };
      throw Object.assign(
        new Error(`Transaction history stopped at ${partialResult.failedAt}/${transactionCount}: ${cause instanceof Error ? cause.message : cause}`),
        { code: "AUTOMATION_PARTIAL_HISTORY", cause, partialResult },
      );
    }
  }

  return transactions;
}

export async function generateTraffic(page, {
  baseUrl = DEFAULT_BASE_URL,
  visits = 1,
}) {
  const visitCount = Number.parseInt(String(visits), 10);
  if (!Number.isInteger(visitCount) || visitCount < 0 || visitCount > 500) {
    throw new Error("Traffic must be an integer between 0 and 500 visits.");
  }

  const routes = ["/dashboard", "/accounts", "/activity", "/cards", "/settings"];
  const results = [];
  for (let index = 0; index < visitCount; index += 1) {
    const route = routes[index % routes.length];
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#main-content", { timeout: 10_000 });
    results.push({ visit: index + 1, route, status: response?.status() ?? null });
    await delay(250);
  }
  return results;
}

export async function runAutomation(options = {}) {
  const validated = validateAutomationOptions(options);
  const { action, baseUrl } = validated;
  const health = await preflightServer(baseUrl, options.fetchImplementation);
  assertAutomationFixtureTarget({
    storageKind: health.storage,
    allowMutations: validated.allowDatabaseMutations,
    databaseUrl: validated.automationDatabaseUrl,
    runtimeDatabaseUrl: validated.runtimeDatabaseUrl,
  });
  console.log(`Preflight passed: ${baseUrl} is healthy with ${health.storage} storage.`);

  if (action === "create-account-ledger") {
    if (health.storage !== "postgres") throw new Error("The dated account-ledger action requires PostgreSQL storage.");
    const ledger = await createAccountLedgerFixture({ email: validated.email, allowMutations: validated.allowDatabaseMutations, databaseUrl: validated.automationDatabaseUrl, runtimeDatabaseUrl: validated.runtimeDatabaseUrl });
    console.log(`Created ${ledger.transactionCount} dated ledger entries for ${ledger.customer}.`);
    return { action, ledger };
  }

  let fixtures;
  if (action !== "create-account") {
    const requiredBalanceCents = action === "create-backend-history"
      ? Math.max(1, Math.round(validated.balanceReserve * 100))
      : Math.round((validated.transactionCount * validated.transferAmount + validated.balanceReserve) * 100);
    fixtures = await ensureAutomationFixtures({
      storageKind: health.storage,
      email: validated.email,
      requiredBalanceCents,
      allowMutations: validated.allowDatabaseMutations,
      databaseUrl: validated.automationDatabaseUrl,
      runtimeDatabaseUrl: validated.runtimeDatabaseUrl,
      sqlitePath: validated.sqlitePath,
    });
    console.log(`Fixture preflight passed: $${fixtures.availableBalance.toFixed(2)} available; account created=${fixtures.createdAccount}; beneficiary created=${fixtures.createdBeneficiary}; balance added=$${fixtures.balanceAdded.toFixed(2)}.`);
  }

  if (action === "create-backend-history") {
    const transactions = await generateBackendTransactionHistory({
      storageKind: health.storage,
      accountId: fixtures.accountId,
      count: validated.transactionCount,
      amountCents: Math.round(validated.transferAmount * 100),
      note: validated.note,
      allowMutations: validated.allowDatabaseMutations,
      databaseUrl: validated.automationDatabaseUrl,
      runtimeDatabaseUrl: validated.runtimeDatabaseUrl,
      sqlitePath: validated.sqlitePath,
    });
    console.log(`Generated ${transactions.length} backend transaction history entries for account ${fixtures.accountId}.`);
    for (const transaction of transactions) console.log(`${transaction.createdAt} ${transaction.direction} $${transaction.amount.toFixed(2)} ${transaction.reference}`);
    return { action, fixtures, transactions };
  }

  const browser = await puppeteer.launch({
    executablePath: findChromeExecutable(),
    headless: options.headless === true,
    defaultViewport: options.headless === true ? { width: 1440, height: 1000 } : null,
    args: options.headless === true ? ["--no-sandbox", "--disable-setuid-sandbox"] : ["--start-maximized"],
  });

  try {
    const [page] = await browser.pages();
    page.setDefaultTimeout(15_000);
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) console.warn(`[browser:${message.type()}] ${message.text()}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) console.warn(`[browser:http] ${response.status()} ${response.url()}`);
    });

    if (action === "create-account") {
      const account = await createOrOpenAccount(page, {
        baseUrl,
        email: validated.email,
        password: validated.password,
        firstName: validated.firstName,
        lastName: validated.lastName,
        mode: "create",
      });
      console.log("Account created:", account);
      return { action, account };
    }

    const account = await createOrOpenAccount(page, {
      baseUrl,
      email: validated.email,
      password: validated.password,
      mode: "open",
    });
    console.log("Account opened:", account);
    const transactions = await createTransactionHistory(page, {
      baseUrl,
      count: validated.transactionCount,
      amount: validated.transferAmount,
      note: validated.note,
    });
    console.log(`Created ${transactions.length} transaction history entries.`);
    return { action, account, fixtures, transactions };
  } finally {
    if (options.keepOpen) {
      console.log("Browser left open. Close it manually when finished.");
    } else {
      await browser.close();
    }
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  dotenv.config({ path: path.resolve(import.meta.dirname, "../.env"), quiet: true });
  const args = parseArguments(process.argv.slice(2));
  const hasActionArgument = args.action !== undefined || args.mode !== undefined;
  const environmentOptions = {
    allowDatabaseMutations: process.env.AUTOMATION_DATABASE_MUTATIONS === "true",
    automationDatabaseUrl: process.env.AUTOMATION_DATABASE_URL,
    runtimeDatabaseUrl: process.env.DATABASE_URL,
    sqlitePath: process.env.CLIPX_DATABASE_PATH,
    balanceReserve: args["balance-reserve"] ?? process.env.AUTOMATION_BALANCE_RESERVE,
    headless: args.headless === true || args.headless === "true",
  };
  const optionsPromise = hasActionArgument
    ? Promise.resolve().then(() => {
      if (args.password !== undefined) {
        throw new Error("--password is disabled because command-line arguments can leak. Set CLIPX_AUTOMATION_PASSWORD instead.");
      }
      return {
        ...environmentOptions,
        action: normalizeAction(args.action || args.mode),
        baseUrl: args["base-url"],
        firstName: args["first-name"],
        lastName: args["last-name"],
        email: args.email,
        password: process.env.CLIPX_AUTOMATION_PASSWORD,
        transactionCount: args["transaction-count"],
        transferAmount: args["transfer-amount"],
        note: args.note,
        keepOpen: args["keep-open"] === true || args["keep-open"] === "true",
        confirmed: args.yes === true || args.yes === "true" ? true : undefined,
      };
    })
    : promptForAutomationOptions().then((options) => ({ ...options, ...environmentOptions }));

  optionsPromise.then(async (options) => {
    const confirmed = options.confirmed === undefined
      ? await confirmFlagOptions(options)
      : options.confirmed;
    if (!confirmed) {
      console.log("Automation cancelled in the terminal. No changes were made.");
      return undefined;
    }
    return runAutomation(options);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    if (error?.partialResult) {
      console.error(`Completed: ${error.partialResult.completed}/${error.partialResult.requested}`);
      console.error(`Failed at: ${error.partialResult.failedAt}`);
      console.error(`Created references: ${error.partialResult.references.length ? error.partialResult.references.join(", ") : "none"}`);
    }
    process.exitCode = 1;
  });
}
