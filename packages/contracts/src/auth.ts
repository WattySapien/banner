import { z } from "zod";

export const localAuthSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const localSignupSchema = localAuthSchema.extend({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(""),
});

export type LocalAuthInput = z.infer<typeof localAuthSchema>;
export type LocalSignupInput = z.infer<typeof localSignupSchema>;
export type LocalAuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
};
