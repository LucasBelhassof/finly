import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(1, "Informe sua senha."),
  rememberMe: z.boolean().default(false),
});

export const signupFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(100, "O nome pode ter no maximo 100 caracteres."),
    email: z.string().trim().email("Informe um e-mail valido."),
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72, "A senha pode ter no maximo 72 caracteres."),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
    rememberMe: z.boolean().default(false),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
});

export const resetPasswordFormSchema = z
  .object({
    token: z.string().trim().min(1, "Token invalido."),
    newPassword: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a nova senha."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type SignupFormValues = z.infer<typeof signupFormSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
