import { randomInt, randomUUID } from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";
import postgres from "postgres";

const FIXTURE_BENEFICIARY = {
  name: "Automation Recipient",
  bankName: "Ardenvia Bank Test Bank",
  maskedAccount: "4242",
  initials: "AR",
};

const HISTORY_TEMPLATES = [
  { merchant: "Northstar Market", category: "shopping", direction: "debit" },
  { merchant: "Cityline Transit", category: "transport", direction: "debit" },
  { merchant: "Brightwave Payroll", category: "income", direction: "credit" },
  { merchant: "Harbor Utilities", category: "utilities", direction: "debit" },
  { merchant: "Cornerstone Coffee", category: "dining", direction: "debit" },
];

function assertFixtureAccess({ allowMutations, nodeEnv }) {
  if (!allowMutations) {
    throw new Error("Automation database mutations are disabled. Set AUTOMATION_DATABASE_MUTATIONS=true only for a dedicated development or test database.");
  }
  if (nodeEnv === "production") {
    throw new Error("Automation fixtures are disabled when NODE_ENV=production.");
  }
}

function assertRequiredBalance(requiredBalanceCents) {
  if (!Number.isSafeInteger(requiredBalanceCents) || requiredBalanceCents < 1) {
    throw new Error("Required fixture balance must be a positive integer number of cents.");
  }
}

function normalizeDatabaseUrl(value) {
  const url = new URL(value);
  url.password = "";
  return url.toString();
}

function assertMatchingDatabaseUrls(databaseUrl, runtimeDatabaseUrl) {
  if (!databaseUrl) throw new Error("AUTOMATION_DATABASE_URL is required for PostgreSQL automation fixtures.");
  if (!runtimeDatabaseUrl) {
    throw new Error("DATABASE_URL must be available so automation can verify that fixtures target the API database.");
  }
  if (normalizeDatabaseUrl(databaseUrl) !== normalizeDatabaseUrl(runtimeDatabaseUrl)) {
    throw new Error("AUTOMATION_DATABASE_URL must target the same user, host, port, and database as DATABASE_URL.");
  }
}

export function assertAutomationFixtureTarget({
  storageKind,
  allowMutations = false,
  nodeEnv = process.env.NODE_ENV,
  databaseUrl = process.env.AUTOMATION_DATABASE_URL,
  runtimeDatabaseUrl = process.env.DATABASE_URL,
}) {
  assertFixtureAccess({ allowMutations, nodeEnv });
  if (storageKind === "postgres") assertMatchingDatabaseUrls(databaseUrl, runtimeDatabaseUrl);
  else if (storageKind !== "sqlite") throw new Error(`Unsupported automation storage: ${storageKind || "unknown"}.`);
}

function fixtureResult({ accountId, beneficiaryId, createdAccount, createdBeneficiary, balanceAddedCents, availableBalanceCents }) {
  return {
    accountId,
    beneficiaryId,
    createdAccount,
    createdBeneficiary,
    balanceAdded: balanceAddedCents / 100,
    availableBalance: availableBalanceCents / 100,
  };
}

function buildHistoryEntries({ accountId, count, amountCents, note }) {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const template = HISTORY_TEMPLATES[index % HISTORY_TEMPLATES.length];
    const variation = 80 + randomInt(0, 41);
    return {
      id: randomUUID(),
      accountId,
      description: `${note} ${index + 1}`.slice(0, 80),
      merchant: template.merchant,
      category: template.category,
      amountCents: Math.max(1, Math.round(amountCents * variation / 100)),
      direction: template.direction,
      status: "completed",
      reference: `HST-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      createdAt: new Date(now - (index + 1) * 86_400_000).toISOString(),
    };
  });
}

export async function generateBackendTransactionHistory({
  storageKind,
  accountId,
  count,
  amountCents,
  note = "Generated account history",
  allowMutations = false,
  nodeEnv = process.env.NODE_ENV,
  databaseUrl = process.env.AUTOMATION_DATABASE_URL,
  runtimeDatabaseUrl = process.env.DATABASE_URL,
  sqlitePath = process.env.CLIPX_DATABASE_PATH || path.resolve(process.cwd(), "clipx.db"),
}) {
  assertAutomationFixtureTarget({ storageKind, allowMutations, nodeEnv, databaseUrl, runtimeDatabaseUrl });
  if (!accountId) throw new Error("An account ID is required for backend history generation.");
  if (!Number.isSafeInteger(count) || count < 1 || count > 50) throw new Error("Backend history count must be between 1 and 50.");
  assertRequiredBalance(amountCents);
  const entries = buildHistoryEntries({ accountId, count, amountCents, note });

  if (storageKind === "postgres") {
    const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });
    try {
      await sql.begin(async (tx) => {
        const [account] = await tx`SELECT id FROM accounts WHERE id=${accountId} FOR UPDATE`;
        if (!account) throw new Error(`Account ${accountId} was not found in the automation database.`);
        for (const entry of entries) {
          await tx`
            INSERT INTO transactions (id,account_id,description,merchant,category,amount_cents,direction,status,reference,created_at)
            VALUES (${entry.id},${entry.accountId},${entry.description},${entry.merchant},${entry.category},${entry.amountCents},${entry.direction},${entry.status},${entry.reference},${entry.createdAt})
          `;
        }
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
  } else if (storageKind === "sqlite") {
    const database = new Database(sqlitePath);
    database.pragma("foreign_keys = ON");
    try {
      const insert = database.prepare("INSERT INTO transactions (id,account_id,description,merchant,category,amount_cents,direction,status,reference,created_at) VALUES (@id,@accountId,@description,@merchant,@category,@amountCents,@direction,@status,@reference,@createdAt)");
      database.transaction(() => {
        if (!database.prepare("SELECT 1 FROM accounts WHERE id=?").get(accountId)) throw new Error(`Account ${accountId} was not found in the automation database.`);
        for (const entry of entries) insert.run(entry);
      })();
    } finally {
      database.close();
    }
  }

  return entries.map((entry) => ({
    reference: entry.reference,
    amount: entry.amountCents / 100,
    direction: entry.direction,
    createdAt: entry.createdAt,
  }));
}

export async function createAccountLedgerFixture({
  email,
  checkingSuffix = "0936",
  savingsSuffix = "6354",
  allowMutations = false,
  nodeEnv = process.env.NODE_ENV,
  databaseUrl = process.env.AUTOMATION_DATABASE_URL,
  runtimeDatabaseUrl = process.env.DATABASE_URL,
}) {
  assertAutomationFixtureTarget({ storageKind: "postgres", allowMutations, nodeEnv, databaseUrl, runtimeDatabaseUrl });
  const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });
  const monthlyAmounts = [42000,47000,52000,57000,62000,67000,72000,77000,74000,69000,64000,59000,54000,49000,44000,41000,46000,51000,56000,61000,66000,71000,76000,70000];
  const outgoing = [125000,155000,135000,165000,145000];
  try {
    return await sql.begin(async (tx) => {
      const [user] = await tx`SELECT id,first_name,last_name,is_active FROM users WHERE lower(email)=lower(${email}) FOR UPDATE`;
      if (!user) throw new Error(`No account exists for ${email}. Create the account first.`);
      if (!Number(user.is_active)) throw new Error(`The account for ${email} is suspended.`);
      const holderName = `${user.first_name} ${user.last_name}`.trim();
      const suffixes = [checkingSuffix, savingsSuffix];
      const accounts = [];
      for (const [index, suffix] of suffixes.entries()) {
        if (!/^\d{4}$/.test(suffix)) throw new Error("Account suffixes must contain four digits.");
        const type = index === 0 ? "checking" : "savings";
        let [account] = await tx`SELECT id,account_number,balance_cents FROM accounts WHERE user_id=${user.id} AND type=${type} ORDER BY id LIMIT 1 FOR UPDATE`;
        if (!account) {
          const accountNumber = `${String(randomInt(100000, 999999))}${suffix}`;
          [account] = await tx`INSERT INTO accounts (id,user_id,name,type,account_number,masked_number,currency,balance_cents,available_balance_cents) VALUES (${randomUUID()},${user.id},${holderName},${type},${accountNumber},${suffix},'USD',0,0) RETURNING id,account_number,balance_cents`;
        } else if (account.account_number && !String(account.account_number).endsWith(suffix)) {
          throw new Error(`Existing ${type} account already has a different account number.`);
        }
        accounts.push(account);
      }
      const checking = accounts[0];
      const entries = [];
      for (let index = 0; index < monthlyAmounts.length; index += 1) {
        const month = new Date(Date.UTC(2023, 1 + index, 23));
        entries.push({ amount: monthlyAmounts[index], direction: "credit", category: "income", merchant: "Ardenvia Payroll", description: "Monthly inflow", date: month });
      }
      const outgoingDates = [new Date(Date.UTC(2023, 5, 14)), new Date(Date.UTC(2023, 10, 18)), new Date(Date.UTC(2024, 2, 12)), new Date(Date.UTC(2024, 6, 16)), new Date(Date.UTC(2024, 10, 20))];
      outgoing.forEach((amount, index) => entries.push({ amount, direction: "debit", category: "transfer", merchant: "Strategic payment", description: "Scheduled outgoing payment", date: outgoingDates[index] }));
      for (const entry of entries) {
        const reference = `FIX-${randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
        await tx`INSERT INTO transactions (id,account_id,description,merchant,category,amount_cents,direction,status,reference,created_at) VALUES (${randomUUID()},${checking.id},${entry.description},${entry.merchant},${entry.category},${Math.round(entry.amount * 100)},${entry.direction},'completed',${reference},${entry.date.toISOString()})`;
      }
      const balanceCents = entries.reduce((total, entry) => total + (entry.direction === "credit" ? entry.amount : -entry.amount) * 100, 0);
      await tx`UPDATE accounts SET balance_cents=${balanceCents},available_balance_cents=${balanceCents} WHERE id=${checking.id}`;
      return { email, customer: holderName, accounts: accounts.map((account, index) => ({ type: index === 0 ? "checking" : "savings", accountNumber: account.account_number, finalFour: suffixes[index] })), monthlyInflows: monthlyAmounts, outgoing, transactionCount: entries.length, checkingBalance: balanceCents / 100 };
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function ensurePostgresFixtures({ email, requiredBalanceCents, databaseUrl }) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    return await sql.begin(async (tx) => {
      const [user] = await tx`SELECT id,first_name,last_name,is_active FROM users WHERE lower(email)=lower(${email}) FOR UPDATE`;
      if (!user) throw new Error(`No account exists for ${email}. Create the customer before generating transaction history.`);
      if (!Number(user.is_active)) throw new Error(`The account for ${email} is suspended.`);

      const holderName = `${user.first_name} ${user.last_name}`.trim();
      let [account] = await tx`
        SELECT id,available_balance_cents
        FROM accounts
        WHERE user_id=${user.id}
        ORDER BY CASE WHEN type='checking' THEN 0 ELSE 1 END,id
        LIMIT 1
        FOR UPDATE
      `;
      let createdAccount = false;
      if (!account) {
        account = {
          id: randomUUID(),
          available_balance_cents: requiredBalanceCents,
        };
        await tx`
          INSERT INTO accounts (id,user_id,name,type,masked_number,balance_cents,available_balance_cents)
          VALUES (${account.id},${user.id},${holderName},'checking',${randomInt(0, 10_000).toString().padStart(4, "0")},${requiredBalanceCents},${requiredBalanceCents})
        `;
        createdAccount = true;
      }

      const currentAvailable = Number(account.available_balance_cents);
      const balanceAddedCents = Math.max(0, requiredBalanceCents - currentAvailable);
      if (balanceAddedCents > 0) {
        await tx`
          UPDATE accounts
          SET balance_cents=balance_cents+${balanceAddedCents},available_balance_cents=available_balance_cents+${balanceAddedCents}
          WHERE id=${account.id}
        `;
      }

      let [beneficiary] = await tx`
        SELECT id FROM beneficiaries WHERE user_id=${user.id} ORDER BY name,id LIMIT 1
      `;
      let createdBeneficiary = false;
      if (!beneficiary) {
        beneficiary = { id: randomUUID() };
        await tx`
          INSERT INTO beneficiaries (id,user_id,name,bank_name,masked_account,initials)
          VALUES (${beneficiary.id},${user.id},${FIXTURE_BENEFICIARY.name},${FIXTURE_BENEFICIARY.bankName},${FIXTURE_BENEFICIARY.maskedAccount},${FIXTURE_BENEFICIARY.initials})
        `;
        createdBeneficiary = true;
      }

      return fixtureResult({
        accountId: account.id,
        beneficiaryId: beneficiary.id,
        createdAccount,
        createdBeneficiary,
        balanceAddedCents,
        availableBalanceCents: currentAvailable + balanceAddedCents,
      });
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function ensureSqliteFixtures({ email, requiredBalanceCents, sqlitePath }) {
  const database = new Database(sqlitePath);
  database.pragma("foreign_keys = ON");
  try {
    const provision = database.transaction(() => {
      const user = database.prepare("SELECT id,first_name,last_name,is_active FROM users WHERE lower(email)=lower(?)").get(email);
      if (!user) throw new Error(`No account exists for ${email}. Create the customer before generating transaction history.`);
      if (!Number(user.is_active)) throw new Error(`The account for ${email} is suspended.`);

      let account = database.prepare("SELECT id,available_balance_cents FROM accounts WHERE user_id=? ORDER BY CASE WHEN type='checking' THEN 0 ELSE 1 END,id LIMIT 1").get(user.id);
      let createdAccount = false;
      if (!account) {
        account = { id: randomUUID(), available_balance_cents: requiredBalanceCents };
        database.prepare("INSERT INTO accounts (id,user_id,name,type,masked_number,currency,balance_cents,available_balance_cents,interest_rate_bps) VALUES (?,?,?,?,?,'USD',?,?,NULL)")
          .run(account.id, user.id, `${user.first_name} ${user.last_name}`.trim(), "checking", randomInt(0, 10_000).toString().padStart(4, "0"), requiredBalanceCents, requiredBalanceCents);
        createdAccount = true;
      }

      const currentAvailable = Number(account.available_balance_cents);
      const balanceAddedCents = Math.max(0, requiredBalanceCents - currentAvailable);
      if (balanceAddedCents > 0) {
        database.prepare("UPDATE accounts SET balance_cents=balance_cents+?,available_balance_cents=available_balance_cents+? WHERE id=?")
          .run(balanceAddedCents, balanceAddedCents, account.id);
      }

      let beneficiary = database.prepare("SELECT id FROM beneficiaries WHERE user_id=? ORDER BY name,id LIMIT 1").get(user.id);
      let createdBeneficiary = false;
      if (!beneficiary) {
        beneficiary = { id: randomUUID() };
        database.prepare("INSERT INTO beneficiaries (id,user_id,name,bank_name,masked_account,initials) VALUES (?,?,?,?,?,?)")
          .run(beneficiary.id, user.id, FIXTURE_BENEFICIARY.name, FIXTURE_BENEFICIARY.bankName, FIXTURE_BENEFICIARY.maskedAccount, FIXTURE_BENEFICIARY.initials);
        createdBeneficiary = true;
      }

      return fixtureResult({
        accountId: account.id,
        beneficiaryId: beneficiary.id,
        createdAccount,
        createdBeneficiary,
        balanceAddedCents,
        availableBalanceCents: currentAvailable + balanceAddedCents,
      });
    });
    return provision();
  } finally {
    database.close();
  }
}

export async function ensureAutomationFixtures({
  storageKind,
  email,
  requiredBalanceCents,
  allowMutations = false,
  nodeEnv = process.env.NODE_ENV,
  databaseUrl = process.env.AUTOMATION_DATABASE_URL,
  runtimeDatabaseUrl = process.env.DATABASE_URL,
  sqlitePath = process.env.CLIPX_DATABASE_PATH || path.resolve(process.cwd(), "clipx.db"),
}) {
  assertAutomationFixtureTarget({ storageKind, allowMutations, nodeEnv, databaseUrl, runtimeDatabaseUrl });
  assertRequiredBalance(requiredBalanceCents);
  if (storageKind === "postgres") {
    return ensurePostgresFixtures({ email, requiredBalanceCents, databaseUrl });
  }
  if (storageKind === "sqlite") return ensureSqliteFixtures({ email, requiredBalanceCents, sqlitePath });
}
