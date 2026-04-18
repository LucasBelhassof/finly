import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { appRoutes } from "@/lib/routes";
import { AdminRoute } from "@/modules/auth/components/AdminRoute";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/modules/auth/components/PublicOnlyRoute";

const { useAuthContextMock, useBanksMock } = vi.hoisted(() => ({
  useAuthContextMock: vi.fn(),
  useBanksMock: vi.fn(),
}));

vi.mock("@/modules/auth/components/AuthProvider", () => ({
  useAuthContext: useAuthContextMock,
}));

vi.mock("@/hooks/use-banks", () => ({
  useBanks: useBanksMock,
}));

function renderProtectedRoute(initialPath = appRoutes.dashboard) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path={appRoutes.onboarding} element={<h1>Primeiros passos</h1>} />
          <Route path={appRoutes.dashboard} element={<h1>Area interna</h1>} />
        </Route>
        <Route path={appRoutes.login} element={<h1>Login</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPublicOnlyRoute(initialPath = appRoutes.login) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path={appRoutes.login} element={<h1>Login</h1>} />
        </Route>
        <Route path={appRoutes.onboarding} element={<h1>Primeiros passos</h1>} />
        <Route path={appRoutes.dashboard} element={<h1>Dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAdminRoute(initialPath = appRoutes.adminOverview) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path={appRoutes.adminOverview} element={<h1>Admin</h1>} />
        </Route>
        <Route path={appRoutes.dashboard} element={<h1>Dashboard</h1>} />
        <Route path={appRoutes.login} element={<h1>Login</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("auth route guards", () => {
  it("shows the application loader while bootstrapping the session", () => {
    useBanksMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useAuthContextMock.mockReturnValue({
      isAuthenticated: false,
      isBootstrapping: true,
    });

    renderProtectedRoute();

    expect(screen.getByText(/finly/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /area interna/i })).not.toBeInTheDocument();
  });

  it("redirects anonymous users from protected routes to login", async () => {
    useBanksMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useAuthContextMock.mockReturnValue({
      isAuthenticated: false,
      isBootstrapping: false,
    });

    renderProtectedRoute();

    expect(await screen.findByRole("heading", { name: /login/i })).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", async () => {
    useBanksMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        hasCompletedOnboarding: true,
      },
    });

    renderProtectedRoute();

    expect(await screen.findByRole("heading", { name: /area interna/i })).toBeInTheDocument();
  });

  it("redirects authenticated users away from public auth routes", async () => {
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        hasCompletedOnboarding: true,
      },
    });

    renderPublicOnlyRoute();

    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders public auth content for anonymous users", async () => {
    useAuthContextMock.mockReturnValue({
      isAuthenticated: false,
      isBootstrapping: false,
    });

    renderPublicOnlyRoute();

    expect(await screen.findByRole("heading", { name: /login/i })).toBeInTheDocument();
  });

  it("redirects non-admin users away from admin routes", async () => {
    useBanksMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        role: "user",
        hasCompletedOnboarding: true,
      },
    });

    renderAdminRoute();

    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders admin content for admin users", async () => {
    useBanksMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        role: "admin",
        hasCompletedOnboarding: true,
      },
    });

    renderAdminRoute();

    expect(await screen.findByRole("heading", { name: /admin/i })).toBeInTheDocument();
  });

  it("allows access to internal routes even when the product tour is still pending", async () => {
    useBanksMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        hasCompletedOnboarding: false,
      },
    });

    renderProtectedRoute();

    expect(await screen.findByRole("heading", { name: /area interna/i })).toBeInTheDocument();
  });

  it("keeps the compatibility onboarding route accessible while the product tour is pending", async () => {
    useBanksMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        hasCompletedOnboarding: false,
        onboardingProgress: {
          dismissed: true,
        },
      },
    });

    renderProtectedRoute(appRoutes.onboarding);

    expect(await screen.findByRole("heading", { name: /primeiros passos/i })).toBeInTheDocument();
  });

  it("redirects authenticated users with pending product tour away from login to dashboard", async () => {
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        hasCompletedOnboarding: false,
        onboardingProgress: {
          dismissed: false,
        },
      },
    });

    renderPublicOnlyRoute();

    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("redirects dismissed product tour users to dashboard from login", async () => {
    useAuthContextMock.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: {
        hasCompletedOnboarding: false,
        onboardingProgress: {
          dismissed: true,
        },
      },
    });

    renderPublicOnlyRoute();

    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});
