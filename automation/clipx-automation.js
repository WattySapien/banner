import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

export async function createOrOpenAccount(page, {
  baseUrl = DEFAULT_BASE_URL,
  email,
  password,
  mode = "create",
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
  const baseUrl = validateLocalUrl(options.baseUrl || DEFAULT_BASE_URL);
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

    const account = await createOrOpenAccount(page, {
      baseUrl,
      email: options.email || "automation@clipx.local",
      password: options.password || "ClipXLocal123",
      mode: options.mode || "create",
    });
    console.log("Account ready:", account);

    if (options.transferAmount !== undefined) {
      const transfer = await makeTransfer(page, { baseUrl, amount: options.transferAmount, note: options.note });
      console.log("Transfer complete:", transfer);
    }

    const traffic = await generateTraffic(page, { baseUrl, visits: options.traffic ?? 1 });
    console.log(`Generated ${traffic.length} local page visits.`);
    return { account, traffic };
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
  runAutomation({
    baseUrl: args["base-url"],
    email: args.email,
    password: args.password,
    mode: args.mode,
    traffic: args.traffic,
    transferAmount: args["transfer-amount"],
    note: args.note,
    keepOpen: args["keep-open"] === true || args["keep-open"] === "true",
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
