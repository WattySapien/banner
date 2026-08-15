import { z } from "zod";

export const localAuthSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export type LocalAuthInput = z.infer<typeof localAuthSchema>;
export type LocalAuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
};
