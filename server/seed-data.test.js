import { describe, expect, it } from "vitest";

import {
  buildCardInstallmentPurchase,
  createDeterministicRandom,
  generateExpenseTransactions,
  generateIncomeTransactions,
  selectExpensePaymentMethod,
  selectIncomeOrigin,
} from "./seed-data.js";

const accounts = {
  cashAccount: { id: 1, accountType: "cash", slug: "caixa" },
  bankAccounts: [
    { id: 2, accountType: "bank_account", slug: "seed-conta-principal" },
    { id: 3, accountType: "bank_account", slug: "seed-conta-reserva" },
  ],
  creditCards: [
    { id: 4, accountType: "credit_card", slug: "seed-cartao-principal" },
    { id: 5, accountType: "credit_card", slug: "seed-cartao-reserva" },
  ],
};

const categories = {
  income: [
    { id: 11, transactionType: "income", slug: "salario" },
    { id: 12, transactionType: "income", slug: "freelance" },
  ],
  expense: [
    { id: 21, transactionType: "expense", slug: "moradia" },
    { id: 22, transactionType: "expense", slug: "transporte" },
  ],
};

describe("seed-data helpers", () => {
  it("produces the same pseudo-random sequence for the same seed", () => {
    const left = createDeterministicRandom("qa-seed");
    const right = createDeterministicRandom("qa-seed");

    expect([left(), left(), left(), left()]).toEqual([right(), right(), right(), right()]);
  });

  it("selectIncomeOrigin never returns a credit card", () => {
    const random = createDeterministicRandom("income-origin");

    for (let index = 0; index < 50; index += 1) {
      const origin = selectIncomeOrigin({
        random,
        cashAccount: accounts.cashAccount,
        bankAccounts: accounts.bankAccounts,
      });

      expect(["cash", "bank_account"]).toContain(origin.accountType);
      expect(origin.accountType).not.toBe("credit_card");
    }
  });

  it("selectExpensePaymentMethod never returns cash", () => {
    const random = createDeterministicRandom("expense-origin");

    for (let index = 0; index < 50; index += 1) {
      const origin = selectExpensePaymentMethod({
        random,
        bankAccounts: accounts.bankAccounts,
        creditCards: accounts.creditCards,
      });

      expect(["bank_account", "credit_card"]).toContain(origin.accountType);
      expect(origin.accountType).not.toBe("cash");
    }
  });

  it("buildCardInstallmentPurchase only accepts cards and generates valid installment metadata", () => {
    const random = createDeterministicRandom("installments");
    const result = buildCardInstallmentPurchase({
      random,
      creditCard: accounts.creditCards[0],
      expenseCategory: categories.expense[0],
      purchaseIndex: 0,
      referenceDate: "2026-04-09",
    });

    expect(result.purchase.installmentCount).toBeGreaterThanOrEqual(2);
    expect(result.purchase.installmentCount).toBeLessThanOrEqual(12);
    expect(result.purchase.bankConnectionId).toBe(accounts.creditCards[0].id);
    expect(result.transactions).toHaveLength(result.purchase.installmentCount);
    expect(result.transactions.every((transaction) => transaction.amount < 0)).toBe(true);
    expect(result.transactions.every((transaction) => Number.isInteger(transaction.installmentNumber))).toBe(true);
  });

  it("throws when installment generation receives a non-card account", () => {
    const random = createDeterministicRandom("invalid-installments");

    expect(() =>
      buildCardInstallmentPurchase({
        random,
        creditCard: accounts.bankAccounts[0],
        expenseCategory: categories.expense[0],
        purchaseIndex: 0,
      }),
    ).toThrow("installment purchases require a credit card origin");
  });

  it("generates datasets in memory that respect the financial invariants", () => {
    const random = createDeterministicRandom("dataset");
    const incomes = generateIncomeTransactions({
      random,
      count: 20,
      cashAccount: accounts.cashAccount,
      bankAccounts: accounts.bankAccounts,
      incomeCategories: categories.income,
      referenceDate: "2026-04-09",
    });
    const expenses = generateExpenseTransactions({
      random,
      count: 80,
      bankAccounts: accounts.bankAccounts,
      creditCards: accounts.creditCards,
      expenseCategories: categories.expense,
      referenceDate: "2026-04-09",
    });

    expect(incomes.every((transaction) => transaction.amount > 0)).toBe(true);
    expect(
      incomes.every((transaction) =>
        [accounts.cashAccount.id, ...accounts.bankAccounts.map((account) => account.id)].includes(transaction.bankConnectionId),
      ),
    ).toBe(true);

    expect(expenses.standaloneTransactions.every((transaction) => transaction.amount < 0)).toBe(true);
    expect(
      expenses.standaloneTransactions.every((transaction) =>
        [...accounts.bankAccounts, ...accounts.creditCards].some((account) => account.id === transaction.bankConnectionId),
      ),
    ).toBe(true);
    expect(
      expenses.standaloneTransactions
        .filter((transaction) => transaction.installmentPurchaseId !== null)
        .every((transaction) => transaction.installmentNumber !== null),
    ).toBe(true);

    expect(
      expenses.installmentPurchases.every((bundle) => {
        const card = accounts.creditCards.find((account) => account.id === bundle.purchase.bankConnectionId);
        return (
          Boolean(card) &&
          bundle.purchase.installmentCount >= 2 &&
          bundle.transactions.length === bundle.purchase.installmentCount &&
          bundle.transactions.every((transaction) => transaction.installmentNumber >= 1)
        );
      }),
    ).toBe(true);
  });
});
