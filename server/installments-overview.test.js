import { describe, expect, it } from "vitest";

import { buildInstallmentsConsistencyChecks, buildInstallmentsOverviewResponse, deriveNextDueDate } from "./installments-overview.js";

const baseRows = [
  {
    installmentPurchaseId: 10,
    descriptionBase: "Notebook",
    purchaseDate: "2026-02-15",
    installmentCount: 10,
    installmentAmount: 154.25,
    cardId: 2,
    cardName: "Nubank",
    statementDueDay: 15,
    categoryId: 30,
    categoryLabel: "Eletronicos",
    transactionId: 101,
    occurredOn: "2026-02-15",
    installmentNumber: 1,
  },
  {
    installmentPurchaseId: 10,
    descriptionBase: "Notebook",
    purchaseDate: "2026-02-15",
    installmentCount: 10,
    installmentAmount: 154.25,
    cardId: 2,
    cardName: "Nubank",
    statementDueDay: 15,
    categoryId: 30,
    categoryLabel: "Eletronicos",
    transactionId: 102,
    occurredOn: "2026-03-15",
    installmentNumber: 2,
  },
  {
    installmentPurchaseId: 10,
    descriptionBase: "Notebook",
    purchaseDate: "2026-02-15",
    installmentCount: 10,
    installmentAmount: 154.25,
    cardId: 2,
    cardName: "Nubank",
    statementDueDay: 15,
    categoryId: 30,
    categoryLabel: "Eletronicos",
    transactionId: 103,
    occurredOn: "2026-04-15",
    installmentNumber: 3,
  },
  {
    installmentPurchaseId: 10,
    descriptionBase: "Notebook",
    purchaseDate: "2026-02-15",
    installmentCount: 10,
    installmentAmount: 154.25,
    cardId: 2,
    cardName: "Nubank",
    statementDueDay: 15,
    categoryId: 30,
    categoryLabel: "Eletronicos",
    transactionId: 104,
    occurredOn: "2026-05-15",
    installmentNumber: 4,
  },
  {
    installmentPurchaseId: 11,
    descriptionBase: "Curso",
    purchaseDate: "2025-11-04",
    installmentCount: 4,
    installmentAmount: 100,
    cardId: 3,
    cardName: "Visa",
    statementDueDay: 1,
    categoryId: 31,
    categoryLabel: "Educacao",
    transactionId: 201,
    occurredOn: "2025-11-04",
    installmentNumber: 1,
  },
  {
    installmentPurchaseId: 11,
    descriptionBase: "Curso",
    purchaseDate: "2025-11-04",
    installmentCount: 4,
    installmentAmount: 100,
    cardId: 3,
    cardName: "Visa",
    statementDueDay: 1,
    categoryId: 31,
    categoryLabel: "Educacao",
    transactionId: 202,
    occurredOn: "2025-12-04",
    installmentNumber: 2,
  },
  {
    installmentPurchaseId: 11,
    descriptionBase: "Curso",
    purchaseDate: "2025-11-04",
    installmentCount: 4,
    installmentAmount: 100,
    cardId: 3,
    cardName: "Visa",
    statementDueDay: 1,
    categoryId: 31,
    categoryLabel: "Educacao",
    transactionId: 203,
    occurredOn: "2026-01-04",
    installmentNumber: 3,
  },
  {
    installmentPurchaseId: 11,
    descriptionBase: "Curso",
    purchaseDate: "2025-11-04",
    installmentCount: 4,
    installmentAmount: 100,
    cardId: 3,
    cardName: "Visa",
    statementDueDay: 1,
    categoryId: 31,
    categoryLabel: "Educacao",
    transactionId: 204,
    occurredOn: "2026-02-04",
    installmentNumber: 4,
  },
  {
    installmentPurchaseId: 12,
    descriptionBase: "Celular",
    purchaseDate: "2026-04-03",
    installmentCount: 3,
    installmentAmount: 120.33,
    cardId: 2,
    cardName: "Nubank",
    statementDueDay: null,
    categoryId: 30,
    categoryLabel: "Eletronicos",
    transactionId: 301,
    occurredOn: "2026-04-03",
    installmentNumber: 1,
  },
  {
    installmentPurchaseId: 12,
    descriptionBase: "Celular",
    purchaseDate: "2026-04-03",
    installmentCount: 3,
    installmentAmount: 120.33,
    cardId: 2,
    cardName: "Nubank",
    statementDueDay: null,
    categoryId: 30,
    categoryLabel: "Eletronicos",
    transactionId: 302,
    occurredOn: "2026-05-03",
    installmentNumber: 2,
  },
  {
    installmentPurchaseId: 12,
    descriptionBase: "Celular",
    purchaseDate: "2026-04-03",
    installmentCount: 3,
    installmentAmount: 120.33,
    cardId: 2,
    cardName: "Nubank",
    statementDueDay: null,
    categoryId: 30,
    categoryLabel: "Eletronicos",
    transactionId: 303,
    occurredOn: "2026-06-03",
    installmentNumber: 3,
  },
];

describe("installments overview helpers", () => {
  it("aggregates active, overdue and paid installments correctly", () => {
    const overview = buildInstallmentsOverviewResponse(baseRows, {}, "2026-04-09");

    expect(overview.active_installments_count).toBe(2);
    expect(overview.monthly_commitment).toBe(274.58);
    expect(overview.remaining_balance_total).toBe(669.49);
    expect(overview.original_amount_total).toBe(2303.49);
    expect(overview.payoff_projection_month).toBe("2026-06");

    expect(overview.items.find((item) => item.installment_purchase_id === 10)).toMatchObject({
      current_installment: 3,
      display_installment_number: 3,
      remaining_installments: 2,
      remaining_balance: 308.5,
      status: "active",
    });
    expect(overview.items.find((item) => item.installment_purchase_id === 11)?.status).toBe("paid");
    expect(overview.items.find((item) => item.installment_purchase_id === 12)?.status).toBe("overdue");
  });

  it("applies filters without allowing invalid consistency values", () => {
    const overview = buildInstallmentsOverviewResponse(baseRows, { status: "paid", cardId: 3 }, "2026-04-09");
    const checks = buildInstallmentsConsistencyChecks(baseRows, { status: "paid", cardId: 3 }, "2026-04-09");

    expect(overview.items).toHaveLength(1);
    expect(overview.items[0].installment_purchase_id).toBe(11);
    expect(overview.monthly_commitment).toBe(0);
    expect(checks).toEqual({
      invalid_installment_count_items: 0,
      invalid_remaining_installments_items: 0,
      invalid_remaining_balance_items: 0,
    });
  });

  it("filters by total installments or remaining installments", () => {
    const byTotalInstallments = buildInstallmentsOverviewResponse(
      baseRows,
      { installmentCountMode: "installment_count", installmentCountValue: 10 },
      "2026-04-09",
    );
    const byRemainingInstallments = buildInstallmentsOverviewResponse(
      baseRows,
      { installmentCountMode: "remaining_installments", installmentCountValue: 2 },
      "2026-04-09",
    );

    expect(byTotalInstallments.items).toHaveLength(1);
    expect(byTotalInstallments.items[0].installment_purchase_id).toBe(10);
    expect(byRemainingInstallments.items).toHaveLength(1);
    expect(byRemainingInstallments.items[0].installment_purchase_id).toBe(10);
  });

  it("expands one purchase into multiple installment rows when the filtered period covers them", () => {
    const overview = buildInstallmentsOverviewResponse(
      baseRows,
      {
        purchaseStart: "2026-04-01",
        purchaseEnd: "2026-06-30",
        cardId: 2,
      },
      "2026-04-09",
    );

    const notebookRows = overview.items.filter((item) => item.installment_purchase_id === 10);

    expect(notebookRows).toHaveLength(2);
    expect(notebookRows.map((item) => item.installment_month)).toEqual(["2026-04", "2026-05"]);
    expect(notebookRows.map((item) => item.display_installment_number)).toEqual([3, 4]);
    expect(notebookRows.map((item) => item.installment_due_date)).toEqual(["2026-04-15", "2026-05-15"]);
    expect(overview.items.find((item) => item.installment_purchase_id === 12)).toMatchObject({
      installment_month: "2026-04",
      display_installment_number: 1,
      installment_due_date: "2026-04-03",
    });
    expect(overview.monthly_commitment).toBeCloseTo(669.49, 2);
  });

  it("keeps next months projection populated when the visible period is limited", () => {
    const overview = buildInstallmentsOverviewResponse(
      baseRows,
      {
        purchaseStart: "2026-04-01",
        purchaseEnd: "2026-04-30",
        cardId: 2,
      },
      "2026-04-09",
    );

    expect(overview.charts.next_3_months_projection).toEqual([
      { month: "2026-04", amount: 274.58 },
      { month: "2026-05", amount: 274.58 },
      { month: "2026-06", amount: 120.33 },
    ]);
  });

  it("derives due dates and tolerates installment rounding", () => {
    const overview = buildInstallmentsOverviewResponse(baseRows, { cardId: 2 }, "2026-04-09");
    const roundedItem = overview.items.find((item) => item.installment_purchase_id === 12);

    expect(deriveNextDueDate("2026-04-03", 15)).toBe("2026-04-15");
    expect(deriveNextDueDate("2026-04-20", 15)).toBe("2026-05-15");
    expect(roundedItem?.total_amount).toBeCloseTo(360.99, 2);
    expect(roundedItem?.installment_due_date).toBe("2026-04-03");
    expect(Math.abs((roundedItem?.installment_amount ?? 0) * (roundedItem?.installment_count ?? 0) - (roundedItem?.total_amount ?? 0))).toBeLessThanOrEqual(
      0.01,
    );
  });
});
