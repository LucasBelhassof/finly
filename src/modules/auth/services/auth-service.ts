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

async function authRequest<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

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
  });
}

export async function updateAccount(input: UpdateAccountInput) {
  return authRequest<{ user: AuthSessionPayload["user"] }>("/api/auth/account", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateContact(input: UpdateContactInput) {
  return authRequest<{ user: AuthSessionPayload["user"] }>("/api/auth/contact", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function changePassword(input: ChangePasswordInput) {
  return authRequest<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
