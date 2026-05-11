import { z } from "zod";

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, "A senha atual é obrigatória."),
});
