import { expect, test, type Page, type Route } from "@playwright/test";

type MockUser = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive" | "suspended";
  isPremium: boolean;
  hasCompletedOnboarding: boolean;
  onboardingProgress: {
    currentStep: number;
    completedSteps: string[];
    skippedSteps: string[];
    dismissed: boolean;
    actionChecklist: {
      completedSteps: string[];
    };
  };
};

function buildIncompleteUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 101,
    name: "Lucas Teste",
    email: "lucas.teste@finly.app",
    role: "user",
    status: "active",
    isPremium: false,
    hasCompletedOnboarding: false,
    onboardingProgress: {
      currentStep: 0,
      completedSteps: [],
      skippedSteps: [],
      dismissed: false,
      actionChecklist: {
        completedSteps: [],
      },
    },
    ...overrides,
  };
}

function buildSessionPayload(user: MockUser) {
  return {
    user,
    accessToken: "e2e-access-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockAuthOnboardingApi(
  page: Page,
  options: {
    authenticatedOnLoad?: boolean;
    user?: MockUser;
  } = {},
) {
  let currentUser = options.user ?? buildIncompleteUser();
  let isAuthenticated = Boolean(options.authenticatedOnLoad);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === "/api/auth/refresh" && request.method() === "POST") {
      if (!isAuthenticated) {
        await fulfillJson(route, 401, {
          error: "unauthorized",
          message: "Sessao expirada.",
        });
        return;
      }

      await fulfillJson(route, 200, buildSessionPayload(currentUser));
      return;
    }

    if (pathname === "/api/auth/signup" && request.method() === "POST") {
      const body = request.postDataJSON() as { email?: string; name?: string } | null;
      currentUser = buildIncompleteUser({
        email: body?.email ?? currentUser.email,
        name: body?.name ?? currentUser.name,
      });
      isAuthenticated = true;

      await fulfillJson(route, 201, buildSessionPayload(currentUser));
      return;
    }

    if (pathname === "/api/auth/login" && request.method() === "POST") {
      const body = request.postDataJSON() as { email?: string } | null;
      currentUser = buildIncompleteUser({
        email: body?.email ?? currentUser.email,
      });
      isAuthenticated = true;

      await fulfillJson(route, 200, buildSessionPayload(currentUser));
      return;
    }

    if (pathname === "/api/auth/onboarding" && request.method() === "PATCH") {
      const body = request.postDataJSON() as MockUser["onboardingProgress"];
      currentUser = {
        ...currentUser,
        onboardingProgress: body,
      };

      await fulfillJson(route, 200, {
        user: currentUser,
      });
      return;
    }

    if (pathname === "/api/banks" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        banks: [],
      });
      return;
    }

    if (pathname === "/api/transactions" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        transactions: [],
      });
      return;
    }

    if (pathname === "/api/categories" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        categories: [],
      });
      return;
    }

    if (pathname === "/api/dashboard" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        user: currentUser,
        summaryCards: [],
        recentTransactions: [],
        spendingByCategory: [],
        insights: [],
        banks: [],
        chatMessages: [],
      });
      return;
    }

    if (pathname === "/api/notifications" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        unreadCount: 0,
        notifications: [],
      });
      return;
    }

    throw new Error(`Unhandled API request in auth onboarding smoke: ${request.method()} ${pathname}`);
  });
}

test.describe("auth and onboarding smoke", () => {
  test("signup sends new users directly to primeiros passos", async ({ page }) => {
    await mockAuthOnboardingApi(page);

    await page.goto("/signup");

    await page.locator('input[name="name"]').fill("Lucas Teste");
    await page.locator('input[name="email"]').fill("lucas.signup@finly.app");
    await page.locator('input[name="password"]').fill("senha1234");
    await page.locator('input[name="confirmPassword"]').fill("senha1234");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page).toHaveURL(/\/primeiros-passos$/);
    await expect(page.getByRole("heading", { name: "Primeiros passos" })).toBeVisible();
  });

  test("incomplete users who log in are guided to primeiros passos", async ({ page }) => {
    await mockAuthOnboardingApi(page);

    await page.goto("/login");

    await page.locator('input[name="email"]').fill("lucas.login@finly.app");
    await page.locator('input[name="password"]').fill("senha1234");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/primeiros-passos$/);
    await expect(page.getByRole("heading", { name: "Primeiros passos" })).toBeVisible();
  });

  test("authenticated incomplete users can leave onboarding and still access pricing", async ({ page }) => {
    await mockAuthOnboardingApi(page, {
      authenticatedOnLoad: true,
    });

    await page.goto("/primeiros-passos");
    await expect(page.getByRole("heading", { name: "Primeiros passos" })).toBeVisible();

    await page.getByRole("button", { name: "Conhecer Premium" }).first().click();

    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { name: "Escolha o plano ideal para você" })).toBeVisible();
  });
});
