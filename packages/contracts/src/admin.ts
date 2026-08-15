import { z } from "zod";
import type { BankTransaction } from "./banking";
import type { Account, BankCard } from "./banking";
import type { UserPreferences } from "./settings";

export const updateAdminUserSchema = z.object({
  email: z.string().trim().email().optional(),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  isActive: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one user update");

export const createAdminCustomerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(""),
  isActive: z.boolean().default(true),
  isAdmin: z.boolean().default(false),
  account: z.object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(["checking", "savings"]),
    maskedNumber: z.string().regex(/^\d{4}$/, "Enter the final four account digits"),
    openingBalance: z.coerce.number().min(0).max(10_000_000),
  }).optional(),
});

export type UpdateAdminUser = z.infer<typeof updateAdminUserSchema>;
export type CreateAdminCustomer = z.infer<typeof createAdminCustomerSchema>;

export type AdminStats = {
  totalCustomers: number;
  activeCustomers: number;
  managedBalance: number;
  processedVolume: number;
  pendingTransactions: number;
  systemStatus: "operational" | "degraded";
};

export type AdminCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  initials: string;
  isAdmin: boolean;
  isActive: boolean;
  balance: number;
  createdAt: string;
  lastActiveAt: string;
};

export type AdminTransaction = BankTransaction & {
  customerId: string;
  customerName: string;
  risk: "standard" | "review";
};

export type AdminCustomerDetails = {
  customer: AdminCustomer;
  accounts: Account[];
  cards: BankCard[];
  transactions: AdminTransaction[];
  preferences: UserPreferences;
};
