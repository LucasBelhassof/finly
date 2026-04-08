import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ArrowDownCircle } from "lucide-react";
import { describe, expect, it } from "vitest";

import ExpensesList from "@/components/ExpensesList";
import type { TransactionItem } from "@/types/api";

const transactions: TransactionItem[] = [
  {
    id: 1,
    description: "Supermercado",
    amount: -230.5,
    formattedAmount: "-R$ 230,50",
    occurredOn: "2026-04-05",
    relativeDate: "Hoje",
    category: {
      id: 11,
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
      id: 3,
      slug: "nubank",
      name: "Nubank",
      accountType: "bank_account",
      color: "bg-primary",
    },
  },
];

describe("ExpensesList", () => {
  it("links the card CTA and transaction rows to the transactions route", () => {
    render(
      <MemoryRouter>
        <ExpensesList transactions={transactions} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/transactions");
    expect(screen.getByRole("link", { name: /Abrir transacoes e ver Supermercado/i })).toHaveAttribute("href", "/transactions");
    expect(screen.getByText("Mercado · Nubank")).toBeInTheDocument();
  });

  it("shows the empty state when there are no recent transactions", () => {
    render(
      <MemoryRouter>
        <ExpensesList transactions={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nenhuma transacao recente foi encontrada/i)).toBeInTheDocument();
  });
});
