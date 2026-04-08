import { describe, expect, it } from "vitest";

import { getFilteredTransactionsData } from "@/hooks/use-filtered-transactions-data";

const categories = [
  { id: 1, groupLabel: "Alimentacao", groupColor: "bg-warning" },
  { id: 2, groupLabel: "Transporte", groupColor: "bg-info" },
];

const transactions = [
  {
    id: 1,
    description: "iFood",
    amount: -67.9,
    occurredOn: "2026-04-06",
    category: { label: "Restaurantes", groupLabel: "Alimentacao", groupColor: "bg-warning" },
  },
  {
    id: 2,
    description: "Uber",
    amount: -23.5,
    occurredOn: "2026-04-05",
    category: { label: "Transporte", groupLabel: "Transporte", groupColor: "bg-info" },
  },
  {
    id: 3,
    description: "Salario",
    amount: 6500,
    occurredOn: "2026-03-20",
    category: { label: "Salario", groupLabel: "Receitas", groupColor: "bg-income" },
  },
];

describe("getFilteredTransactionsData", () => {
  it("derives list, cards and category counts from the same subset", () => {
    const result = getFilteredTransactionsData(transactions as never[], categories as never[], {
      search: "",
      typeFilter: "expense",
      categoryFilter: "all",
      range: {
        startDate: "2026-04-01",
        endDate: "2026-04-06",
      },
    });

    expect(result.filteredTransactions).toHaveLength(2);
    expect(result.summaryCardsData.totalIncomes).toBe(0);
    expect(result.summaryCardsData.totalExpenses).toBe(91.4);
    expect(result.categoryCounts.find((item) => item.label === "Alimentacao")?.count).toBe(1);
    expect(result.categoryCounts.find((item) => item.label === "Transporte")?.count).toBe(1);
  });

  it("applies search and category after period filtering", () => {
    const result = getFilteredTransactionsData(transactions as never[], categories as never[], {
      search: "uber",
      typeFilter: "all",
      categoryFilter: "Transporte",
      range: {
        startDate: "2026-04-01",
        endDate: "2026-04-06",
      },
    });

    expect(result.filteredTransactions).toHaveLength(1);
    expect(result.filteredTransactions[0].description).toBe("Uber");
    expect(result.categoryCounts.find((item) => item.label === "Transporte")?.count).toBe(1);
  });
});
