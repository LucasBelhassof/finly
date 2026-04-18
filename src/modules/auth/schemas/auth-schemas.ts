import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(1, "Informe sua senha."),
  rememberMe: z.boolean().default(true),
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

export const settingsAccountFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(100, "O nome pode ter no maximo 100 caracteres."),
    email: z.string().trim().email("Informe um e-mail valido."),
    confirmEmail: z.string().trim().email("Confirme um e-mail valido."),
  })
  .refine((value) => value.email === value.confirmEmail, {
    message: "Os e-mails precisam ser iguais.",
    path: ["confirmEmail"],
  });

export const settingsPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres.").max(72, "A senha pode ter no maximo 72 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a nova senha."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "A nova senha precisa ser diferente da atual.",
    path: ["newPassword"],
  });

const optionalTrimmedField = z
  .string()
  .trim()
  .max(120, "Campo muito longo.")
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) {
      return "";
    }

    return value.trim();
  });

export const settingsContactFormSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value == null ? "" : value.trim()))
      .refine((value) => {
        if (!value) {
          return true;
        }

        const digits = value.replace(/\D/g, "");
        return digits.length === 10 || digits.length === 11;
      }, "Informe um telefone valido com DDD."),
    addressStreet: optionalTrimmedField,
    addressNumber: z
      .string()
      .trim()
      .max(20, "O numero pode ter no maximo 20 caracteres.")
      .optional()
      .nullable()
      .transform((value) => (value == null ? "" : value.trim())),
    addressComplement: optionalTrimmedField,
    addressNeighborhood: optionalTrimmedField,
    addressCity: optionalTrimmedField,
    addressState: z
      .string()
      .trim()
      .max(2, "Use a sigla do estado.")
      .optional()
      .nullable()
      .transform((value) => (value == null ? "" : value.trim().toUpperCase())),
    addressPostalCode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value == null ? "" : value.trim()))
      .refine((value) => {
        if (!value) {
          return true;
        }

        return value.replace(/\D/g, "").length === 8;
      }, "Informe um CEP valido."),
    addressCountry: z
      .string()
      .trim()
      .max(60, "O pais pode ter no maximo 60 caracteres.")
      .optional()
      .nullable()
      .transform((value) => (value == null ? "" : value.trim())),
  })
  .superRefine((value, context) => {
    const hasAnyAddressField = Boolean(
      value.addressStreet ||
        value.addressNumber ||
        value.addressComplement ||
        value.addressNeighborhood ||
        value.addressCity ||
        value.addressState ||
        value.addressPostalCode ||
        value.addressCountry,
    );

    if (!hasAnyAddressField) {
      return;
    }

    if (!value.addressStreet) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a rua.",
        path: ["addressStreet"],
      });
    }

    if (!value.addressNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o numero.",
        path: ["addressNumber"],
      });
    }

    if (!value.addressCity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a cidade.",
        path: ["addressCity"],
      });
    }

    if (!value.addressState || value.addressState.length !== 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a UF com 2 letras.",
        path: ["addressState"],
      });
    }

    if (!value.addressPostalCode || value.addressPostalCode.replace(/\D/g, "").length !== 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe um CEP valido.",
        path: ["addressPostalCode"],
      });
    }
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type SignupFormValues = z.infer<typeof signupFormSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
export type SettingsAccountFormValues = z.infer<typeof settingsAccountFormSchema>;
export type SettingsPasswordFormValues = z.infer<typeof settingsPasswordFormSchema>;
export type SettingsContactFormValues = z.infer<typeof settingsContactFormSchema>;
