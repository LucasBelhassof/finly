export type OnboardingStepId =
  | "dashboard_overview"
  | "recent_transactions"
  | "insights"
  | "accounts_nav"
  | "expense_management_nav"
  | "notifications";

export interface AuthOnboardingProgress {
  currentStep: number;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  dismissed: boolean;
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
