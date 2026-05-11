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

type MockBank = {
  id: string;
  name: string;
  accountType: "bank_account" | "credit_card" | "cash";
  color: string;
  currentBalance: number;
};

type MockTransaction = {
  id: string;
  description: string;
  amount: number;
  occurredOn: string;
  bankConnectionId: string;
  category: {
    id: string;
    slug: string;
    label: string;
    icon: string;
    color: string;
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function buildUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 301,
    name: "Lucas Admin",
    email: "lucas.admin@finly.app",
    role: "admin",
    status: "active",
    isPremium: true,
    hasCompletedOnboarding: true,
    onboardingProgress: {
      currentStep: 5,
      completedSteps: ["welcome"],
      skippedSteps: [],
      dismissed: false,
      actionChecklist: {
        completedSteps: ["accounts", "transactions", "categories", "dashboard", "premium"],
      },
    },
    ...overrides,
  };
}

function buildSessionPayload(user: MockUser) {
  return {
    user,
    accessToken: "admin-e2e-access-token",
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

async function mockAdminApi(
  page: Page,
  options: {
    user: MockUser;
    adminUsers?: Array<{
      id: number;
      name: string;
      email: string;
      role: "user" | "admin";
      status: "active" | "inactive" | "suspended";
      isPremium: boolean;
      createdAt: string;
      premiumSince: string | null;
      lastSessionAt: string | null;
      transactionCount: number;
      netTotal: number;
    }>;
    banks?: MockBank[];
    transactions?: MockTransaction[];
  },
) {
  const user = options.user;
  const adminUsers = options.adminUsers ?? [
    {
      id: 301,
      name: "Lucas Admin",
      email: "lucas.admin@finly.app",
      role: "admin" as const,
      status: "active" as const,
      isPremium: true,
      createdAt: "2026-05-01T12:00:00.000Z",
      premiumSince: "2026-05-01T12:00:00.000Z",
      lastSessionAt: "2026-05-10T15:30:00.000Z",
      transactionCount: 42,
      netTotal: 8450.9,
    },
    {
      id: 302,
      name: "Ana Usuario",
      email: "ana.user@finly.app",
      role: "user" as const,
      status: "active" as const,
      isPremium: false,
      createdAt: "2026-05-02T08:00:00.000Z",
      premiumSince: null,
      lastSessionAt: "2026-05-10T11:10:00.000Z",
      transactionCount: 9,
      netTotal: 1250.5,
    },
  ];
  const banks = options.banks ?? [
    {
      id: "bank-1",
      name: "Conta principal",
      accountType: "bank_account" as const,
      color: "bg-primary",
      currentBalance: 2400,
    },
  ];
  const transactions = options.transactions ?? [
    {
      id: "transaction-1",
      description: "Salario Maio",
      amount: 2400,
      occurredOn: "2026-05-10",
      bankConnectionId: "bank-1",
      category: {
        id: "income-salary",
        slug: "salary",
        label: "Salario",
        icon: "Wallet",
        color: "bg-emerald-500",
      },
    },
  ];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === "/api/auth/refresh" && request.method() === "POST") {
      await fulfillJson(route, 200, buildSessionPayload(user));
      return;
    }

    if (pathname === "/api/auth/onboarding" && request.method() === "PATCH") {
      await fulfillJson(route, 200, {
        user,
      });
      return;
    }

    if (pathname === "/api/admin/users" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        page: 1,
        pageSize: 20,
        total: adminUsers.length,
        users: adminUsers,
      });
      return;
    }

    if (pathname === "/api/banks" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        banks: banks.map((bank) => ({
          id: bank.id,
          slug: bank.id,
          name: bank.name,
          accountType: bank.accountType,
          parentBankConnectionId: null,
          parentAccountName: null,
          statementCloseDay: null,
          statementDueDay: null,
          notifyInvoiceClosed: false,
          notifyInvoiceDueSoon: false,
          invoiceDueReminderDays: 3,
          connected: true,
          color: bank.color,
          currentBalance: bank.currentBalance,
          formattedBalance: formatCurrency(bank.currentBalance),
          creditLimit: null,
          formattedCreditLimit: null,
        })),
      });
      return;
    }

    if (pathname === "/api/transactions" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        transactions: transactions.map((transaction) => ({
          id: transaction.id,
          description: transaction.description,
          amount: transaction.amount,
          formattedAmount: formatCurrency(transaction.amount),
          occurredOn: transaction.occurredOn,
          relativeDate: transaction.occurredOn,
          isRecurring: false,
          isRecurringProjection: false,
          sourceTransactionId: transaction.id,
          housingId: null,
          isInstallment: false,
          installmentPurchaseId: null,
          installmentNumber: null,
          installmentCount: null,
          purchaseOccurredOn: null,
          category: transaction.category,
          account: {
            id: transaction.bankConnectionId,
            slug: transaction.bankConnectionId,
            name: banks[0]?.name ?? "Conta principal",
            accountType: "bank_account",
            color: banks[0]?.color ?? "bg-primary",
          },
        })),
      });
      return;
    }

    if (pathname === "/api/dashboard" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        user,
        summaryCards: [
          {
            label: "Receitas",
            value: 2400,
            formattedValue: formatCurrency(2400),
            change: "+0%",
            positive: true,
            description: "comparado ao mês anterior",
          },
          {
            label: "Despesas",
            value: 0,
            formattedValue: formatCurrency(0),
            change: "+0%",
            positive: true,
            description: "comparado ao mês anterior",
          },
          {
            label: "Saldo acumulado",
            value: 2400,
            formattedValue: formatCurrency(2400),
            change: "+0%",
            positive: true,
            description: "comparado ao mês anterior",
          },
        ],
        recentTransactions: transactions.map((transaction) => ({
          id: transaction.id,
          description: transaction.description,
          amount: transaction.amount,
          formattedAmount: formatCurrency(transaction.amount),
          occurredOn: transaction.occurredOn,
          relativeDate: transaction.occurredOn,
          isRecurring: false,
          isRecurringProjection: false,
          sourceTransactionId: transaction.id,
          housingId: null,
          isInstallment: false,
          installmentPurchaseId: null,
          installmentNumber: null,
          installmentCount: null,
          purchaseOccurredOn: null,
          category: transaction.category,
          account: {
            id: transaction.bankConnectionId,
            slug: transaction.bankConnectionId,
            name: banks[0]?.name ?? "Conta principal",
            accountType: "bank_account",
            color: banks[0]?.color ?? "bg-primary",
          },
        })),
        spendingByCategory: [],
        insights: [],
        banks: banks.map((bank) => ({
          id: bank.id,
          slug: bank.id,
          name: bank.name,
          accountType: bank.accountType,
          parentBankConnectionId: null,
          parentAccountName: null,
          statementCloseDay: null,
          statementDueDay: null,
          notifyInvoiceClosed: false,
          notifyInvoiceDueSoon: false,
          invoiceDueReminderDays: 3,
          connected: true,
          color: bank.color,
          currentBalance: bank.currentBalance,
          formattedBalance: formatCurrency(bank.currentBalance),
          creditLimit: null,
          formattedCreditLimit: null,
        })),
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

    throw new Error(`Unhandled API request in admin smoke: ${request.method()} ${pathname}`);
  });
}

test.describe("admin smoke", () => {
  test("admin users can access /admin/users and see the users table", async ({ page }) => {
    await mockAdminApi(page, {
      user: buildUser(),
    });

    await page.goto("/admin/users");

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Base de usuarios", exact: true })).toBeVisible();
    const usersTable = page.getByRole("table");
    await expect(usersTable.getByText("Lucas Admin")).toBeVisible();
    await expect(usersTable.getByText("ana.user@finly.app")).toBeVisible();
  });

  test("non-admin users are redirected away from /admin/users", async ({ page }) => {
    await mockAdminApi(page, {
      user: buildUser({
        id: 303,
        name: "Lucas Regular",
        email: "lucas.regular@finly.app",
        role: "user",
        isPremium: false,
      }),
    });

    await page.goto("/admin/users");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Receitas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Últimas Transações", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Base de usuarios", exact: true })).toHaveCount(0);
  });
});
