export type OnboardingStepId =
  | "dashboard_summary"
  | "dashboard_transactions"
  | "dashboard_insights"
  | "dashboard_accounts"
  | "accounts_summary"
  | "accounts_structure"
  | "accounts_support"
  | "transactions_filters"
  | "transactions_summary"
  | "transactions_table"
  | "transactions_categories"
  | "recurring_income_filters"
  | "recurring_income_summary"
  | "recurring_income_chart"
  | "recurring_income_table"
  | "installments_summary"
  | "installments_filters"
  | "installments_insights"
  | "installments_table"
  | "housing_filters"
  | "housing_summary"
  | "housing_trend"
  | "housing_table"
  | "expense_metrics_filters"
  | "expense_metrics_summary"
  | "expense_metrics_trend"
  | "expense_metrics_ranking"
  | "insights_summary"
  | "insights_recommendations"
  | "insights_spending"
  | "notifications_filters"
  | "notifications_inbox"
  | "notifications_details"
  | "notifications_form"
  | "chat_conversation"
  | "chat_suggestions"
  | "profile_identity"
  | "profile_account"
  | "profile_shortcuts"
  | "settings_account"
  | "settings_security"
  | "settings_contact"
  | "settings_preferences";

export type ActionOnboardingStepId = "dashboard" | "premium";

export interface AuthActionOnboardingProgress {
  completedSteps: ActionOnboardingStepId[];
}

export interface AuthOnboardingProgress {
  currentStep: number;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  dismissed: boolean;
  actionChecklist?: AuthActionOnboardingProgress;
}

export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  emailVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  onboardingProgress?: AuthOnboardingProgress;
  role?: "user" | "admin";
  status?: "active" | "inactive" | "suspended";
  isPremium?: boolean;
  premiumSince?: string | null;
  phone?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
}

export interface AuthSessionPayload {
  user: AuthUser;
  accessToken: string;
  expiresAt: string;
}

export type UpdateOnboardingProgressInput = AuthOnboardingProgress;

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ForgotPasswordResult {
  message: string;
  debugResetUrl?: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateAccountInput {
  name: string;
  email: string;
  confirmEmail: string;
}

export interface UpdateContactInput {
  phone?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";
