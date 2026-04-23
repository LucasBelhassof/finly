const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function parseNumeric(value) {
  return Number.parseFloat(value ?? 0);
}

function formatCurrency(value) {
  return currencyFormatter.format(parseNumeric(value));
}

function formatPercentageChange(currentValue, previousValue) {
  const current = parseNumeric(currentValue);
  const previous = parseNumeric(previousValue);

  if (!previous) {
    return {
      raw: 0,
      formatted: "0,0%",
      positive: true,
    };
  }

  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const absolute = numberFormatter.format(Math.abs(raw));

  return {
    raw,
    formatted: `${raw >= 0 ? "+" : "-"}${absolute}%`,
    positive: raw >= 0,
  };
}

export function resolveDashboardCurrentBalance({
  currentBalance,
  fallbackBalance = 0,
  hasConfiguredBalance = false,
}) {
  const parsedCurrentBalance = parseNumeric(currentBalance);
  const parsedFallbackBalance = parseNumeric(fallbackBalance);

  if (hasConfiguredBalance) {
    return parsedCurrentBalance;
  }

  if (parsedCurrentBalance !== 0) {
    return parsedCurrentBalance;
  }

  return parsedFallbackBalance;
}

export function buildDashboardSummaryCards(metrics) {
  const currentBalance = resolveDashboardCurrentBalance({
    currentBalance: metrics.currentBalance,
    fallbackBalance: metrics.fallbackBalance,
    hasConfiguredBalance: Boolean(metrics.hasConfiguredBalance),
  });
  const currentIncome = parseNumeric(metrics.currentIncome);
  const currentExpenses = parseNumeric(metrics.currentExpenses);
  const previousIncome = parseNumeric(metrics.previousIncome);
  const previousExpenses = parseNumeric(metrics.previousExpenses);
  const previousBalance = currentBalance - currentIncome + currentExpenses;

  const balanceChange = formatPercentageChange(currentBalance, previousBalance);
  const incomeChange = formatPercentageChange(currentIncome, previousIncome);
  const expenseChange = formatPercentageChange(currentExpenses, previousExpenses);

  return [
    {
      label: "Saldo Total",
      value: currentBalance,
      formattedValue: formatCurrency(currentBalance),
      change: balanceChange.formatted,
      positive: balanceChange.positive,
      description: "vs mes anterior",
    },
    {
      label: "Receitas",
      value: currentIncome,
      formattedValue: formatCurrency(currentIncome),
      change: incomeChange.formatted,
      positive: incomeChange.positive,
      description: "vs mes anterior",
    },
    {
      label: "Despesas",
      value: currentExpenses,
      formattedValue: formatCurrency(currentExpenses),
      change: expenseChange.formatted,
      positive: false,
      description: "vs mes anterior",
    },
  ];
}
