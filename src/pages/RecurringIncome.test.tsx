import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ArrowUpCircle } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RecurringIncomePage from "@/pages/RecurringIncome";
import type { BankItem, CategoryItem, TransactionItem } from "@/types/api";

const mockUseTransactions = vi.fn();
const mockUseCategories = vi.fn();
const mockUseBanks = vi.fn();
const mockUseCreateTransaction = vi.fn();
const mockUseUpdateTransaction = vi.fn();
const mockUseDeleteTransaction = vi.fn();

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: (...args: unknown[]) => mockUseTransactions(...args),
  useCategories: (...args: unknown[]) => mockUseCategories(...args),
  useCreateTransaction: (...args: unknown[]) => mockUseCreateTransaction(...args),
  useUpdateTransaction: (...args: unknown[]) => mockUseUpdateTransaction(...args),
  useDeleteTransaction: (...args: unknown[]) => mockUseDeleteTransaction(...args),
}));

vi.mock("@/hooks/use-banks", () => ({
  useBanks: (...args: unknown[]) => mockUseBanks(...args),
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
  default: () => <div>mock-date-range-filter</div>,
}));

vi.mock("@/components/CategoryPieChart", () => ({
  default: () => <div>mock-category-chart</div>,
}));

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

vi.mock("recharts", () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Bar: Mock,
    BarChart: Mock,
    CartesianGrid: Mock,
    XAxis: Mock,
    YAxis: Mock,
  };
});

vi.mock("@/components/ui/date-picker-input", () => ({
  DatePickerInput: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Data" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createMutation() {
  return {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };
}

const banks: BankItem[] = [
  {
    id: 1,
    slug: "itau",
    name: "Itau",
    accountType: "bank_account",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    notifyInvoiceClosed: false,
    notifyInvoiceDueSoon: false,
    invoiceDueReminderDays: 3,
    connected: true,
    color: "bg-primary",
    currentBalance: 1000,
    formattedBalance: "R$ 1.000,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
];

const categories: CategoryItem[] = [
  {
    id: 3,
    slug: "salario",
    label: "Salario",
    transactionType: "income",
    iconName: "ArrowUpCircle",
    icon: ArrowUpCircle,
    color: "#22c55e",
    groupSlug: "receitas",
    groupLabel: "Receitas",
    groupColor: "#22c55e",
    isSystem: true,
  },
];

const transactions: TransactionItem[] = [
  {
    id: 13,
    sourceTransactionId: 13,
    description: "Salario principal",
    amount: 5000,
    formattedAmount: "R$ 5.000,00",
    occurredOn: "2026-04-10",
    relativeDate: "10 Abr",
    isRecurring: true,
    isRecurringProjection: false,
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 3,
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
      slug: "itau",
      name: "Itau",
      accountType: "bank_account",
      color: "bg-primary",
    },
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <RecurringIncomePage />
    </MemoryRouter>,
  );
}

describe("RecurringIncomePage", () => {
  beforeEach(() => {
    mockUseTransactions.mockReturnValue({
      data: transactions,
      isLoading: false,
      isError: false,
    });
    mockUseCategories.mockReturnValue({ data: categories });
    mockUseBanks.mockReturnValue({ data: banks, isLoading: false });
    mockUseCreateTransaction.mockReturnValue(createMutation());
    mockUseUpdateTransaction.mockReturnValue(createMutation());
    mockUseDeleteTransaction.mockReturnValue(createMutation());
  });

  it("renders the shared filters panel without reset or advanced actions", () => {
    const { container } = renderPage();

    const filtersPanel = container.querySelector('[data-tour-id="recurring-income-filters"]');

    expect(filtersPanel).not.toBeNull();
    expect(screen.getByText("mock-month-year-filter")).toBeInTheDocument();
    expect(screen.getByText("mock-date-range-filter")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByText("Todas as contas")).toBeInTheDocument();
    expect(screen.getByText("Todas as categorias")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar descrição, categoria ou conta...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova recorrencia/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Limpar filtros/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Opções avançadas/i })).not.toBeInTheDocument();
  });
});
