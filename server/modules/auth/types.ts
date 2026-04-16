export type OnboardingStepId = "profile" | "account" | "due_dates" | "dashboard";

export interface AuthOnboardingProgress {
  currentStep: number;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  dismissed: boolean;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  hasCompletedOnboarding: boolean;
  onboardingProgress: AuthOnboardingProgress;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended";
  isPremium: boolean;
  premiumSince: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
}

export interface RequestAuthContext {
  userId: number;
  user: AuthUser;
}

export interface AuthSessionResult {
  user: AuthUser;
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  rememberMe: boolean;
}
