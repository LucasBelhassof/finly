import { ApiError, apiBaseUrl } from "@/lib/api";
import type {
  ChangePasswordInput,
  AuthSessionPayload,
  ForgotPasswordInput,
  ForgotPasswordResult,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  UpdateAccountInput,
  UpdateContactInput,
  UpdateOnboardingProgressInput,
} from "@/modules/auth/types/auth-types";

type AuthServiceConfig = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure: () => void | Promise<void>;
};

const defaultAuthServiceConfig: AuthServiceConfig = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
  onAuthFailure: () => undefined,
};

let authServiceConfig: AuthServiceConfig = defaultAuthServiceConfig;

export function configureAuthService(config: AuthServiceConfig) {
  authServiceConfig = config;
}

function buildUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

async function parseResponseBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      message: text,
    };
  }
}

function getErrorMessage(body: Record<string, unknown> | null, fallback: string) {
  if (typeof body?.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (typeof body?.error === "string" && body.error.trim()) {
    return body.error;
  }

  return fallback;
}

type AuthRequestOptions = {
  allowRefreshRetry?: boolean;
  requiresAccessToken?: boolean;
};

async function authRequest<T>(path: string, init?: RequestInit, options: AuthRequestOptions = {}) {
  const headers = new Headers(init?.headers);
  const requiresAccessToken = options.requiresAccessToken ?? false;

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (requiresAccessToken) {
    const accessToken = authServiceConfig.getAccessToken();

    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && requiresAccessToken && options.allowRefreshRetry !== false) {
    const refreshedAccessToken = await authServiceConfig.refreshAccessToken();

    if (refreshedAccessToken) {
      return authRequest<T>(path, init, {
        ...options,
        allowRefreshRetry: false,
      });
    }

    await authServiceConfig.onAuthFailure();
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(body, "Nao foi possivel concluir a autenticacao."), response.status);
  }

  return body as T;
}

export async function login(input: LoginInput) {
  return authRequest<AuthSessionPayload>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function signup(input: SignupInput) {
  return authRequest<AuthSessionPayload>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function refreshSession() {
  return authRequest<AuthSessionPayload>("/api/auth/refresh", {
    method: "POST",
  });
}

export async function logout() {
  await authRequest<null>("/api/auth/logout", {
    method: "POST",
  });
}

export async function forgotPassword(input: ForgotPasswordInput) {
  return authRequest<ForgotPasswordResult>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  return authRequest<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOnboardingProgress(input: UpdateOnboardingProgressInput) {
  return authRequest<{ user: AuthSessionPayload["user"] }>("/api/auth/onboarding", {
    method: "PATCH",
    body: JSON.stringify(input),
  }, { requiresAccessToken: true });
}

export const updateProductTourProgress = updateOnboardingProgress;

export async function updateAccount(input: UpdateAccountInput) {
  return authRequest<{ user: AuthSessionPayload["user"] }>("/api/auth/account", {
    method: "PATCH",
    body: JSON.stringify(input),
  }, { requiresAccessToken: true });
}

export async function updateContact(input: UpdateContactInput) {
  return authRequest<{ user: AuthSessionPayload["user"] }>("/api/auth/contact", {
    method: "PATCH",
    body: JSON.stringify(input),
  }, { requiresAccessToken: true });
}

export async function changePassword(input: ChangePasswordInput) {
  return authRequest<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  }, { requiresAccessToken: true });
}
