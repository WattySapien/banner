import { z } from "zod";

export const accountNumberSchema = z.string().regex(/^\d{10}$/, "Enter a valid 10-digit account number");

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["checking", "savings"]),
  accountNumber: accountNumberSchema.optional(),
  maskedNumber: z.string(),
  currency: z.literal("USD"),
  balance: z.number(),
  availableBalance: z.number(),
  interestRate: z.number().optional(),
});

export const bankTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  description: z.string(),
  merchant: z.string(),
  category: z.enum(["income", "transfer", "housing", "groceries", "transport", "utilities", "dining", "shopping"]),
  amount: z.number().positive(),
  direction: z.enum(["credit", "debit"]),
  status: z.enum(["completed", "pending", "failed"]),
  reference: z.string(),
  createdAt: z.string().datetime(),
});

export const transactionDetailsSchema = bankTransactionSchema.omit({ accountId: true }).extend({
  accountName: z.string(),
  accountType: z.enum(["checking", "savings"]),
  accountMaskedNumber: z.string(),
  transferKind: z.enum(["standard", "between_accounts", "account_number"]),
});

export const bankCardSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  holderName: z.string(),
  lastFour: z.string().length(4),
  network: z.literal("Visa"),
  type: z.enum(["physical", "virtual"]),
  status: z.enum(["active", "frozen"]),
  spendingLimit: z.number().positive(),
  expires: z.string(),
  hasSecureDetails: z.boolean(),
  issuedAt: z.string().datetime(),
});

export const cardDetailsSchema = z.object({
  cardId: z.string(),
  number: z.string().regex(/^4\d{15}$/),
  securityCode: z.string().regex(/^\d{3}$/),
  expires: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  revealExpiresAt: z.string().datetime(),
});

export const notificationSchema = z.object({
  id: z.string(),
  type: z.literal("card_issued"),
  title: z.string(),
  message: z.string(),
  resourceId: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});

export const beneficiarySchema = z.object({
  id: z.string(),
  name: z.string(),
  bankName: z.string(),
  maskedAccount: z.string(),
  initials: z.string().min(1).max(3),
});

const transferAmountSchema = z.coerce.number().min(0.01).max(50_000).refine(
  (value) => Number(value.toFixed(2)) === value,
  "Enter an amount with no more than two decimal places",
);

export const createTransferSchema = z.object({
  sourceAccountId: z.string(),
  beneficiaryId: z.string(),
  amount: transferAmountSchema,
  note: z.string().trim().max(80).optional().default("Bank transfer"),
});

export const createInternalTransferSchema = z.object({
  sourceAccountId: z.string().min(1),
  destinationAccountId: z.string().min(1),
  amount: transferAmountSchema,
  note: z.string().trim().max(80).optional().default("Transfer between accounts"),
}).refine((value) => value.sourceAccountId !== value.destinationAccountId, {
  message: "Choose two different accounts",
  path: ["destinationAccountId"],
});

export const internalTransferReceiptSchema = z.object({
  id: z.string(),
  sourceAccountId: z.string(),
  sourceAccountName: z.string(),
  destinationAccountId: z.string(),
  destinationAccountName: z.string(),
  amount: z.number().positive(),
  note: z.string(),
  reference: z.string(),
  createdAt: z.string().datetime(),
});

export const peerRecipientSchema = z.object({
  accountNumber: accountNumberSchema,
  accountName: z.string(),
  recipientName: z.string(),
});

export const createPeerTransferSchema = z.object({
  sourceAccountId: z.string().min(1),
  recipientAccountNumber: accountNumberSchema,
  amount: transferAmountSchema,
  note: z.string().trim().max(80).optional().default("Account number transfer"),
});

export const peerTransferReceiptSchema = z.object({
  id: z.string(),
  sourceAccountId: z.string(),
  sourceAccountName: z.string(),
  recipientAccountNumber: accountNumberSchema,
  destinationAccountName: z.string(),
  recipientName: z.string(),
  amount: z.number().positive(),
  note: z.string(),
  reference: z.string(),
  createdAt: z.string().datetime(),
});

export const updateCardSchema = z.object({
  status: z.enum(["active", "frozen"]).optional(),
  spendingLimit: z.coerce.number().min(100).max(25_000).optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one card update");

export type Account = z.infer<typeof accountSchema>;
export type BankTransaction = z.infer<typeof bankTransactionSchema>;
export type TransactionDetails = z.infer<typeof transactionDetailsSchema>;
export type BankCard = z.infer<typeof bankCardSchema>;
export type CardDetails = z.infer<typeof cardDetailsSchema>;
export type AppNotification = z.infer<typeof notificationSchema>;
export type Beneficiary = z.infer<typeof beneficiarySchema>;
export type CreateTransfer = z.infer<typeof createTransferSchema>;
export type CreateInternalTransfer = z.infer<typeof createInternalTransferSchema>;
export type InternalTransferReceipt = z.infer<typeof internalTransferReceiptSchema>;
export type PeerRecipient = z.infer<typeof peerRecipientSchema>;
export type CreatePeerTransfer = z.infer<typeof createPeerTransferSchema>;
export type PeerTransferReceipt = z.infer<typeof peerTransferReceiptSchema>;
export type UpdateCard = z.infer<typeof updateCardSchema>;

export type BankingOverview = {
  totalBalance: number;
  availableBalance: number;
  monthlyIncome: number;
  monthlySpending: number;
  accounts: Account[];
  cashFlow: Array<{ month: string; income: number; spending: number }>;
};
