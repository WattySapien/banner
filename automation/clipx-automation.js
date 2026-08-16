import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const AUTOMATION_ACTIONS = new Set(["create-account", "create-transaction-history"]);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function createTerminal(input, output) {
  const readline = createInterface({ input, output });
  return {
    question: (message) => readline.question(message),
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

function validateLocalUrl(value) {
  const url = new URL(value);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Automation is restricted to the local ClipX server; received ${url.hostname}`);
  }
  return url.origin;
}

async function waitForPath(page, pathname) {
  await page.waitForFunction(
    (expectedPath) => window.location.pathname === expectedPath,
    { timeout: 15_000 },
    pathname,
  );
}

function normalizeAction(value) {
  if (value === "1" || value === "account" || value === "create") return "create-account";
  if (value === "2" || value === "transactions" || value === "history") return "create-transaction-history";
  return value;
}

function validatePositiveInteger(value, label, maximum) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return parsed;
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

async function askForAction(terminal) {
  terminal.write("\nClipX automation\n");
  terminal.write("  1) Create an account\n");
  terminal.write("  2) Create transaction history\n\n");

  while (true) {
    const action = normalizeAction((await terminal.question("Select an action (1 or 2): ")).trim().toLowerCase());
    if (AUTOMATION_ACTIONS.has(action)) return action;
    terminal.write("Enter 1 for account creation or 2 for transaction history creation.\n");
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
    const amount = Number(answer);
    if (Number.isFinite(amount) && amount > 0) return amount;
    terminal.write("Transfer amount must be a positive number.\n");
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
    const baseUrl = await askRequired(terminal, "Local ClipX URL", DEFAULT_BASE_URL);

    if (action === "create-account") {
      const firstName = await askRequired(terminal, "First name");
      const lastName = await askRequired(terminal, "Last name");
      const email = await askRequired(terminal, "Email");
      const password = await askRequired(terminal, "Password");
      let passwordConfirmation = await askRequired(terminal, "Confirm password");
      while (password !== passwordConfirmation) {
        terminal.write("Password confirmation does not match.\n");
        passwordConfirmation = await askRequired(terminal, "Confirm password");
      }

      terminal.write(`\nAccount: ${firstName} ${lastName} <${email}>\n`);
      const confirmed = await confirmInTerminal(terminal, "Create this account?");
      return { action, baseUrl, firstName, lastName, email, password, confirmed };
    }

    const email = await askRequired(terminal, "Existing account email", "automation@clipx.local");
    const password = await askRequired(terminal, "Password", "ClipXLocal123");
    const transactionCount = await askForInteger(terminal, "Number of transactions", 5, 50);
    const transferAmount = await askForPositiveAmount(terminal, 10);
    const note = (await terminal.question("Transaction note [Automation history entry]: ")).trim()
      || "Automation history entry";

    terminal.write(`\nCreate ${transactionCount} transaction(s) of $${transferAmount.toFixed(2)} for ${email}.\n`);
    const confirmed = await confirmInTerminal(terminal, "Create this transaction history?");
    return { action, baseUrl, email, password, transactionCount, transferAmount, note, confirmed };
  } finally {
    terminal.close();
  }
}

async function confirmFlagOptions(options, { input = process.stdin, output = process.stdout } = {}) {
  const terminal = createTerminal(input, output);

  try {
    terminal.write("\nClipX automation confirmation\n");
    if (options.action === "create-account") {
      terminal.write(`Create account: ${options.firstName || "(missing name)"} ${options.lastName || ""} <${options.email || "missing email"}>\n`);
      return confirmInTerminal(terminal, "Create this account?");
    }

    terminal.write(`Create ${options.transactionCount || 5} transaction(s) of $${Number(options.transferAmount || 10).toFixed(2)} for ${options.email || "(missing email)"}.\n`);
    return confirmInTerminal(terminal, "Create this transaction history?");
  } finally {
    terminal.close();
  }
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
  await page.waitForSelector("#email", { visible: true });
  await page.type("#email", email);
  await page.type("#password", password);

  if (mode === "create") {
    if (!firstName || !lastName) throw new Error("First and last name are required to create an account.");
    await page.type("#firstName", firstName);
    await page.type("#lastName", lastName);
    await page.type("#confirmPassword", password);
  }

  const submitLabel = mode === "create" ? "Create account" : "Sign in";
  await page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
    if (!(button instanceof HTMLButtonElement)) throw new Error(`${label} button was not found`);
    button.click();
  }, submitLabel);

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
  await page.waitForSelector("#source", { visible: true });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Saved recipient"));
    if (!(button instanceof HTMLButtonElement)) throw new Error("Saved recipient transfer option was not found");
    button.click();
  });
  await page.waitForSelector("fieldset button", { visible: true });
  await page.click("fieldset button");
  await page.type("#amount", numericAmount.toFixed(2));
  await page.type("#note", note.slice(0, 80));

  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Review and send"));
    if (!(button instanceof HTMLButtonElement)) throw new Error("Transfer button was not found");
    button.click();
  });

  await page.waitForFunction(
    () => document.body.textContent?.includes("Transfer complete"),
    { timeout: 15_000 },
  );
  const reference = await page.$eval(".font-mono.font-medium", (element) => element.textContent?.trim() ?? "");
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
    const transaction = await makeTransfer(page, {
      baseUrl,
      amount,
      note: `${note} ${index + 1}`.slice(0, 80),
    });
    transactions.push(transaction);
    console.log(`Created transaction ${index + 1}/${transactionCount}: ${transaction.reference}`);
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
  const action = normalizeAction(options.action || "create-account");
  if (!AUTOMATION_ACTIONS.has(action)) {
    throw new Error("Action must be 'create-account' or 'create-transaction-history'.");
  }
  const baseUrl = validateLocalUrl(options.baseUrl || DEFAULT_BASE_URL);
  if (!options.email || !options.password) throw new Error("Both email and password are required.");
  if (options.password.length < 8) throw new Error("Password must contain at least eight characters.");
  if (action === "create-account" && (!options.firstName || !options.lastName)) {
    throw new Error("First and last name are required to create an account.");
  }
  if (action === "create-transaction-history") {
    validatePositiveInteger(options.transactionCount ?? 5, "Transaction count", 50);
    const amount = Number(options.transferAmount ?? 10);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Transfer amount must be a positive number.");
  }
  const browser = await puppeteer.launch({
    executablePath: findChromeExecutable(),
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  try {
    const [page] = await browser.pages();
    page.setDefaultTimeout(15_000);
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) console.warn(`[browser:${message.type()}] ${message.text()}`);
    });

    if (action === "create-account") {
      const account = await createOrOpenAccount(page, {
        baseUrl,
        email: options.email,
        password: options.password,
        firstName: options.firstName,
        lastName: options.lastName,
        mode: "create",
      });
      console.log("Account created:", account);
      return { action, account };
    }

    const account = await createOrOpenAccount(page, {
      baseUrl,
      email: options.email,
      password: options.password,
      mode: "open",
    });
    console.log("Account opened:", account);
    const transactions = await createTransactionHistory(page, {
      baseUrl,
      count: options.transactionCount,
      amount: options.transferAmount,
      note: options.note,
    });
    console.log(`Created ${transactions.length} transaction history entries.`);
    return { action, account, transactions };
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
  const args = parseArguments(process.argv.slice(2));
  const hasActionArgument = args.action !== undefined || args.mode !== undefined;
  const optionsPromise = hasActionArgument
    ? Promise.resolve({
      action: normalizeAction(args.action || args.mode),
      baseUrl: args["base-url"],
      firstName: args["first-name"],
      lastName: args["last-name"],
      email: args.email,
      password: args.password,
      transactionCount: args["transaction-count"],
      transferAmount: args["transfer-amount"],
      note: args.note,
      keepOpen: args["keep-open"] === true || args["keep-open"] === "true",
      confirmed: args.yes === true || args.yes === "true" ? true : undefined,
    })
    : promptForAutomationOptions();

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
    process.exitCode = 1;
  });
}
