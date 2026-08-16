import { z } from "zod";

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["checking", "savings"]),
  accountNumber: z.string().regex(/^\d{10}$/).optional(),
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
});

export const beneficiarySchema = z.object({
  id: z.string(),
  name: z.string(),
  bankName: z.string(),
  maskedAccount: z.string(),
  initials: z.string().min(1).max(3),
});

export const createTransferSchema = z.object({
  sourceAccountId: z.string(),
  beneficiaryId: z.string(),
  amount: z.coerce.number().positive().max(50_000),
  note: z.string().trim().max(80).optional().default("Bank transfer"),
});

export const updateCardSchema = z.object({
  status: z.enum(["active", "frozen"]).optional(),
  spendingLimit: z.coerce.number().min(100).max(25_000).optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one card update");

export type Account = z.infer<typeof accountSchema>;
export type BankTransaction = z.infer<typeof bankTransactionSchema>;
export type BankCard = z.infer<typeof bankCardSchema>;
export type Beneficiary = z.infer<typeof beneficiarySchema>;
export type CreateTransfer = z.infer<typeof createTransferSchema>;
export type UpdateCard = z.infer<typeof updateCardSchema>;

export type BankingOverview = {
  totalBalance: number;
  availableBalance: number;
  monthlyIncome: number;
  monthlySpending: number;
  accounts: Account[];
  cashFlow: Array<{ month: string; income: number; spending: number }>;
};
