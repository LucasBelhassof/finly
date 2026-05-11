import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appRoutes } from "@/lib/routes";
import type { AuthSessionPayload, LoginInput, SignupInput } from "@/modules/auth/types/auth-types";

const mockNavigate = vi.fn();
const applySessionMock = vi.fn();
const loginMock = vi.fn<(...args: unknown[]) => Promise<AuthSessionPayload>>();
const signupMock = vi.fn<(...args: unknown[]) => Promise<AuthSessionPayload>>();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/modules/auth/components/AuthProvider", () => ({
  useAuthContext: () => ({
    applySession: applySessionMock,
  }),
}));

vi.mock("@/modules/auth/services/auth-service", () => ({
  login: (...args: unknown[]) => loginMock(...args),
  signup: (...args: unknown[]) => signupMock(...args),
}));

import { useLogin } from "@/modules/auth/hooks/use-login";
import { useSignup } from "@/modules/auth/hooks/use-signup";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const sessionPayload: AuthSessionPayload = {
  accessToken: "token-123",
  expiresAt: "2026-05-11T18:00:00.000Z",
  user: {
    id: 1,
    name: "Lucas",
    email: "lucas@example.com",
    role: "user",
  },
};

describe("auth navigation hooks", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps login redirecting to the dashboard after the session is applied", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(3400);
    loginMock.mockResolvedValue(sessionPayload);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: "lucas@example.com",
        password: "senha-segura",
        rememberMe: true,
      } satisfies LoginInput);
    });

    expect(applySessionMock).toHaveBeenCalledWith(sessionPayload);
    expect(mockNavigate).toHaveBeenCalledWith(appRoutes.dashboard, { replace: true });
  });

  it("sends new signups directly to primeiros passos", async () => {
    signupMock.mockResolvedValue(sessionPayload);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useSignup(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: "Lucas",
        email: "lucas@example.com",
        password: "senha-segura",
        confirmPassword: "senha-segura",
        rememberMe: true,
      } satisfies SignupInput);
    });

    expect(applySessionMock).toHaveBeenCalledWith(sessionPayload);
    expect(mockNavigate).toHaveBeenCalledWith(appRoutes.onboarding, { replace: true });
  });
});
