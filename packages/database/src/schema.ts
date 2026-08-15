import { index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull().default(""),
  profileImageUrl: text("profile_image_url"),
  isAdmin: integer("is_admin").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const localCredentials = pgTable("local_credentials", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["checking", "savings"] }).notNull(),
  maskedNumber: text("masked_number").notNull(),
  currency: text("currency").notNull().default("USD"),
  balanceCents: integer("balance_cents").notNull(),
  availableBalanceCents: integer("available_balance_cents").notNull(),
  interestRateBps: integer("interest_rate_bps"),
}, (table) => [index("accounts_user_idx").on(table.userId)]);

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  direction: text("direction", { enum: ["credit", "debit"] }).notNull(),
  status: text("status", { enum: ["completed", "pending", "failed"] }).notNull(),
  reference: text("reference").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("transactions_account_date_idx").on(table.accountId, table.createdAt)]);

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  holderName: text("holder_name").notNull(),
  lastFour: text("last_four").notNull(),
  network: text("network").notNull().default("Visa"),
  type: text("type", { enum: ["physical", "virtual"] }).notNull(),
  status: text("status", { enum: ["active", "frozen"] }).notNull(),
  spendingLimitCents: integer("spending_limit_cents").notNull(),
  expires: text("expires").notNull(),
});

export const beneficiaries = pgTable("beneficiaries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bankName: text("bank_name").notNull(),
  maskedAccount: text("masked_account").notNull(),
  initials: text("initials").notNull(),
}, (table) => [index("beneficiaries_user_idx").on(table.userId)]);

export const cashFlow = pgTable("cash_flow", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  sortOrder: integer("sort_order").notNull(),
  incomeCents: integer("income_cents").notNull(),
  spendingCents: integer("spending_cents").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.month] })]);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  transactionAlerts: integer("transaction_alerts").notNull().default(1),
  monthlySummary: integer("monthly_summary").notNull().default(1),
  showBalances: integer("show_balances").notNull().default(1),
});
