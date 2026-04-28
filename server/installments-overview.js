const CONCENTRATION_THRESHOLD_RATIO = 0.5;

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeDateOnly(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function parseDateOnly(value) {
  const normalized = normalizeDateOnly(value);

  if (!normalized) {
    return null;
  }

  return new Date(`${normalized}T12:00:00Z`);
}

function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

function getMonthStart(value) {
  const date = parseDateOnly(value);

  if (!date) {
    return null;
  }

  return toDateOnlyString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12)));
}

function getMonthKey(value) {
  return normalizeDateOnly(value)?.slice(0, 7) ?? null;
}

function addMonthsClamped(value, months) {
  const date = parseDateOnly(value);

  if (!date) {
    return null;
  }

  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;
  const originalDay = date.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 12)).getUTCDate();
  const nextDate = new Date(Date.UTC(targetYear, targetMonth, Math.min(originalDay, lastDayOfMonth), 12));

  return toDateOnlyString(nextDate);
}

function setDayOfMonthClamped(value, day) {
  const date = parseDateOnly(value);

  if (!date) {
    return null;
  }

  const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
  const clampedDay = Math.max(1, Math.min(Number(day), lastDayOfMonth));

  return toDateOnlyString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), clampedDay, 12)));
}

function getMonthDifference(startValue, endValue) {
  const startDate = parseDateOnly(startValue);
  const endDate = parseDateOnly(endValue);

  if (!startDate || !endDate) {
    return 0;
  }

  return (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (endDate.getUTCMonth() - startDate.getUTCMonth());
}

function compareNullableDates(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left.localeCompare(right);
}

function normalizeNumberFilter(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSearchFilter(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value) {
  return String(value ?? "").toLocaleLowerCase("pt-BR");
}

function normalizeOverviewFilters(filters = {}) {
  const status =
    filters.status === "active" || filters.status === "paid" || filters.status === "overdue" ? filters.status : "all";
  const installmentCountMode =
    filters.installmentCountMode === "installment_count" || filters.installmentCountMode === "remaining_installments"
      ? filters.installmentCountMode
      : "all";
  const sortBy =
    filters.sortBy === "installment_amount" ||
    filters.sortBy === "remaining_balance" ||
    filters.sortBy === "next_due_date" ||
    filters.sortBy === "purchase_date"
      ? filters.sortBy
      : "smart";
  const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";

  return {
    cardId: filters.cardId && String(filters.cardId) !== "all" ? String(filters.cardId) : "all",
    categoryId: filters.categoryId && String(filters.categoryId) !== "all" ? String(filters.categoryId) : "all",
    search: normalizeSearchFilter(filters.search),
    status,
    installmentAmountMin: normalizeNumberFilter(filters.installmentAmountMin),
    installmentAmountMax: normalizeNumberFilter(filters.installmentAmountMax),
    installmentCountMode,
    installmentCountValue: normalizeNumberFilter(filters.installmentCountValue),
    purchaseStart: normalizeDateOnly(filters.purchaseStart),
    purchaseEnd: normalizeDateOnly(filters.purchaseEnd),
    sortBy,
    sortOrder,
  };
}

function deriveNextDueDate(occurredOn, statementDueDay) {
  const normalizedOccurredOn = normalizeDateOnly(occurredOn);

  if (!normalizedOccurredOn) {
    return null;
  }

  if (statementDueDay === null || statementDueDay === undefined || !Number.isInteger(Number(statementDueDay)) || Number(statementDueDay) < 1) {
    return normalizedOccurredOn;
  }

  let dueDate = setDayOfMonthClamped(normalizedOccurredOn, Number(statementDueDay));

  if (dueDate && dueDate < normalizedOccurredOn) {
    dueDate = addMonthsClamped(dueDate, 1);
  }

  return dueDate;
}

function isPeriodFilterActive(filters) {
  return Boolean(filters.purchaseStart || filters.purchaseEnd);
}

function isRowInPeriod(row, filters) {
  if (filters.purchaseStart && row.occurredOn < filters.purchaseStart) {
    return false;
  }

  if (filters.purchaseEnd && row.occurredOn > filters.purchaseEnd) {
    return false;
  }

  return true;
}

function groupRows(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!grouped.has(row.installmentPurchaseId)) {
      grouped.set(row.installmentPurchaseId, {
        installmentPurchaseId: row.installmentPurchaseId,
        description: row.descriptionBase,
        category: row.categoryLabel,
        categoryId: row.categoryId,
        cardId: row.cardId,
        cardName: row.cardName,
        purchaseDate: normalizeDateOnly(row.purchaseDate),
        installmentCount: Number(row.installmentCount),
        installmentAmount: roundCurrency(row.installmentAmount),
        statementDueDay: Number.isInteger(Number(row.statementDueDay)) ? Number(row.statementDueDay) : null,
        rows: [],
      });
    }

    if (row.transactionId) {
      grouped.get(row.installmentPurchaseId).rows.push({
        transactionId: row.transactionId,
        occurredOn: normalizeDateOnly(row.occurredOn),
        installmentNumber: Number.isInteger(Number(row.installmentNumber)) ? Number(row.installmentNumber) : null,
      });
    }
  });

  return Array.from(grouped.values())
    .filter((purchase) => purchase.installmentCount >= 2)
    .map((purchase) => ({
      ...purchase,
      rows: [...purchase.rows].sort((left, right) => {
        if ((left.installmentNumber ?? 0) !== (right.installmentNumber ?? 0)) {
          return (left.installmentNumber ?? 0) - (right.installmentNumber ?? 0);
        }

        return String(left.occurredOn ?? "").localeCompare(String(right.occurredOn ?? ""));
      }),
    }));
}

function enrichPurchase(purchase, referenceDate) {
  const referenceMonthStart = getMonthStart(referenceDate);
  const remainingRows = referenceMonthStart ? purchase.rows.filter((row) => row.occurredOn >= referenceMonthStart) : purchase.rows;
  const anchorRow = remainingRows[0] ?? null;
  const remainingInstallments = Math.max(remainingRows.length, 0);
  const nextDueDate = anchorRow ? deriveNextDueDate(anchorRow.occurredOn, purchase.statementDueDay) : null;

  let status = "active";

  if (remainingInstallments === 0) {
    status = "paid";
  } else if (nextDueDate && normalizeDateOnly(referenceDate) && nextDueDate < normalizeDateOnly(referenceDate)) {
    status = "overdue";
  }

  return {
    ...purchase,
    totalAmount: roundCurrency(purchase.installmentAmount * purchase.installmentCount),
    remainingRows,
    remainingInstallments,
    remainingBalance: roundCurrency(purchase.installmentAmount * remainingInstallments),
    anchorRow,
    nextDueDate,
    status,
  };
}

function matchesPurchaseFilters(purchase, filters) {
  if (filters.cardId !== "all" && String(purchase.cardId) !== filters.cardId) {
    return false;
  }

  if (filters.categoryId !== "all" && String(purchase.categoryId) !== filters.categoryId) {
    return false;
  }

  if (filters.search) {
    const searchTerm = normalizeText(filters.search);
    const searchableFields = [purchase.description, purchase.cardName, purchase.category].map(normalizeText);

    if (!searchableFields.some((field) => field.includes(searchTerm))) {
      return false;
    }
  }

  if (filters.status !== "all" && purchase.status !== filters.status) {
    return false;
  }

  if (filters.installmentAmountMin !== null && purchase.installmentAmount < filters.installmentAmountMin) {
    return false;
  }

  if (filters.installmentAmountMax !== null && purchase.installmentAmount > filters.installmentAmountMax) {
    return false;
  }

  if (filters.installmentCountMode === "installment_count" && filters.installmentCountValue !== null && purchase.installmentCount !== filters.installmentCountValue) {
    return false;
  }

  if (
    filters.installmentCountMode === "remaining_installments" &&
    filters.installmentCountValue !== null &&
    purchase.remainingInstallments !== filters.installmentCountValue
  ) {
    return false;
  }

  return true;
}

function deriveDisplayRowStatus(row, purchase, referenceDate) {
  const dueDate = deriveNextDueDate(row.occurredOn, purchase.statementDueDay);

  if (purchase.status === "paid") {
    return "paid";
  }

  if (dueDate && normalizeDateOnly(referenceDate) && dueDate < normalizeDateOnly(referenceDate)) {
    return "overdue";
  }

  return "active";
}

function buildDisplayItemFromRow(purchase, row, referenceDate) {
  const remainingRowsFromDisplay = purchase.rows.filter((candidate) => (candidate.installmentNumber ?? 0) >= (row.installmentNumber ?? 0));
  const installmentDueDate = deriveNextDueDate(row.occurredOn, purchase.statementDueDay);

  return {
    transaction_id: row.transactionId,
    installment_transaction_id: row.transactionId,
    installment_purchase_id: purchase.installmentPurchaseId,
    description: purchase.description,
    category: purchase.category,
    category_id: purchase.categoryId,
    card_id: purchase.cardId,
    card_name: purchase.cardName,
    purchase_date: purchase.purchaseDate,
    total_amount: purchase.totalAmount,
    installment_amount: purchase.installmentAmount,
    installment_count: purchase.installmentCount,
    current_installment: row.installmentNumber ?? purchase.installmentCount,
    display_installment_number: row.installmentNumber ?? purchase.installmentCount,
    remaining_installments: Math.max(remainingRowsFromDisplay.length, 0),
    remaining_balance: roundCurrency(purchase.installmentAmount * Math.max(remainingRowsFromDisplay.length, 0)),
    next_due_date: installmentDueDate,
    installment_due_date: installmentDueDate,
    installment_month: getMonthKey(row.occurredOn),
    status: deriveDisplayRowStatus(row, purchase, referenceDate),
  };
}

function buildDefaultDisplayItem(purchase) {
  return {
    transaction_id: purchase.anchorRow?.transactionId ?? purchase.rows.at(-1)?.transactionId ?? purchase.installmentPurchaseId,
    installment_transaction_id: purchase.anchorRow?.transactionId ?? null,
    installment_purchase_id: purchase.installmentPurchaseId,
    description: purchase.description,
    category: purchase.category,
    category_id: purchase.categoryId,
    card_id: purchase.cardId,
    card_name: purchase.cardName,
    purchase_date: purchase.purchaseDate,
    total_amount: purchase.totalAmount,
    installment_amount: purchase.installmentAmount,
    installment_count: purchase.installmentCount,
    current_installment: purchase.anchorRow?.installmentNumber ?? purchase.installmentCount,
    display_installment_number: purchase.anchorRow?.installmentNumber ?? purchase.installmentCount,
    remaining_installments: purchase.remainingInstallments,
    remaining_balance: purchase.remainingBalance,
    next_due_date: purchase.nextDueDate,
    installment_due_date: purchase.nextDueDate,
    installment_month: getMonthKey(purchase.anchorRow?.occurredOn ?? purchase.rows.at(-1)?.occurredOn),
    status: purchase.status,
  };
}

function buildSelectedPurchases(purchases, filters, referenceDate) {
  const periodActive = isPeriodFilterActive(filters);

  return purchases
    .map((purchase) => enrichPurchase(purchase, referenceDate))
    .filter((purchase) => matchesPurchaseFilters(purchase, filters))
    .map((purchase) => {
      const periodRows = periodActive ? purchase.rows.filter((row) => isRowInPeriod(row, filters)) : [];
      return {
        ...purchase,
        periodRows,
      };
    })
    .filter((purchase) => !periodActive || purchase.periodRows.length > 0);
}

function buildDisplayItems(selectedPurchases, filters, referenceDate) {
  const periodActive = isPeriodFilterActive(filters);

  if (!periodActive) {
    return selectedPurchases.map(buildDefaultDisplayItem);
  }

  return selectedPurchases.flatMap((purchase) => purchase.periodRows.map((row) => buildDisplayItemFromRow(purchase, row, referenceDate)));
}

function buildProjectionMonths(baseDate, count) {
  const monthStart = getMonthStart(baseDate);

  if (!monthStart) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => addMonthsClamped(monthStart, index)).filter(Boolean);
}

function buildMonthlyRowsSource(selectedPurchases, filters, referenceDate, options = {}) {
  const includeFutureProjection = Boolean(options.includeFutureProjection);

  if (isPeriodFilterActive(filters) && !includeFutureProjection) {
    return selectedPurchases.flatMap((purchase) =>
      purchase.periodRows.map((row) => ({
        month: getMonthKey(row.occurredOn),
        amount: purchase.installmentAmount,
        cardId: purchase.cardId,
        cardName: purchase.cardName,
        categoryId: purchase.categoryId,
        category: purchase.category,
      })),
    );
  }

  return selectedPurchases
    .filter((purchase) => purchase.status !== "paid")
    .flatMap((purchase) =>
      purchase.remainingRows.map((row) => ({
        month: getMonthKey(row.occurredOn),
        amount: purchase.installmentAmount,
        cardId: purchase.cardId,
        cardName: purchase.cardName,
        categoryId: purchase.categoryId,
        category: purchase.category,
      })),
    );
}

function buildGroupedAmountSeries(entries, monthOrder = null) {
  const grouped = new Map();

  entries.forEach((entry) => {
    const key = entry.month;
    const current = grouped.get(key) ?? 0;
    grouped.set(key, roundCurrency(current + entry.amount));
  });

  const months = monthOrder ?? Array.from(grouped.keys()).sort();

  return months.map((month) => ({
    month,
    amount: roundCurrency(grouped.get(month) ?? 0),
  }));
}

function buildMonthlyProjection(selectedPurchases, filters, referenceDate, count) {
  const entries = buildMonthlyRowsSource(selectedPurchases, filters, referenceDate, { includeFutureProjection: true });
  const baseDate = filters.purchaseStart ?? referenceDate;
  const monthStarts = buildProjectionMonths(baseDate, count);
  const monthKeys = monthStarts.map(getMonthKey).filter(Boolean);

  return buildGroupedAmountSeries(entries, monthKeys);
}

function buildMonthlyEvolution(selectedPurchases, filters, referenceDate) {
  const entries = buildMonthlyRowsSource(selectedPurchases, filters, referenceDate);

  if (!entries.length) {
    return [];
  }

  if (isPeriodFilterActive(filters)) {
    return buildGroupedAmountSeries(entries);
  }

  const firstMonth = getMonthStart(referenceDate);
  const lastMonth = [...new Set(entries.map((entry) => entry.month))].sort().at(-1);

  if (!firstMonth || !lastMonth) {
    return [];
  }

  const totalMonths = Math.max(3, Math.min(6, getMonthDifference(firstMonth, `${lastMonth}-01`) + 1));
  return buildMonthlyProjection(selectedPurchases, filters, referenceDate, totalMonths);
}

function buildCardDistribution(selectedPurchases, filters, referenceDate, monthlyCommitment) {
  const entries = buildMonthlyRowsSource(selectedPurchases, filters, referenceDate);
  const grouped = new Map();

  entries.forEach((entry) => {
    const current = grouped.get(entry.cardId) ?? {
      card_id: entry.cardId,
      card_name: entry.cardName,
      amount: 0,
    };

    current.amount = roundCurrency(current.amount + entry.amount);
    grouped.set(entry.cardId, current);
  });

  return Array.from(grouped.values())
    .sort((left, right) => right.amount - left.amount)
    .map((entry) => ({
      ...entry,
      share_ratio: monthlyCommitment > 0 ? Number((entry.amount / monthlyCommitment).toFixed(4)) : 0,
    }));
}

function buildTopCategories(selectedPurchases, filters, referenceDate) {
  const entries = buildMonthlyRowsSource(selectedPurchases, filters, referenceDate);
  const grouped = new Map();

  entries.forEach((entry) => {
    const current = grouped.get(entry.categoryId) ?? {
      category_id: entry.categoryId,
      category: entry.category,
      amount: 0,
    };

    current.amount = roundCurrency(current.amount + entry.amount);
    grouped.set(entry.categoryId, current);
  });

  return Array.from(grouped.values())
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
}

function buildFilterOptions(purchases, referenceDate) {
  const cards = Array.from(new Map(purchases.map((purchase) => [String(purchase.cardId), { id: purchase.cardId, name: purchase.cardName }])).values()).sort(
    (left, right) => left.name.localeCompare(right.name, "pt-BR"),
  );
  const categories = Array.from(
    new Map(purchases.map((purchase) => [String(purchase.categoryId), { id: purchase.categoryId, label: purchase.category }])).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  const installmentAmounts = purchases.map((purchase) => purchase.installmentAmount);
  const installmentCountValues = Array.from(new Set(purchases.map((purchase) => purchase.installmentCount)))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const remainingInstallmentValues = Array.from(
    new Set(purchases.map((purchase) => enrichPurchase(purchase, referenceDate).remainingInstallments)),
  )
    .filter((value) => value > 0)
    .sort((left, right) => left - right);

  return {
    cards,
    categories,
    statuses: ["active", "paid", "overdue"],
    installment_count_values: installmentCountValues,
    remaining_installment_values: remainingInstallmentValues,
    installment_amount_range: {
      min: installmentAmounts.length ? Math.min(...installmentAmounts) : 0,
      max: installmentAmounts.length ? Math.max(...installmentAmounts) : 0,
    },
  };
}

function sortItems(items, filters) {
  const compare = (left, right) => {
    if (filters.sortBy === "installment_amount") {
      return left.installment_amount - right.installment_amount;
    }

    if (filters.sortBy === "remaining_balance") {
      return left.remaining_balance - right.remaining_balance;
    }

    if (filters.sortBy === "next_due_date") {
      return compareNullableDates(left.next_due_date, right.next_due_date);
    }

    if (filters.sortBy === "purchase_date") {
      return String(left.purchase_date).localeCompare(String(right.purchase_date));
    }

    const leftPaidRank = left.status === "paid" ? 1 : 0;
    const rightPaidRank = right.status === "paid" ? 1 : 0;

    if (leftPaidRank !== rightPaidRank) {
      return leftPaidRank - rightPaidRank;
    }

    if (left.installment_amount !== right.installment_amount) {
      return right.installment_amount - left.installment_amount;
    }

    if (left.remaining_balance !== right.remaining_balance) {
      return right.remaining_balance - left.remaining_balance;
    }

    const dueDateComparison = compareNullableDates(left.next_due_date, right.next_due_date);

    if (dueDateComparison !== 0) {
      return dueDateComparison;
    }

    if (String(right.installment_month ?? "") !== String(left.installment_month ?? "")) {
      return String(right.installment_month ?? "").localeCompare(String(left.installment_month ?? ""));
    }

    return String(right.purchase_date).localeCompare(String(left.purchase_date));
  };

  const sorted = [...items].sort(compare);
  return filters.sortOrder === "asc" && filters.sortBy !== "smart" ? sorted : filters.sortOrder === "asc" ? [...sorted].reverse() : sorted;
}

export function buildInstallmentsOverviewResponse(rows, rawFilters = {}, referenceDate = new Date().toISOString().slice(0, 10)) {
  const filters = normalizeOverviewFilters(rawFilters);
  const purchases = groupRows(rows);
  const selectedPurchases = buildSelectedPurchases(purchases, filters, referenceDate);
  const items = sortItems(buildDisplayItems(selectedPurchases, filters, referenceDate), filters);
  const periodActive = isPeriodFilterActive(filters);
  const monthlyCommitment = roundCurrency(
    periodActive
      ? items.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.installment_amount, 0)
      : selectedPurchases.filter((purchase) => purchase.status !== "paid").reduce((sum, purchase) => sum + purchase.installmentAmount, 0),
  );
  const remainingBalanceTotal = roundCurrency(
    selectedPurchases.reduce((sum, purchase) => {
      if (!periodActive) {
        return sum + purchase.remainingBalance;
      }

      const firstPeriodRow = purchase.periodRows[0];

      if (!firstPeriodRow) {
        return sum;
      }

      const remainingFromDisplay = purchase.rows.filter(
        (row) => (row.installmentNumber ?? 0) >= (firstPeriodRow.installmentNumber ?? 0),
      ).length;

      return sum + roundCurrency(purchase.installmentAmount * remainingFromDisplay);
    }, 0),
  );
  const originalAmountTotal = roundCurrency(selectedPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0));
  const cardDistribution = buildCardDistribution(selectedPurchases, filters, referenceDate, monthlyCommitment);
  const activeInstallmentsCount = selectedPurchases.filter((purchase) => purchase.status !== "paid").length;
  const payoffProjectionMonth =
    selectedPurchases
      .flatMap((purchase) => {
        if (periodActive) {
          return purchase.periodRows.map((row) => getMonthKey(row.occurredOn));
        }

        return purchase.remainingRows.map((row) => getMonthKey(row.occurredOn));
      })
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  const concentrationCard = cardDistribution[0] ?? null;

  return {
    applied_filters: filters,
    active_installments_count: activeInstallmentsCount,
    monthly_commitment: monthlyCommitment,
    remaining_balance_total: remainingBalanceTotal,
    original_amount_total: originalAmountTotal,
    payoff_projection_month: payoffProjectionMonth,
    alerts: {
      concentration: {
        threshold_ratio: CONCENTRATION_THRESHOLD_RATIO,
        triggered: Boolean(concentrationCard && concentrationCard.share_ratio > CONCENTRATION_THRESHOLD_RATIO),
        card_id: concentrationCard?.card_id ?? null,
        card_name: concentrationCard?.card_name ?? null,
        share_ratio: concentrationCard?.share_ratio ?? 0,
        monthly_amount: concentrationCard?.amount ?? 0,
      },
    },
    charts: {
      next_3_months_projection: buildMonthlyProjection(selectedPurchases, filters, referenceDate, 3),
      monthly_commitment_evolution: buildMonthlyEvolution(selectedPurchases, filters, referenceDate),
      card_distribution: cardDistribution,
      top_categories: buildTopCategories(selectedPurchases, filters, referenceDate),
    },
    filter_options: buildFilterOptions(purchases, referenceDate),
    items,
  };
}

export function buildInstallmentsConsistencyChecks(rows, rawFilters = {}, referenceDate = new Date().toISOString().slice(0, 10)) {
  const overview = buildInstallmentsOverviewResponse(rows, rawFilters, referenceDate);

  return {
    invalid_installment_count_items: overview.items.filter((item) => item.installment_count < 2).length,
    invalid_remaining_installments_items: overview.items.filter((item) => item.remaining_installments < 0).length,
    invalid_remaining_balance_items: overview.items.filter((item) => item.remaining_balance < 0).length,
  };
}

export { CONCENTRATION_THRESHOLD_RATIO, deriveNextDueDate, normalizeOverviewFilters, roundCurrency };
