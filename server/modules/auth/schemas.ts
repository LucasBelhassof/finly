import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must have at least 8 characters.")
  .max(72, "Password must have at most 72 characters.");

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Reset token is required."),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(100, "Name must have at most 100 characters."),
    email: z.string().trim().email("Enter a valid email."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Password confirmation is required."),
    rememberMe: z.boolean().optional().default(false),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const bootstrapAuthSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: passwordSchema,
  name: z.string().trim().min(1).default("Usuário"),
  userId: z.number().int().positive().optional(),
});
