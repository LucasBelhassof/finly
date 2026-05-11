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

const onboardingStepSchema = z.enum([
  "dashboard_summary",
  "dashboard_transactions",
  "dashboard_insights",
  "dashboard_accounts",
  "accounts_summary",
  "accounts_structure",
  "accounts_support",
  "transactions_filters",
  "transactions_summary",
  "transactions_table",
  "transactions_categories",
  "recurring_income_filters",
  "recurring_income_summary",
  "recurring_income_chart",
  "recurring_income_table",
  "installments_summary",
  "installments_filters",
  "installments_insights",
  "installments_table",
  "housing_filters",
  "housing_summary",
  "housing_trend",
  "housing_table",
  "expense_metrics_filters",
  "expense_metrics_summary",
  "expense_metrics_trend",
  "expense_metrics_ranking",
  "insights_summary",
  "insights_recommendations",
  "insights_spending",
  "notifications_filters",
  "notifications_inbox",
  "notifications_details",
  "notifications_form",
  "chat_conversation",
  "chat_suggestions",
  "profile_identity",
  "profile_account",
  "profile_shortcuts",
  "settings_account",
  "settings_security",
  "settings_contact",
  "settings_preferences",
]);

const actionOnboardingStepSchema = z.enum(["dashboard", "premium"]);

export const onboardingProgressSchema = z.object({
  currentStep: z.number().int().min(0).max(42),
  completedSteps: z.array(onboardingStepSchema).default([]),
  skippedSteps: z.array(onboardingStepSchema).default([]),
  dismissed: z.boolean().default(false),
  actionChecklist: z
    .object({
      completedSteps: z.array(actionOnboardingStepSchema).default([]),
    })
    .optional(),
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

const optionalTrimmedText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((value) => {
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
