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

type MockCategory = {
  id: string;
  slug: string;
  label: string;
  transactionType: "income" | "expense";
  icon: string;
  color: string;
  groupLabel: string;
  groupColor: string;
  isSystem?: boolean;
};

type MockBank = {
  id: string;
  name: string;
  accountType: "bank_account" | "credit_card" | "cash";
  color: string;
  currentBalance: number;
  creditLimit: number | null;
  parentBankConnectionId: string | null;
  statementCloseDay: number | null;
  statementDueDay: number | null;
  notifyInvoiceClosed: boolean;
  notifyInvoiceDueSoon: boolean;
  invoiceDueReminderDays: number;
};

type MockTransaction = {
  id: string;
  description: string;
  amount: number;
  occurredOn: string;
  bankConnectionId: string;
  categoryId: string;
  isRecurring: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function buildIncompleteUser(): MockUser {
  return {
    id: 201,
    name: "Lucas Fluxo",
    email: "lucas.fluxo@finly.app",
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
  };
}

function buildSessionPayload(user: MockUser) {
  return {
    user,
    accessToken: "transactions-e2e-token",
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

async function mockTransactionsFlowApi(page: Page) {
  const user = buildIncompleteUser();
  const categories: MockCategory[] = [
    {
      id: "income-salary",
      slug: "salary",
      label: "Salário",
      transactionType: "income",
      icon: "Wallet",
      color: "bg-emerald-500",
      groupLabel: "Salário",
      groupColor: "bg-emerald-500",
      isSystem: true,
    },
    {
      id: "expense-shopping",
      slug: "shopping",
      label: "Compras",
      transactionType: "expense",
      icon: "Wallet",
      color: "bg-rose-500",
      groupLabel: "Compras",
      groupColor: "bg-rose-500",
      isSystem: true,
    },
  ];
  const banks: MockBank[] = [];
  const transactions: MockTransaction[] = [];
  let nextBankId = 1;
  let nextTransactionId = 1;

  const today = new Date().toISOString().slice(0, 10);

  function findCategory(categoryId: string) {
    return categories.find((item) => item.id === categoryId) ?? categories[0];
  }

  function findBank(bankId: string) {
    return banks.find((item) => item.id === bankId);
  }

  function toApiCategory(category: MockCategory) {
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      transactionType: category.transactionType,
      icon: category.icon,
      color: category.color,
      groupLabel: category.groupLabel,
      groupColor: category.groupColor,
      isSystem: category.isSystem ?? true,
    };
  }

  function toApiBank(bank: MockBank) {
    return {
      id: bank.id,
      slug: `${bank.accountType}-${bank.id}`,
      name: bank.name,
      accountType: bank.accountType,
      parentBankConnectionId: bank.parentBankConnectionId,
      parentAccountName: bank.parentBankConnectionId ? (findBank(bank.parentBankConnectionId)?.name ?? null) : null,
      statementCloseDay: bank.statementCloseDay,
      statementDueDay: bank.statementDueDay,
      notifyInvoiceClosed: bank.notifyInvoiceClosed,
      notifyInvoiceDueSoon: bank.notifyInvoiceDueSoon,
      invoiceDueReminderDays: bank.invoiceDueReminderDays,
      connected: true,
      color: bank.color,
      currentBalance: bank.currentBalance,
      formattedBalance: formatCurrency(bank.currentBalance),
      creditLimit: bank.creditLimit,
      formattedCreditLimit: bank.creditLimit == null ? null : formatCurrency(bank.creditLimit),
    };
  }

  function toApiTransaction(transaction: MockTransaction) {
    const category = findCategory(transaction.categoryId);
    const bank = findBank(transaction.bankConnectionId);

    if (!bank) {
      throw new Error(`Missing bank ${transaction.bankConnectionId} for transaction ${transaction.id}`);
    }

    return {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      formattedAmount: formatCurrency(transaction.amount),
      occurredOn: transaction.occurredOn,
      relativeDate: transaction.occurredOn === today ? "Hoje" : transaction.occurredOn,
      isRecurring: transaction.isRecurring,
      isRecurringProjection: false,
      sourceTransactionId: transaction.id,
      housingId: null,
      isInstallment: false,
      installmentPurchaseId: null,
      installmentNumber: null,
      installmentCount: null,
      purchaseOccurredOn: null,
      category: {
        id: category.id,
        slug: category.slug,
        label: category.label,
        icon: category.icon,
        color: category.color,
      },
      account: {
        id: bank.id,
        slug: `${bank.accountType}-${bank.id}`,
        name: bank.name,
        accountType: bank.accountType,
        color: bank.color,
      },
    };
  }

  function buildSpendingItems() {
    const expenseTransactions = transactions.filter((item) => item.amount < 0);
    const totalExpenses = expenseTransactions.reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const grouped = new Map<string, { label: string; color: string; total: number }>();

    expenseTransactions.forEach((transaction) => {
      const category = findCategory(transaction.categoryId);
      const current = grouped.get(category.id);
      grouped.set(category.id, {
        label: category.groupLabel,
        color: category.groupColor,
        total: (current?.total ?? 0) + Math.abs(transaction.amount),
      });
    });

    return Array.from(grouped.entries()).map(([id, item]) => ({
      slug: id,
      label: item.label,
      color: item.color,
      total: item.total,
      formattedTotal: formatCurrency(item.total),
      percentage: totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0,
    }));
  }

  function buildDashboardSummaryCards() {
    const totalIncome = transactions.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = transactions
      .filter((item) => item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const balance = totalIncome - totalExpenses;

    return [
      {
        label: "Receitas",
        value: totalIncome,
        formattedValue: formatCurrency(totalIncome),
        change: "+0%",
        positive: true,
        description: "comparado ao mês anterior",
      },
      {
        label: "Despesas",
        value: totalExpenses,
        formattedValue: formatCurrency(totalExpenses),
        change: "+0%",
        positive: false,
        description: "comparado ao mês anterior",
      },
      {
        label: "Saldo acumulado",
        value: balance,
        formattedValue: formatCurrency(balance),
        change: "+0%",
        positive: balance >= 0,
        description: "comparado ao mês anterior",
      },
    ];
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname === "/api/auth/refresh" && request.method() === "POST") {
      await fulfillJson(route, 200, buildSessionPayload(user));
      return;
    }

    if (pathname === "/api/auth/onboarding" && request.method() === "PATCH") {
      const body = request.postDataJSON() as MockUser["onboardingProgress"];
      user.onboardingProgress = body;

      await fulfillJson(route, 200, {
        user,
      });
      return;
    }

    if (pathname === "/api/banks" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        banks: banks.map(toApiBank),
      });
      return;
    }

    if (pathname === "/api/banks" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        name: string;
        accountType: MockBank["accountType"];
        currentBalance: number;
        color: string;
        creditLimit: number | null;
        parentBankConnectionId: string | null;
        statementCloseDay: number | null;
        statementDueDay: number | null;
        notifyInvoiceClosed: boolean;
        notifyInvoiceDueSoon: boolean;
        invoiceDueReminderDays: number;
      };

      const bank: MockBank = {
        id: String(nextBankId++),
        name: body.name,
        accountType: body.accountType,
        color: body.color,
        currentBalance: body.currentBalance,
        creditLimit: body.creditLimit,
        parentBankConnectionId: body.parentBankConnectionId,
        statementCloseDay: body.statementCloseDay,
        statementDueDay: body.statementDueDay,
        notifyInvoiceClosed: body.notifyInvoiceClosed,
        notifyInvoiceDueSoon: body.notifyInvoiceDueSoon,
        invoiceDueReminderDays: body.invoiceDueReminderDays,
      };

      banks.push(bank);

      await fulfillJson(route, 200, toApiBank(bank));
      return;
    }

    if (pathname === "/api/categories" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        categories: categories.map(toApiCategory),
      });
      return;
    }

    if (pathname === "/api/transactions" && request.method() === "GET") {
      await fulfillJson(route, 200, {
        transactions: transactions.map(toApiTransaction),
      });
      return;
    }

    if (pathname === "/api/transactions" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        description: string;
        amount: number;
        occurredOn: string;
        bankConnectionId: string;
        categoryId?: string;
        isRecurring?: boolean;
      };
      const transaction: MockTransaction = {
        id: String(nextTransactionId++),
        description: body.description,
        amount: body.amount,
        occurredOn: body.occurredOn,
        bankConnectionId: String(body.bankConnectionId),
        categoryId: body.categoryId ?? "expense-shopping",
        isRecurring: Boolean(body.isRecurring),
      };

      transactions.push(transaction);

      await fulfillJson(route, 200, toApiTransaction(transaction));
      return;
    }

    if (pathname === "/api/dashboard" && request.method() === "GET") {
      const orderedTransactions = [...transactions]
        .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn))
        .map(toApiTransaction);

      await fulfillJson(route, 200, {
        user,
        summaryCards: buildDashboardSummaryCards(),
        recentTransactions: orderedTransactions.slice(0, 8),
        spendingByCategory: buildSpendingItems(),
        insights: [],
        banks: banks.map(toApiBank),
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

    throw new Error(`Unhandled API request in transactions smoke: ${request.method()} ${pathname}`);
  });
}

test("accounts, first transaction and dashboard make onboarding useful", async ({ page }) => {
  await mockTransactionsFlowApi(page);

  await page.goto("/primeiros-passos");
  await expect(page.getByRole("heading", { name: "Primeiros passos" })).toBeVisible();

  await page.getByRole("button", { name: "Criar conta ou cartão" }).click();
  await expect(page).toHaveURL(/\/accounts$/);

  await page.getByRole("button", { name: "Nova conta" }).click();
  await page.getByPlaceholder("Nome da conta ou cartão").fill("Conta principal");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Conta principal")).toBeVisible();

  await page.goto("/primeiros-passos");
  await expect(page.getByText("Próxima ação recomendada: Importar extrato ou fatura.")).toBeVisible();

  await page.getByRole("button", { name: "Criar transação" }).click();
  await expect(page).toHaveURL(/\/gestao-de-gastos\/transactions$/);

  await page.getByRole("button", { name: "Nova transação" }).click();
  const transactionDialog = page.getByRole("dialog");
  await transactionDialog.getByPlaceholder("Descrição").fill("Salário Maio");
  await transactionDialog.getByPlaceholder("Valor").fill("1200,00");

  await transactionDialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: "Conta principal" }).click();

  await transactionDialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Salário" }).click();

  await transactionDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Salário Maio")).toBeVisible();

  await page.goto("/primeiros-passos");
  await expect(page.getByText("Próxima ação recomendada: Conhecer Premium.")).toBeVisible();
  await expect(page.getByText("4/5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ver dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Ver dashboard" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Salário Maio")).toBeVisible();

  await page.goto("/primeiros-passos");
  await expect(page.getByText("Próxima ação recomendada: Conhecer Premium.")).toBeVisible();
});
