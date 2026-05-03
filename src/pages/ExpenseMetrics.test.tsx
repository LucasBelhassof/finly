import type { ReactNode } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExpenseMetricsPage from "@/pages/ExpenseMetrics";
import type { BankItem, TransactionItem } from "@/types/api";

const mockUseTransactions = vi.fn();
const mockUseBanks = vi.fn();

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: (...args: unknown[]) => mockUseTransactions(...args),
}));

vi.mock("@/hooks/use-banks", () => ({
  useBanks: (...args: unknown[]) => mockUseBanks(...args),
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

vi.mock("@/components/transactions/TransactionsMonthYearFilter", () => ({
  default: () => <div>mock-month-year-filter</div>,
}));

vi.mock("@/components/transactions/TransactionsDateFilter", () => ({
  default: () => <div>mock-date-filter</div>,
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

vi.mock("@/components/CategoryPieChart", () => ({
  __esModule: true,
  default: ({ items }: { items: Array<{ label: string; formattedTotal: string }> }) => (
    <div>
      {items.map((item) => (
        <span key={item.label}>{`${item.label} ${item.formattedTotal}`}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
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
    currentBalance: 1500,
    formattedBalance: "R$ 1.500,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
  {
    id: 2,
    slug: "inter",
    name: "Inter",
    accountType: "credit_card",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: 10,
    statementDueDay: 17,
    connected: true,
    color: "bg-info",
    currentBalance: 0,
    formattedBalance: "R$ 0,00",
    creditLimit: 5000,
    formattedCreditLimit: "R$ 5.000,00",
  },
  {
    id: 3,
    slug: "caixa",
    name: "Caixa física",
    accountType: "cash",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-warning",
    currentBalance: 400,
    formattedBalance: "R$ 400,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
];

const transactions: TransactionItem[] = [
  {
    id: 1,
    description: "Salario",
    amount: 5000,
    formattedAmount: "+R$ 5.000,00",
    occurredOn: "2026-04-03",
    relativeDate: "03/04/2026",
    isRecurring: false,
    isRecurringProjection: false,
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 10,
      slug: "salario",
      label: "Salario",
      iconName: "ArrowUpCircle",
      icon: ArrowUpCircle,
      color: "#22c55e",
      groupSlug: "receitas",
      groupLabel: "Receitas",
      groupColor: "#22c55e",
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
    description: "Supermercado",
    amount: -320,
    formattedAmount: "-R$ 320,00",
    occurredOn: "2026-04-05",
    relativeDate: "05/04/2026",
    isRecurring: false,
    isRecurringProjection: false,
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 11,
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
    id: 3,
    description: "Combustivel",
    amount: -180,
    formattedAmount: "-R$ 180,00",
    occurredOn: "2026-04-10",
    relativeDate: "10/04/2026",
    isRecurring: false,
    isRecurringProjection: false,
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 12,
      slug: "combustivel",
      label: "Combustivel",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#3b82f6",
      groupSlug: "transporte",
      groupLabel: "Transporte",
      groupColor: "#3b82f6",
    },
    account: {
      id: 2,
      slug: "inter",
      name: "Inter",
      accountType: "credit_card",
      color: "bg-info",
    },
  },
  {
    id: 4,
    description: "Streaming",
    amount: -90,
    formattedAmount: "-R$ 90,00",
    occurredOn: "2026-04-12",
    relativeDate: "12/04/2026",
    isRecurring: false,
    isRecurringProjection: true,
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 13,
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
      id: 1,
      slug: "nubank",
      name: "Nubank",
      accountType: "bank_account",
      color: "bg-primary",
    },
  },
  {
    id: 5,
    description: "Notebook parcelado",
    amount: -600,
    formattedAmount: "-R$ 600,00",
    occurredOn: "2026-04-15",
    relativeDate: "15/04/2026",
    isRecurring: false,
    isRecurringProjection: false,
    housingId: null,
    isInstallment: true,
    installmentPurchaseId: 88,
    installmentNumber: 1,
    installmentCount: 10,
    purchaseOccurredOn: "2026-04-15",
    category: {
      id: 14,
      slug: "eletronicos",
      label: "Eletronicos",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#f97316",
      groupSlug: "eletronicos",
      groupLabel: "Eletronicos",
      groupColor: "#f97316",
    },
    account: {
      id: 2,
      slug: "inter",
      name: "Inter",
      accountType: "credit_card",
      color: "bg-info",
    },
  },
  {
    id: 6,
    description: "Academia",
    amount: -70,
    formattedAmount: "-R$ 70,00",
    occurredOn: "2026-04-18",
    relativeDate: "18/04/2026",
    isRecurring: true,
    isRecurringProjection: false,
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 15,
      slug: "academia",
      label: "Academia",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#06b6d4",
      groupSlug: "saude",
      groupLabel: "Saude",
      groupColor: "#06b6d4",
    },
    account: {
      id: 3,
      slug: "caixa",
      name: "Caixa física",
      accountType: "cash",
      color: "bg-warning",
    },
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <ExpenseMetricsPage />
    </MemoryRouter>,
  );
}

describe("ExpenseMetricsPage", () => {
  beforeEach(() => {
    mockUseTransactions.mockReturnValue({
      data: transactions,
      isLoading: false,
      isError: false,
    });
    mockUseBanks.mockReturnValue({
      data: banks,
      isLoading: false,
    });
  });

  it("renders the main metrics and rankings for the selected period", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Métricas" })).toBeInTheDocument();
    expect(screen.getByText("mock-month-year-filter")).toBeInTheDocument();
    expect(screen.getByText("mock-date-filter")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.260,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.740,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 252,00")).toBeInTheDocument();
    expect(screen.getByText("5 lançamentos filtrados")).toBeInTheDocument();
    expect(screen.getByText("Eletronicos R$ 600,00")).toBeInTheDocument();
    expect(screen.getAllByText("Inter").length).toBeGreaterThan(0);
    expect(screen.getByText("Notebook parcelado")).toBeInTheDocument();
  });

  it("shows the new advanced controls and counts all non-default advanced filters", async () => {
    renderPage();

    const advancedButton = screen.getByRole("button", { name: /Opções avançadas/i });
    expect(screen.queryByText("Natureza da conta")).not.toBeInTheDocument();

    fireEvent.click(advancedButton);

    expect(screen.getByText("Natureza da conta")).toBeInTheDocument();
    expect(screen.getByText("Parcelamento")).toBeInTheDocument();
    expect(screen.getByText("Recorrência")).toBeInTheDocument();

    const comboboxes = screen.getAllByRole("combobox");
    fireEvent.change(comboboxes[2]!, { target: { value: "expense" } });
    fireEvent.change(comboboxes[3]!, { target: { value: "credit_card" } });
    fireEvent.change(comboboxes[4]!, { target: { value: "only_installments" } });
    fireEvent.change(comboboxes[5]!, { target: { value: "only_non_recurring" } });

    fireEvent.click(screen.getByRole("button", { name: /Opções avançadas/i }));

    await waitFor(() => {
      expect(within(screen.getByRole("button", { name: /Opções avançadas/i })).getByText("4")).toBeInTheDocument();
    });
  });

  it("filters metrics by account nature and updates the ranking dataset", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Opções avançadas/i }));
    fireEvent.change(screen.getAllByRole("combobox")[3]!, {
      target: { value: "cash" },
    });

    await waitFor(() => {
      expect(screen.getByText("1 lançamentos filtrados")).toBeInTheDocument();
      expect(screen.getByText("Saude R$ 70,00")).toBeInTheDocument();
      expect(screen.getAllByText("Caixa física").length).toBeGreaterThan(1);
      expect(screen.getByText("Academia")).toBeInTheDocument();
      expect(screen.queryByText("Eletronicos R$ 600,00")).not.toBeInTheDocument();
      expect(screen.queryByText("Alimentacao R$ 320,00")).not.toBeInTheDocument();
    });
  });

  it("filters installment transactions and non-installment transactions separately", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Opções avançadas/i }));
    fireEvent.change(screen.getAllByRole("combobox")[4]!, {
      target: { value: "only_installments" },
    });

    await waitFor(() => {
      expect(screen.getByText("1 lançamentos filtrados")).toBeInTheDocument();
      expect(screen.getByText("Notebook parcelado")).toBeInTheDocument();
      expect(screen.getByText("Eletronicos R$ 600,00")).toBeInTheDocument();
      expect(screen.queryByText("Alimentacao R$ 320,00")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole("combobox")[4]!, {
      target: { value: "only_non_installments" },
    });

    await waitFor(() => {
      expect(screen.getByText("R$ 660,00")).toBeInTheDocument();
      expect(screen.getByText("Assinaturas R$ 90,00")).toBeInTheDocument();
      expect(screen.queryByText("Notebook parcelado")).not.toBeInTheDocument();
      expect(screen.queryByText("Eletronicos R$ 600,00")).not.toBeInTheDocument();
    });
  });

  it("filters recurring and non-recurring buckets using real recurring rows and projections", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Opções avançadas/i }));
    fireEvent.change(screen.getAllByRole("combobox")[5]!, {
      target: { value: "only_recurring" },
    });

    await waitFor(() => {
      expect(screen.getByText("R$ 160,00")).toBeInTheDocument();
      expect(screen.getByText("Assinaturas R$ 90,00")).toBeInTheDocument();
      expect(screen.getByText("Saude R$ 70,00")).toBeInTheDocument();
      expect(screen.queryByText("Eletronicos R$ 600,00")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole("combobox")[5]!, {
      target: { value: "only_non_recurring" },
    });

    await waitFor(() => {
      expect(screen.getByText("R$ 1.100,00")).toBeInTheDocument();
      expect(screen.getByText("Eletronicos R$ 600,00")).toBeInTheDocument();
      expect(screen.queryByText("Assinaturas R$ 90,00")).not.toBeInTheDocument();
      expect(screen.queryByText("Saude R$ 70,00")).not.toBeInTheDocument();
    });
  });

  it("resets all filters including advanced local state", async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Buscar descrição, categoria ou conta/i), {
      target: { value: "notebook" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1]!, {
      target: { value: "eletronicos" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Opções avançadas/i }));
    const comboboxes = screen.getAllByRole("combobox");
    fireEvent.change(comboboxes[2]!, { target: { value: "expense" } });
    fireEvent.change(comboboxes[3]!, { target: { value: "credit_card" } });
    fireEvent.change(comboboxes[4]!, { target: { value: "only_installments" } });
    fireEvent.change(comboboxes[5]!, { target: { value: "only_non_recurring" } });

    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));

    await waitFor(() => {
      const resetComboboxes = screen.getAllByRole("combobox");
      expect((screen.getByPlaceholderText(/Buscar descrição, categoria ou conta/i) as HTMLInputElement).value).toBe("");
      expect((resetComboboxes[0] as HTMLSelectElement).value).toBe("all");
      expect((resetComboboxes[1] as HTMLSelectElement).value).toBe("all");
      expect((resetComboboxes[2] as HTMLSelectElement).value).toBe("all");
      expect((resetComboboxes[3] as HTMLSelectElement).value).toBe("all");
      expect((resetComboboxes[4] as HTMLSelectElement).value).toBe("all");
      expect((resetComboboxes[5] as HTMLSelectElement).value).toBe("all");
      expect(screen.getByText("5 lançamentos filtrados")).toBeInTheDocument();
      expect(screen.getByText("Eletronicos R$ 600,00")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Opções avançadas/i }));

    await waitFor(() => {
      expect(
        within(screen.getByRole("button", { name: /Opções avançadas/i })).queryByText("4"),
      ).not.toBeInTheDocument();
    });
  });

  it("filters by search, category and advanced type", async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Buscar descrição, categoria ou conta/i), {
      target: { value: "combust" },
    });

    await waitFor(() => {
      expect(screen.getByText("1 lançamentos filtrados")).toBeInTheDocument();
      expect(screen.getByText("-R$ 180,00")).toBeInTheDocument();
      expect(screen.getByText("Receitas: R$ 0,00")).toBeInTheDocument();
      expect(screen.getByText("Transporte R$ 180,00")).toBeInTheDocument();
      expect(screen.queryByText("Alimentacao R$ 320,00")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole("combobox")[1]!, {
      target: { value: "transporte" },
    });

    await waitFor(() => {
      expect(screen.getByText("Combustivel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Opções avançadas/i }));
    fireEvent.change(screen.getAllByRole("combobox")[2]!, {
      target: { value: "expense" },
    });

    await waitFor(() => {
      expect(screen.getByText("Transporte R$ 180,00")).toBeInTheDocument();
      expect(screen.queryByText("Alimentacao R$ 320,00")).not.toBeInTheDocument();
    });
  });
});
