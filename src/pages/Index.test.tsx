import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";
import { getCurrentMonthSelection, resolveMonthYearRange } from "@/lib/transactions-date-filter";
import type { BankItem, SummaryCard, TransactionItem } from "@/types/api";

const mockCompleteActionStep = vi.fn();
const mockUseDashboard = vi.fn();
const mockUseTransactions = vi.fn();
const mockSetSearchParams = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams] as const,
  };
});

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboard: (...args: unknown[]) => mockUseDashboard(...args),
}));

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: (...args: unknown[]) => mockUseTransactions(...args),
}));

vi.mock("@/hooks/use-url-period-filter", () => ({
  useUrlPeriodFilter: () => ({
    selectedMonthIndex: 3,
    selectedYear: 2026,
    datePreset: "month" as const,
    dateRange: { startDate: "2026-04-01", endDate: "2026-04-30" },
    handleMonthChange: vi.fn(),
    handleYearChange: vi.fn(),
    handlePresetChange: vi.fn(),
    handleCustomRangeApply: vi.fn(),
  }),
}));

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: () => ({
    user: {
      id: 1,
      onboardingProgress: {
        actionChecklist: {
          completedSteps: [],
        },
      },
    },
  }),
}));

vi.mock("@/modules/auth/hooks/use-action-onboarding-progress", () => ({
  useActionOnboardingProgress: () => ({
    completeActionStep: mockCompleteActionStep,
  }),
}));

vi.mock("@/components/AppShell", () => ({
  default: ({ children, title, description }: { children: ReactNode; title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <select value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("@/components/transactions/TransactionsMonthYearFilter", () => ({
  default: () => <div>mock-month-year-filter</div>,
}));

vi.mock("@/components/transactions/TransactionsDateFilter", () => ({
  default: () => <div>mock-date-filter</div>,
}));

vi.mock("@/components/BalanceCards", () => ({
  default: ({ cards }: { cards: SummaryCard[] }) => (
    <div>
      {cards.map((card) => (
        <span key={card.label}>{`${card.label}: ${card.formattedValue}`}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/BankConnection", () => ({
  default: () => <div>bank-connection</div>,
}));

vi.mock("@/components/DashboardChatCard", () => ({
  default: () => <div>dashboard-chat</div>,
}));

vi.mock("@/components/ExpensesList", () => ({
  default: ({ transactions }: { transactions: TransactionItem[] }) => (
    <div>
      {transactions.map((transaction) => (
        <span key={String(transaction.id)}>{transaction.description}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/SpendingChart", () => ({
  default: ({ spendingItems }: { spendingItems: Array<{ label: string; formattedTotal: string }> }) => (
    <div>
      {spendingItems.map((item) => (
        <span key={item.label}>{`${item.label} ${item.formattedTotal}`}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/lib/greeting", () => ({
  resolveDayPeriodGreeting: () => "Bom dia",
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Index />
    </MemoryRouter>,
  );
}

function getDashboardTransactionsScope() {
  return within(document.querySelector('[data-tour-id="dashboard-transactions"]') as HTMLElement);
}

const banks: BankItem[] = [
  {
    id: 1,
    slug: "nubank",
    name: "Nubank",
    accountType: "bank_account",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-primary",
    currentBalance: 1000,
    formattedBalance: "R$ 1.000,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
  {
    id: 2,
    slug: "carteira",
    name: "Carteira",
    accountType: "cash",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-warning",
    currentBalance: 250,
    formattedBalance: "R$ 250,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
  {
    id: 3,
    slug: "ultravioleta",
    name: "Nubank Ultravioleta",
    accountType: "credit_card",
    parentBankConnectionId: 1,
    parentAccountName: "Nubank",
    statementCloseDay: 10,
    statementDueDay: 17,
    connected: true,
    color: "bg-primary",
    currentBalance: 0,
    formattedBalance: "R$ 0,00",
    creditLimit: 5000,
    formattedCreditLimit: "R$ 5.000,00",
  },
  {
    id: 4,
    slug: "inter-black",
    name: "Inter Black",
    accountType: "credit_card",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: 20,
    statementDueDay: 27,
    connected: true,
    color: "bg-info",
    currentBalance: 0,
    formattedBalance: "R$ 0,00",
    creditLimit: 8000,
    formattedCreditLimit: "R$ 8.000,00",
  },
];

const transactions: TransactionItem[] = [
  {
    id: 1,
    description: "Mercado",
    amount: -120,
    formattedAmount: "-R$ 120,00",
    occurredOn: "2026-04-05",
    relativeDate: "05/04/2026",
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 10,
      slug: "mercado",
      label: "Mercado",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#ef4444",
      groupSlug: "alimentacao",
      groupLabel: "Alimentacao",
      groupColor: "#ef4444",
    },
    account: {
      id: 1,
      slug: "nubank",
      name: "Nubank",
      accountType: "bank_account",
      color: "bg-primary",
    },
  },
  {
    id: 2,
    description: "Feira local",
    amount: -40,
    formattedAmount: "-R$ 40,00",
    occurredOn: "2026-04-06",
    relativeDate: "06/04/2026",
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 10,
      slug: "mercado",
      label: "Mercado",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#ef4444",
      groupSlug: "alimentacao",
      groupLabel: "Alimentacao",
      groupColor: "#ef4444",
    },
    account: {
      id: 2,
      slug: "carteira",
      name: "Carteira",
      accountType: "cash",
      color: "bg-warning",
    },
  },
  {
    id: 3,
    description: "Streaming",
    amount: -59,
    formattedAmount: "-R$ 59,00",
    occurredOn: "2026-04-08",
    relativeDate: "08/04/2026",
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 11,
      slug: "streaming",
      label: "Streaming",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#8b5cf6",
      groupSlug: "assinaturas",
      groupLabel: "Assinaturas",
      groupColor: "#8b5cf6",
    },
    account: {
      id: 3,
      slug: "ultravioleta",
      name: "Nubank Ultravioleta",
      accountType: "credit_card",
      color: "bg-primary",
    },
  },
  {
    id: 4,
    description: "Passagem",
    amount: -220,
    formattedAmount: "-R$ 220,00",
    occurredOn: "2026-04-09",
    relativeDate: "09/04/2026",
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 12,
      slug: "transporte",
      label: "Transporte",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#3b82f6",
      groupSlug: "transporte",
      groupLabel: "Transporte",
      groupColor: "#3b82f6",
    },
    account: {
      id: 4,
      slug: "inter-black",
      name: "Inter Black",
      accountType: "credit_card",
      color: "bg-info",
    },
  },
];

describe("Index", () => {
  beforeEach(() => {
    mockCompleteActionStep.mockReset();
    mockSetSearchParams.mockReset();
    mockUseTransactions.mockReturnValue({
      data: transactions,
      isLoading: false,
      isError: false,
    });
    mockUseDashboard.mockReturnValue({
      data: {
        summaryCards: [
          {
            label: "Receitas",
            value: 5000,
            formattedValue: "R$ 5.000,00",
            change: "+10%",
            positive: true,
            description: "vs mês anterior",
            icon: ArrowUpCircle,
          },
          {
            label: "Despesas",
            value: 1200,
            formattedValue: "R$ 1.200,00",
            change: "-2%",
            positive: false,
            description: "vs mês anterior",
            icon: ArrowDownCircle,
          },
          {
            label: "Saldo acumulado",
            value: 3800,
            formattedValue: "R$ 3.800,00",
            change: "+8%",
            positive: true,
            description: "vs mês anterior",
            icon: ArrowUpCircle,
          },
        ],
        recentTransactions: [],
        banks,
        spendingByCategory: [],
      },
      isLoading: false,
      isError: false,
    });
  });

  it("marks the dashboard checklist step as complete for authenticated users", () => {
    renderPage();

    expect(mockCompleteActionStep).toHaveBeenCalledWith("dashboard");
  });

  it("keeps dashboard filters side by side, shows the card selector only for cards, and resets defaults", async () => {
    const currentSelection = getCurrentMonthSelection();
    const defaultDateRange = resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year);

    renderPage();

    expect(screen.getByText("mock-month-year-filter")).toBeInTheDocument();
    expect(screen.getByText("mock-date-filter")).toBeInTheDocument();
    expect(screen.getByText("01/04/2026 - 30/04/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Limpar filtros/i })).toBeInTheDocument();
    expect(getDashboardTransactionsScope().getByText("Mercado")).toBeInTheDocument();
    expect(getDashboardTransactionsScope().getByText("Feira local")).toBeInTheDocument();
    expect(getDashboardTransactionsScope().getByText("Streaming")).toBeInTheDocument();
    expect(getDashboardTransactionsScope().getByText("Passagem")).toBeInTheDocument();

    let filterComboboxes = screen.getAllByRole("combobox");
    expect(filterComboboxes).toHaveLength(3);
    expect((filterComboboxes[0] as HTMLSelectElement).value).toBe("all");
    expect((filterComboboxes[1] as HTMLSelectElement).value).toBe("all");
    expect((filterComboboxes[2] as HTMLSelectElement).value).toBe("all");

    fireEvent.change(filterComboboxes[0]!, { target: { value: "1" } });

    await waitFor(() => {
      expect(getDashboardTransactionsScope().getByText("Mercado")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().getByText("Streaming")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Feira local")).not.toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Passagem")).not.toBeInTheDocument();
    });

    const accountScopedTypeOptions = Array.from((screen.getAllByRole("combobox")[1] as HTMLSelectElement).options).map(
      (option) => option.textContent,
    );
    expect(accountScopedTypeOptions).toEqual(["Todos os tipos", "Conta corrente", "Cartão"]);

    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "all" } });

    fireEvent.change(filterComboboxes[1]!, { target: { value: "credit_card" } });

    await waitFor(() => {
      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      expect(getDashboardTransactionsScope().queryByText("Mercado")).not.toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Feira local")).not.toBeInTheDocument();
      expect(getDashboardTransactionsScope().getByText("Streaming")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().getByText("Passagem")).toBeInTheDocument();
    });

    filterComboboxes = screen.getAllByRole("combobox");
    fireEvent.change(filterComboboxes[2]!, { target: { value: "3" } });

    await waitFor(() => {
      expect(getDashboardTransactionsScope().getByText("Streaming")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Passagem")).not.toBeInTheDocument();
      expect(screen.getByText("Assinaturas R$ 59,00")).toBeInTheDocument();
      expect(screen.getByText("Despesas: R$ 59,00")).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "1" } });

    await waitFor(() => {
      expect(screen.getAllByRole("combobox")).toHaveLength(4);
      const creditCardSelect = screen.getAllByRole("combobox")[2] as HTMLSelectElement;
      const optionValues = Array.from(creditCardSelect.options).map((option) => option.value);
      expect(optionValues).toEqual(["all", "3"]);
    });

    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));

    expect(mockSetSearchParams).toHaveBeenCalledWith(
      expect.objectContaining({
        toString: expect.any(Function),
      }),
      { replace: true },
    );

    const [searchParams] = mockSetSearchParams.mock.calls.at(-1)!;

    expect(searchParams.get("month")).toBe(String(currentSelection.monthIndex));
    expect(searchParams.get("year")).toBe(String(currentSelection.year));
    expect(searchParams.get("preset")).toBe("month");
    expect(searchParams.get("startDate")).toBe(defaultDateRange.startDate);
    expect(searchParams.get("endDate")).toBe(defaultDateRange.endDate);

    await waitFor(() => {
      const resetComboboxes = screen.getAllByRole("combobox");
      expect(resetComboboxes).toHaveLength(3);
      expect((resetComboboxes[0] as HTMLSelectElement).value).toBe("all");
      expect((resetComboboxes[1] as HTMLSelectElement).value).toBe("all");
      expect((resetComboboxes[2] as HTMLSelectElement).value).toBe("all");
      expect(getDashboardTransactionsScope().getByText("Mercado")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().getByText("Feira local")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().getByText("Streaming")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().getByText("Passagem")).toBeInTheDocument();
    });
  });

  it("supports cash as a first-class dashboard filter by type and by account", async () => {
    renderPage();

    const filterComboboxes = screen.getAllByRole("combobox");

    fireEvent.change(filterComboboxes[1]!, { target: { value: "cash" } });

    await waitFor(() => {
      expect(getDashboardTransactionsScope().getByText("Feira local")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Mercado")).not.toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Streaming")).not.toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Passagem")).not.toBeInTheDocument();
      expect(screen.getByText("Despesas: R$ 40,00")).toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "2" } });

    await waitFor(() => {
      const refreshedComboboxes = screen.getAllByRole("combobox");
      expect((refreshedComboboxes[0] as HTMLSelectElement).value).toBe("2");
      expect((refreshedComboboxes[1] as HTMLSelectElement).value).toBe("cash");
      expect(Array.from((refreshedComboboxes[1] as HTMLSelectElement).options).map((option) => option.value)).toEqual([
        "cash",
      ]);
      expect(getDashboardTransactionsScope().getByText("Feira local")).toBeInTheDocument();
      expect(getDashboardTransactionsScope().queryByText("Mercado")).not.toBeInTheDocument();
    });
  });
});
