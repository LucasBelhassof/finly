import { describe, expect, it } from "vitest";

import { buildDashboardSummaryCards } from "./dashboard-summary.js";

describe("buildDashboardSummaryCards", () => {
  it("builds the dashboard cards from current balances and monthly transaction totals", () => {
    const cards = buildDashboardSummaryCards({
      currentBalance: 10000,
      currentIncome: 5000,
      currentExpenses: 1200,
      previousIncome: 4000,
      previousExpenses: 1000,
    });

    expect(cards).toEqual([
      {
        label: "Saldo Total",
        value: 10000,
        formattedValue: "R$ 10.000,00",
        change: "+61,3%",
        positive: true,
        description: "vs mes anterior",
      },
      {
        label: "Receitas",
        value: 5000,
        formattedValue: "R$ 5.000,00",
        change: "+25,0%",
        positive: true,
        description: "vs mes anterior",
      },
      {
        label: "Despesas",
        value: 1200,
        formattedValue: "R$ 1.200,00",
        change: "+20,0%",
        positive: false,
        description: "vs mes anterior",
      },
    ]);
  });

  it("returns zeroed cards when there is no current or previous month activity", () => {
    const cards = buildDashboardSummaryCards({
      currentBalance: 0,
      currentIncome: 0,
      currentExpenses: 0,
      previousIncome: 0,
      previousExpenses: 0,
    });

    expect(cards).toEqual([
      {
        label: "Saldo Total",
        value: 0,
        formattedValue: "R$ 0,00",
        change: "0,0%",
        positive: true,
        description: "vs mes anterior",
      },
      {
        label: "Receitas",
        value: 0,
        formattedValue: "R$ 0,00",
        change: "0,0%",
        positive: true,
        description: "vs mes anterior",
      },
      {
        label: "Despesas",
        value: 0,
        formattedValue: "R$ 0,00",
        change: "0,0%",
        positive: false,
        description: "vs mes anterior",
      },
    ]);
  });

  it("derives the previous balance from the current balance and current month net movement", () => {
    const cards = buildDashboardSummaryCards({
      currentBalance: 3000,
      currentIncome: 1000,
      currentExpenses: 400,
      previousIncome: 900,
      previousExpenses: 500,
    });

    expect(cards[0]).toMatchObject({
      label: "Saldo Total",
      value: 3000,
      change: "+25,0%",
      positive: true,
    });
    expect(cards[1]).toMatchObject({
      label: "Receitas",
      change: "+11,1%",
      positive: true,
    });
    expect(cards[2]).toMatchObject({
      label: "Despesas",
      change: "-20,0%",
      positive: false,
    });
  });
});
