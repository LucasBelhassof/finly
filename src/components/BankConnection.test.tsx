import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import BankConnection from "@/components/BankConnection";
import type { BankItem } from "@/types/api";

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
    currentBalance: 2450.9,
    formattedBalance: "R$ 2.450,90",
  },
  {
    id: 2,
    slug: "visa",
    name: "Cartao Visa",
    accountType: "credit_card",
    parentBankConnectionId: 1,
    parentAccountName: "Nubank",
    statementCloseDay: 10,
    statementDueDay: 17,
    connected: true,
    color: "bg-warning",
    currentBalance: 830.25,
    formattedBalance: "R$ 830,25",
  },
  {
    id: 3,
    slug: "carteira",
    name: "Carteira",
    accountType: "cash",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-amber-500",
    currentBalance: 120,
    formattedBalance: "R$ 120,00",
  },
];

describe("BankConnection", () => {
  it("renders the user accounts card with all linked account types", () => {
    render(
      <MemoryRouter>
        <BankConnection banks={banks} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Contas")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText("Cartao Visa")).toBeInTheDocument();
    expect(screen.getByText("Carteira")).toBeInTheDocument();
    expect(screen.getByText("Conta")).toBeInTheDocument();
    expect(screen.getByText("Cartao")).toBeInTheDocument();
    expect(screen.getByText("Caixa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /adicionar/i })).toHaveAttribute("href", "/accounts");
  });

  it("shows the empty state guidance when there are no linked accounts", () => {
    render(
      <MemoryRouter>
        <BankConnection banks={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nenhuma conta vinculada ainda/i)).toBeInTheDocument();
  });
});
