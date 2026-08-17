import { z } from "zod";

export const supportMessageInputSchema = z.object({
  body: z.string().trim().min(1, "Enter a message").max(2_000, "Messages must contain at most 2,000 characters"),
});

export type SupportSenderRole = "customer" | "admin";

export type SupportMessage = {
  id: string;
  customerUserId: string;
  senderUserId: string;
  senderRole: SupportSenderRole;
  senderName: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type SupportMessageInput = z.infer<typeof supportMessageInputSchema>;
