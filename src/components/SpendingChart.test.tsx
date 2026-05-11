import { fireEvent, render, screen, within } from "@testing-library/react";
import { ArrowDownCircle } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import SpendingChart from "@/components/SpendingChart";
import { appRoutes } from "@/lib/routes";
import type { BankItem, SpendingItem, TransactionItem } from "@/types/api";

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
    currentBalance: 2500,
    formattedBalance: "R$ 2.500,00",
  },
  {
    id: 2,
    slug: "visa",
    name: "Cartão Visa",
    accountType: "credit_card",
    parentBankConnectionId: 1,
    parentAccountName: "Nubank",
    statementCloseDay: 10,
    statementDueDay: 17,
    connected: true,
    color: "bg-warning",
    currentBalance: 900,
    formattedBalance: "R$ 900,00",
  },
  {
    id: 3,
    slug: "caixa",
    name: "Caixa",
    accountType: "cash",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-amber-500",
    currentBalance: 150,
    formattedBalance: "R$ 150,00",
  },
];

const transactions: TransactionItem[] = [
  {
    id: 1,
    description: "Aluguel",
    amount: -1000,
    formattedAmount: "-R$ 1.000,00",
    occurredOn: "2026-04-03",
    relativeDate: "Hoje",
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 11,
      slug: "aluguel",
      label: "Aluguel",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "text-primary",
      groupSlug: "moradia",
      groupLabel: "Moradia",
      groupColor: "bg-primary",
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
    description: "Mercado",
    amount: -500,
    formattedAmount: "-R$ 500,00",
    occurredOn: "2026-04-04",
    relativeDate: "Ontem",
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 12,
      slug: "mercado",
      label: "Mercado",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "text-warning",
      groupSlug: "alimentacao",
      groupLabel: "Alimentacao",
      groupColor: "bg-warning",
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
    description: "Restaurante",
    amount: -300,
    formattedAmount: "-R$ 300,00",
    occurredOn: "2026-04-05",
    relativeDate: "2 dias",
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 13,
      slug: "restaurante",
      label: "Restaurante",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "text-warning",
      groupSlug: "alimentacao",
      groupLabel: "Alimentacao",
      groupColor: "bg-warning",
    },
    account: {
      id: 2,
      slug: "visa",
      name: "Cartão Visa",
      accountType: "credit_card",
      color: "bg-warning",
    },
  },
  {
    id: 4,
    description: "Pix recebido",
    amount: 2500,
    formattedAmount: "R$ 2.500,00",
    occurredOn: "2026-04-06",
    relativeDate: "Hoje",
    isInstallment: false,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    category: {
      id: 14,
      slug: "salario",
      label: "Salario",
      iconName: "ArrowDownCircle",
      icon: ArrowDownCircle,
      color: "text-income",
      groupSlug: "receitas",
      groupLabel: "Receitas",
      groupColor: "bg-income",
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

const spendingItems: SpendingItem[] = [
  {
    slug: "moradia",
    label: "Moradia",
    color: "bg-primary",
    total: 1000,
    formattedTotal: "R$ 1.000,00",
    percentage: 56,
  },
  {
    slug: "alimentacao",
    label: "Alimentacao",
    color: "bg-warning",
    total: 800,
    formattedTotal: "R$ 800,00",
    percentage: 44,
  },
];

describe("SpendingChart", () => {
  it("renders the aggregated legend for all accounts by default", () => {
    render(<SpendingChart transactions={transactions} banks={banks} />);

    expect(screen.getByText("Gastos por Categoria")).toBeInTheDocument();
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentacao")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 800,00")).toBeInTheDocument();
    expect(screen.getByText("56%")).toBeInTheDocument();
    expect(screen.getByText("44%")).toBeInTheDocument();
  });

  it("filters the legend by the selected account", () => {
    render(<SpendingChart transactions={transactions} banks={banks} />);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Cartão Visa" }));

    expect(screen.getByText("Alimentacao")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.queryByText("Moradia")).not.toBeInTheDocument();
  });

  it("shows a contextual empty state for accounts without expenses", () => {
    render(
      <MemoryRouter>
        <SpendingChart transactions={transactions} banks={banks} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Caixa" }));

    expect(screen.getByText(/Não há despesas categorizadas para a conta selecionada/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Importar extrato" })).toHaveAttribute("href", appRoutes.transactions);
    expect(screen.getByRole("link", { name: "Revisar categorias" })).toHaveAttribute("href", appRoutes.transactions);
  });

  it("lists all account options in the selector", () => {
    render(<SpendingChart transactions={transactions} banks={banks} />);

    fireEvent.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");

    expect(within(listbox).getByText("Todas as contas")).toBeInTheDocument();
    expect(within(listbox).getByText("Nubank")).toBeInTheDocument();
    expect(within(listbox).getByText("Cartão Visa")).toBeInTheDocument();
    expect(within(listbox).getByText("Caixa")).toBeInTheDocument();
  });

  it("renders precomputed spending items without showing the account selector", () => {
    render(<SpendingChart spendingItems={spendingItems} banks={banks} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentacao")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 800,00")).toBeInTheDocument();
  });
});
