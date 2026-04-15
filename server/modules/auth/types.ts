export interface AuthUser {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  hasCompletedOnboarding: boolean;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended";
  isPremium: boolean;
  premiumSince: string | null;
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
