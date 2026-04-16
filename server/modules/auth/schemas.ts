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
  name: z.string().trim().min(1).default("Usuario"),
  userId: z.number().int().positive().optional(),
});

const onboardingStepSchema = z.enum(["profile", "account", "due_dates", "dashboard"]);

export const onboardingProgressSchema = z.object({
  currentStep: z.number().int().min(0).max(3),
  completedSteps: z.array(onboardingStepSchema).default([]),
  skippedSteps: z.array(onboardingStepSchema).default([]),
  dismissed: z.boolean().default(false),
});

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(100, "Name must have at most 100 characters."),
    email: z.string().trim().email("Enter a valid email."),
    confirmEmail: z.string().trim().email("Enter a valid email."),
  })
  .refine((value) => value.email === value.confirmEmail, {
    message: "Emails do not match.",
    path: ["confirmEmail"],
  });

const optionalTrimmedText = z.string().trim().max(255).optional().nullable().transform((value) => {
  if (value == null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
});

export const updateContactSchema = z.object({
  phone: optionalTrimmedText,
  addressStreet: optionalTrimmedText,
  addressNumber: optionalTrimmedText,
  addressComplement: optionalTrimmedText,
  addressNeighborhood: optionalTrimmedText,
  addressCity: optionalTrimmedText,
  addressState: z
    .string()
    .trim()
    .max(2)
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) {
        return null;
      }

      const normalizedValue = value.trim().toUpperCase();
      return normalizedValue ? normalizedValue : null;
    }),
  addressPostalCode: z
    .string()
    .trim()
    .max(9)
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) {
        return null;
      }

      const digits = value.replace(/\D/g, "").slice(0, 8);
      return digits ? digits : null;
    }),
  addressCountry: optionalTrimmedText,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
