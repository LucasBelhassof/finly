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
    creditLimit: null,
    formattedCreditLimit: null,
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
    currentBalance: 830.25,
    formattedBalance: "R$ 830,25",
    creditLimit: 5000,
    formattedCreditLimit: "R$ 5.000,00",
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
    creditLimit: null,
    formattedCreditLimit: null,
  },
];

describe("BankConnection", () => {
  it("renders separate cards for bank accounts and credit cards", () => {
    render(
      <MemoryRouter>
        <BankConnection banks={banks} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Contas")).toBeInTheDocument();
    expect(screen.getByText("Cartões")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText("Cartão Visa")).toBeInTheDocument();
    expect(screen.queryByText("Carteira")).not.toBeInTheDocument();
    expect(screen.getAllByText("Conta").length).toBeGreaterThan(0);
    expect(screen.getByText("Cartão")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.450,90")).toBeInTheDocument();
    expect(screen.getByText("Vinculado a Nubank")).toBeInTheDocument();
    expect(screen.getByText("17% usado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /adicionar/i })).toHaveAttribute("href", "/accounts");
  });

  it("shows dedicated empty states for bank accounts and credit cards", () => {
    render(
      <MemoryRouter>
        <BankConnection banks={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nenhuma conta bancária vinculada ainda/i)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum cartão vinculado ainda/i)).toBeInTheDocument();
  });
});
