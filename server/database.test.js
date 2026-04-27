import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixedNow = new Date("2026-04-27T12:00:00Z");

describe("transaction date mapping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the real current date instead of the first transaction date for relative labels", async () => {
    const { mapTransactionRows } = await import("./database.js");

    const rows = [
      {
        id: 1,
        description: "Mercado",
        amount: -120,
        occurred_on: "2026-04-25",
        is_recurring: false,
        recurrence_ends_on: null,
        housing_id: null,
        installment_purchase_id: null,
        installment_number: null,
        installment_count: null,
        purchase_occurred_on: null,
        category_id: 10,
        category_slug: "mercado",
        category_label: "Mercado",
        category_icon: "ShoppingCart",
        category_color: "text-warning",
        group_slug: "alimentacao",
        group_label: "Alimentacao",
        group_color: "bg-warning",
        bank_connection_id: 2,
        bank_slug: "nubank",
        bank_name: "Nubank",
        bank_account_type: "bank_account",
        bank_color: "bg-primary",
      },
    ];

    const [transaction] = mapTransactionRows(rows);

    expect(transaction.occurredOn).toBe("2026-04-25");
    expect(transaction.relativeDate).toBe("25 Abr");
  });
});
