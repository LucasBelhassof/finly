import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";

import TransactionsPage from "@/pages/Transactions";
import type { BankItem, CategoryItem, TransactionItem } from "@/types/api";

const mockUseTransactions = vi.fn();
const mockUseCategories = vi.fn();
const mockUseCreateCategory = vi.fn();
const mockUseCreateTransaction = vi.fn();
const mockUseUpdateTransaction = vi.fn();
const mockUseDeleteTransaction = vi.fn();
const mockUseUpdateCategory = vi.fn();
const mockUseDeleteCategory = vi.fn();
const mockUseBanks = vi.fn();

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: (...args: unknown[]) => mockUseTransactions(...args),
  useCategories: (...args: unknown[]) => mockUseCategories(...args),
  useCreateCategory: (...args: unknown[]) => mockUseCreateCategory(...args),
  useCreateTransaction: (...args: unknown[]) => mockUseCreateTransaction(...args),
  useUpdateTransaction: (...args: unknown[]) => mockUseUpdateTransaction(...args),
  useDeleteTransaction: (...args: unknown[]) => mockUseDeleteTransaction(...args),
  useUpdateCategory: (...args: unknown[]) => mockUseUpdateCategory(...args),
  useDeleteCategory: (...args: unknown[]) => mockUseDeleteCategory(...args),
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

vi.mock("@/components/transactions/ImportTransactionsModal", () => ({
  default: () => null,
}));

vi.mock("@/components/transactions/TransactionsMonthYearFilter", () => ({
  default: () => <div>mock-date-filter</div>,
}));

vi.mock("@/components/transactions/TransactionsDateFilter", () => ({
  default: () => <div>mock-range-filter</div>,
}));

vi.mock("@/components/ui/date-picker-input", () => ({
  DatePickerInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => <input aria-label="Data" value={value} onChange={(event) => onChange(event.target.value)} />,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

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
  },
  {
    id: 2,
    slug: "nubank-ultravioleta",
    name: "Nubank Ultravioleta",
    accountType: "credit_card",
    parentBankConnectionId: 1,
    parentAccountName: "Nubank",
    statementCloseDay: 25,
    statementDueDay: 1,
    connected: true,
    color: "bg-primary",
    currentBalance: -500,
    formattedBalance: "-R$ 500,00",
    creditLimit: 10000,
    formattedCreditLimit: "R$ 10.000,00",
  },
];

const categories: CategoryItem[] = [
  {
    id: 1,
    slug: "restaurantes",
    label: "Restaurantes",
    transactionType: "expense",
    iconName: "ArrowDownCircle",
    icon: ArrowDownCircle,
    color: "#e76f51",
    groupSlug: "alimentacao",
    groupLabel: "Alimentacao",
    groupColor: "#e76f51",
    isSystem: true,
  },
  {
    id: 2,
    slug: "transporte",
    label: "Transporte",
    transactionType: "expense",
    iconName: "ArrowDownCircle",
    icon: ArrowDownCircle,
    color: "text-info",
    groupSlug: "transporte",
    groupLabel: "Transporte",
    groupColor: "bg-info",
    isSystem: true,
  },
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
    id: 11,
    description: "iFood",
    amount: -80,
    formattedAmount: "-R$ 80,00",
    occurredOn: "2026-04-05",
    relativeDate: "Hoje",
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 1,
      slug: "restaurantes",
      label: "Restaurantes",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "#e76f51",
      groupSlug: "alimentacao",
      groupLabel: "Alimentacao",
      groupColor: "#e76f51",
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
    id: 12,
    description: "Uber",
    amount: -35,
    formattedAmount: "-R$ 35,00",
    occurredOn: "2026-04-04",
    relativeDate: "Ontem",
    housingId: null,
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 2,
      slug: "transporte",
      label: "Transporte",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "text-info",
      groupSlug: "transporte",
      groupLabel: "Transporte",
      groupColor: "bg-info",
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
    id: "recurring:13:2026-04-10",
    sourceTransactionId: 13,
    description: "Salario",
    amount: 5000,
    formattedAmount: "R$ 5.000,00",
    occurredOn: "2026-04-10",
    relativeDate: "10 Abr",
    isRecurring: true,
    isRecurringProjection: true,
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
      slug: "nubank",
      name: "Nubank",
      accountType: "bank_account",
      color: "bg-primary",
    },
  },
];

function createMutation(result?: unknown) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(result ?? {}),
    isPending: false,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <TransactionsPage />
    </MemoryRouter>,
  );
}

describe("TransactionsPage", () => {
  beforeEach(() => {
    mockUseTransactions.mockReturnValue({
      data: transactions,
      isLoading: false,
      isError: false,
    });
    mockUseCategories.mockReturnValue({ data: categories });
    mockUseBanks.mockReturnValue({ data: banks });
    mockUseCreateTransaction.mockReturnValue(createMutation());
    mockUseUpdateTransaction.mockReturnValue(createMutation());
    mockUseDeleteTransaction.mockReturnValue(createMutation());
    mockUseUpdateCategory.mockReturnValue(createMutation());
    mockUseDeleteCategory.mockReturnValue(createMutation());
  });

  it("syncs the pie chart click with the existing category filter and toggles back to all", async () => {
    mockUseCreateCategory.mockReturnValue(createMutation({ id: 99 }));

    renderPage();

    expect(screen.getByText("iFood")).toBeInTheDocument();
    expect(screen.getByText("Uber")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Filtrar por categoria Alimentacao/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByText("iFood")).toBeInTheDocument();
      expect(screen.queryByText("Uber")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("transactions-category-filter-trigger")).toHaveTextContent("Restaurantes");

    fireEvent.click(screen.getAllByRole("button", { name: /Filtrar por categoria Alimentacao/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByText("Uber")).toBeInTheDocument();
    });

    expect(screen.getByTestId("transactions-category-filter-trigger")).toHaveTextContent("Todas as categorias");
  });

  it("submits the chosen custom color when creating a category", async () => {
    const createCategory = createMutation({
      id: 77,
      ...categories[0],
    });
    mockUseCreateCategory.mockReturnValue(createCategory);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Nova categoria" }));
    fireEvent.change(screen.getByPlaceholderText("Nome da categoria"), { target: { value: "Lazer" } });
    fireEvent.change(screen.getByLabelText("Selecionar cor da categoria"), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => {
      expect(createCategory.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "Lazer",
          color: "#123456",
          groupColor: "#123456",
        }),
      );
    });
  });

  it("shows categories without transactions in the sidebar and filter", () => {
    mockUseCategories.mockReturnValue({
      data: [
        ...categories,
        {
          id: 77,
          slug: "lazer",
          label: "Lazer",
          transactionType: "expense",
          iconName: "ArrowDownCircle",
          icon: ArrowDownCircle,
          color: "#123456",
          groupSlug: "lazer",
          groupLabel: "Lazer",
          groupColor: "#123456",
          isSystem: false,
        } satisfies CategoryItem,
      ],
    });

    renderPage();

    expect(screen.getAllByText("Lazer").length).toBeGreaterThan(0);
  });

  it("shows delete for user categories in the edit modal and submits deletion", async () => {
    const deleteCategory = createMutation();
    mockUseDeleteCategory.mockReturnValue(deleteCategory);
    mockUseCategories.mockReturnValue({
      data: [
        ...categories,
        {
          id: 77,
          slug: "lazer",
          label: "Lazer",
          transactionType: "expense",
          iconName: "ArrowDownCircle",
          icon: ArrowDownCircle,
          color: "#123456",
          groupSlug: "lazer",
          groupLabel: "Lazer",
          groupColor: "#123456",
          isSystem: false,
        } satisfies CategoryItem,
      ],
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Editar categoria Lazer/i }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

    await waitFor(() => {
      expect(deleteCategory.mutateAsync).toHaveBeenCalledWith("77");
    });
  });

  it("hides delete for system categories in the edit modal", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Editar categoria Transporte/i }));

    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("keeps recurring income enabled when editing a projected recurring transaction", async () => {
    const updateTransaction = createMutation();
    mockUseUpdateTransaction.mockReturnValue(updateTransaction);

    renderPage();

    fireEvent.click(screen.getAllByText("Salario")[0]!);

    expect(screen.getByLabelText("Marcar receita como recorrente")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(updateTransaction.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "13",
          isRecurring: true,
          amount: 5000,
        }),
      );
    });
  });

  it("does not list credit cards when creating an income transaction", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Nova transação/i }));
    fireEvent.click(screen.getAllByRole("combobox")[0]!);

    await waitFor(() => {
      expect(screen.queryAllByText("Nubank").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Nubank Ultravioleta")).not.toBeInTheDocument();
  });

  it("deletes a projected recurring income using the effective occurrence date", async () => {
    const deleteTransaction = createMutation();
    mockUseDeleteTransaction.mockReturnValue(deleteTransaction);

    renderPage();

    fireEvent.click(screen.getAllByText("Salario")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

    await waitFor(() => {
      expect(deleteTransaction.mutateAsync).toHaveBeenCalledWith({
        id: 13,
        occurredOn: "2026-04-10",
      });
    });
  });
});
