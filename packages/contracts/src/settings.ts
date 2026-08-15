import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
});

export const updatePreferencesSchema = z.object({
  transactionAlerts: z.boolean().optional(),
  monthlySummary: z.boolean().optional(),
  showBalances: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one preference");

export const changePasswordSchema=z.object({
  currentPassword:z.string().min(8),
  newPassword:z.string().min(12).max(128),
}).refine((value)=>value.currentPassword!==value.newPassword,"Choose a new password");

export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UserPreferences = {
  transactionAlerts: boolean;
  monthlySummary: boolean;
  showBalances: boolean;
};
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type AccountSettings = {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
  };
  preferences: UserPreferences;
};
