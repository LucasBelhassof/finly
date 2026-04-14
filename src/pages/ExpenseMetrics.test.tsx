import type { ReactNode } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { render, screen } from "@testing-library/react";
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

vi.mock("@/components/transactions/TransactionsDateFilter", () => ({
  default: () => <div>mock-date-filter</div>,
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
];

const transactions: TransactionItem[] = [
  {
    id: 1,
    description: "Salario",
    amount: 5000,
    formattedAmount: "+R$ 5.000,00",
    occurredOn: "2026-04-03",
    relativeDate: "03/04/2026",
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
];

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
    render(<ExpenseMetricsPage />);

    expect(screen.getByRole("heading", { name: "Metricas" })).toBeInTheDocument();
    expect(screen.getByText("R$ 500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 4.500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText("Alimentacao R$ 320,00")).toBeInTheDocument();
    expect(screen.getAllByText("Nubank").length).toBeGreaterThan(0);
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
  });
});
