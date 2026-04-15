export interface AuthUser {
  id: number | string;
  name: string;
  email: string;
  emailVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  role?: "user" | "admin";
  status?: "active" | "inactive" | "suspended";
  isPremium?: boolean;
  premiumSince?: string | null;
}

export interface AuthSessionPayload {
  user: AuthUser;
  accessToken: string;
  expiresAt: string;
}

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

export type AuthStatus = "loading" | "authenticated" | "anonymous";
