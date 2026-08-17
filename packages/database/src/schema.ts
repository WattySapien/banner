import { customType, index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

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

export const userAvatars = pgTable("user_avatars", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  imageData: bytea("image_data").notNull(),
  byteSize: integer("byte_size").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["checking", "savings"] }).notNull(),
  accountNumber: text("account_number").unique(),
  maskedNumber: text("masked_number").notNull(),
  currency: text("currency").notNull().default("USD"),
  balanceCents: integer("balance_cents").notNull(),
  availableBalanceCents: integer("available_balance_cents").notNull(),
  interestRateBps: integer("interest_rate_bps"),
}, (table) => [index("accounts_user_idx").on(table.userId)]);

export const internalTransfers = pgTable("internal_transfers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceAccountId: text("source_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  destinationAccountId: text("destination_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  note: text("note").notNull(),
  reference: text("reference").notNull().unique(),
  status: text("status", { enum: ["completed"] }).notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("internal_transfers_user_created_idx").on(table.userId, table.createdAt)]);

export const peerTransfers = pgTable("peer_transfers", {
  id: text("id").primaryKey(),
  senderUserId: text("sender_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  sourceAccountId: text("source_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  recipientUserId: text("recipient_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  destinationAccountId: text("destination_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  note: text("note").notNull(),
  reference: text("reference").notNull().unique(),
  status: text("status", { enum: ["completed"] }).notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("peer_transfers_sender_created_idx").on(table.senderUserId, table.createdAt), index("peer_transfers_recipient_created_idx").on(table.recipientUserId, table.createdAt)]);

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  internalTransferId: text("internal_transfer_id").references(() => internalTransfers.id, { onDelete: "set null" }),
  peerTransferId: text("peer_transfer_id").references(() => peerTransfers.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  direction: text("direction", { enum: ["credit", "debit"] }).notNull(),
  status: text("status", { enum: ["completed", "pending", "failed"] }).notNull(),
  reference: text("reference").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("transactions_account_date_idx").on(table.accountId, table.createdAt), index("transactions_internal_transfer_idx").on(table.internalTransferId), index("transactions_peer_transfer_idx").on(table.peerTransferId)]);

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  holderName: text("holder_name").notNull(),
  lastFour: text("last_four").notNull(),
  network: text("network").notNull().default("Mastercard"),
  type: text("type", { enum: ["physical", "virtual"] }).notNull(),
  status: text("status", { enum: ["active", "frozen"] }).notNull(),
  spendingLimitCents: integer("spending_limit_cents").notNull(),
  expires: text("expires").notNull(),
  panCiphertext: text("pan_ciphertext"),
  panIv: text("pan_iv"),
  panAuthTag: text("pan_auth_tag"),
  panFingerprint: text("pan_fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["card_issued", "support_message"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  resourceId: text("resource_id"),
  isRead: integer("is_read").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("notifications_user_created_idx").on(table.userId, table.createdAt)]);

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

export const supportMessages = pgTable("support_messages", {
  id: text("id").primaryKey(),
  customerUserId: text("customer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderUserId: text("sender_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  senderRole: text("sender_role", { enum: ["customer", "admin"] }).notNull(),
  body: text("body").notNull(),
  readByCustomer: integer("read_by_customer").notNull().default(0),
  readByAdmin: integer("read_by_admin").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("support_messages_customer_created_idx").on(table.customerUserId, table.createdAt)]);
