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

function normalizeOverviewFilters(filters = {}) {
  const status =
    filters.status === "active" || filters.status === "paid" || filters.status === "overdue" ? filters.status : "all";
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
    status,
    installmentAmountMin: normalizeNumberFilter(filters.installmentAmountMin),
    installmentAmountMax: normalizeNumberFilter(filters.installmentAmountMax),
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

function buildOverviewItem(group, referenceDate) {
  const referenceMonthStart = getMonthStart(referenceDate);
  const rows = [...group.transactions].sort((left, right) => {
    const leftNumber = Number(left.installmentNumber ?? 0);
    const rightNumber = Number(right.installmentNumber ?? 0);

    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return String(left.occurredOn ?? "").localeCompare(String(right.occurredOn ?? ""));
  });

  const remainingRows = referenceMonthStart ? rows.filter((row) => String(row.occurredOn) >= referenceMonthStart) : rows;
  const installmentCount = Number(group.installmentCount);
  const installmentAmount = roundCurrency(group.installmentAmount);
  const totalAmount = roundCurrency(installmentAmount * installmentCount);
  const remainingInstallments = Math.max(remainingRows.length, 0);
  const currentInstallment = remainingRows[0]?.installmentNumber ?? installmentCount;
  const nextDueDate =
    remainingRows.length > 0 ? deriveNextDueDate(remainingRows[0]?.occurredOn, group.statementDueDay) : null;

  let status = "active";

  if (remainingInstallments === 0) {
    status = "paid";
  } else if (nextDueDate && normalizeDateOnly(referenceDate) && nextDueDate < normalizeDateOnly(referenceDate)) {
    status = "overdue";
  }

  return {
    transaction_id: remainingRows[0]?.transactionId ?? rows.at(-1)?.transactionId ?? group.installmentPurchaseId,
    installment_purchase_id: group.installmentPurchaseId,
    description: group.description,
    category: group.category,
    category_id: group.categoryId,
    card_id: group.cardId,
    card_name: group.cardName,
    purchase_date: group.purchaseDate,
    total_amount: totalAmount,
    installment_amount: installmentAmount,
    installment_count: installmentCount,
    current_installment: currentInstallment,
    remaining_installments: remainingInstallments,
    remaining_balance: roundCurrency(installmentAmount * remainingInstallments),
    next_due_date: nextDueDate,
    status,
    __remainingRows: remainingRows,
  };
}

function buildItems(rows, referenceDate) {
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
        transactions: [],
      });
    }

    if (row.transactionId) {
      grouped.get(row.installmentPurchaseId).transactions.push({
        transactionId: row.transactionId,
        occurredOn: normalizeDateOnly(row.occurredOn),
        installmentNumber: Number.isInteger(Number(row.installmentNumber)) ? Number(row.installmentNumber) : null,
      });
    }
  });

  return Array.from(grouped.values())
    .filter((item) => item.installmentCount >= 2)
    .map((item) => buildOverviewItem(item, referenceDate));
}

function applyFilters(items, filters) {
  return items.filter((item) => {
    if (filters.cardId !== "all" && String(item.card_id) !== filters.cardId) {
      return false;
    }

    if (filters.categoryId !== "all" && String(item.category_id) !== filters.categoryId) {
      return false;
    }

    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    if (filters.installmentAmountMin !== null && item.installment_amount < filters.installmentAmountMin) {
      return false;
    }

    if (filters.installmentAmountMax !== null && item.installment_amount > filters.installmentAmountMax) {
      return false;
    }

    if (filters.purchaseStart && String(item.purchase_date) < filters.purchaseStart) {
      return false;
    }

    if (filters.purchaseEnd && String(item.purchase_date) > filters.purchaseEnd) {
      return false;
    }

    return true;
  });
}

function createProjectionMonths(referenceDate, count) {
  const monthStart = getMonthStart(referenceDate);

  if (!monthStart) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => addMonthsClamped(monthStart, index)).filter(Boolean);
}

function buildMonthlyProjection(items, referenceDate, count) {
  const monthStarts = createProjectionMonths(referenceDate, count);

  return monthStarts.map((monthStart) => {
    const monthKey = getMonthKey(monthStart);
    const amount = items.reduce((sum, item) => {
      const monthlyAmount = item.__remainingRows.some((row) => getMonthKey(row.occurredOn) === monthKey) ? item.installment_amount : 0;
      return sum + monthlyAmount;
    }, 0);

    return {
      month: monthKey,
      amount: roundCurrency(amount),
    };
  });
}

function buildMonthlyEvolution(items, referenceDate) {
  const monthKeys = items
    .flatMap((item) => item.__remainingRows.map((row) => getMonthKey(row.occurredOn)))
    .filter(Boolean)
    .sort();
  const firstMonth = getMonthStart(referenceDate);
  const lastMonth = monthKeys.at(-1);

  if (!firstMonth) {
    return [];
  }

  const totalMonths = lastMonth
    ? Math.max(
        3,
        Math.min(
          6,
          getMonthDifference(firstMonth, `${lastMonth}-01`) + 1,
        ),
      )
    : 3;

  return buildMonthlyProjection(items, referenceDate, totalMonths);
}

function buildCardDistribution(items, monthlyCommitment) {
  const grouped = new Map();

  items
    .filter((item) => item.status !== "paid")
    .forEach((item) => {
      const current = grouped.get(item.card_id) ?? {
        card_id: item.card_id,
        card_name: item.card_name,
        amount: 0,
      };

      current.amount = roundCurrency(current.amount + item.installment_amount);
      grouped.set(item.card_id, current);
    });

  return Array.from(grouped.values())
    .sort((left, right) => right.amount - left.amount)
    .map((item) => ({
      ...item,
      share_ratio: monthlyCommitment > 0 ? Number((item.amount / monthlyCommitment).toFixed(4)) : 0,
    }));
}

function buildTopCategories(items) {
  const grouped = new Map();

  items
    .filter((item) => item.status !== "paid")
    .forEach((item) => {
      const current = grouped.get(item.category_id) ?? {
        category_id: item.category_id,
        category: item.category,
        amount: 0,
      };

      current.amount = roundCurrency(current.amount + item.installment_amount);
      grouped.set(item.category_id, current);
    });

  return Array.from(grouped.values())
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
}

function buildFilterOptions(items) {
  const cards = Array.from(new Map(items.map((item) => [String(item.card_id), { id: item.card_id, name: item.card_name }])).values()).sort(
    (left, right) => left.name.localeCompare(right.name, "pt-BR"),
  );
  const categories = Array.from(
    new Map(items.map((item) => [String(item.category_id), { id: item.category_id, label: item.category }])).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  const installmentAmounts = items.map((item) => item.installment_amount);

  return {
    cards,
    categories,
    statuses: ["active", "paid", "overdue"],
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

    return String(right.purchase_date).localeCompare(String(left.purchase_date));
  };

  const sorted = [...items].sort(compare);
  return filters.sortOrder === "asc" && filters.sortBy !== "smart" ? sorted : filters.sortOrder === "asc" ? [...sorted].reverse() : sorted;
}

export function buildInstallmentsOverviewResponse(rows, rawFilters = {}, referenceDate = new Date().toISOString().slice(0, 10)) {
  const filters = normalizeOverviewFilters(rawFilters);
  const allItems = buildItems(rows, referenceDate);
  const filteredItems = sortItems(applyFilters(allItems, filters), filters);
  const activeItems = filteredItems.filter((item) => item.status !== "paid");
  const monthlyCommitment = roundCurrency(activeItems.reduce((sum, item) => sum + item.installment_amount, 0));
  const cardDistribution = buildCardDistribution(filteredItems, monthlyCommitment);
  const payoffProjectionMonth = activeItems
    .flatMap((item) => item.__remainingRows.map((row) => getMonthKey(row.occurredOn)))
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const concentrationCard = cardDistribution[0] ?? null;

  return {
    applied_filters: filters,
    active_installments_count: activeItems.length,
    monthly_commitment: monthlyCommitment,
    remaining_balance_total: roundCurrency(filteredItems.reduce((sum, item) => sum + item.remaining_balance, 0)),
    original_amount_total: roundCurrency(filteredItems.reduce((sum, item) => sum + item.total_amount, 0)),
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
      next_3_months_projection: buildMonthlyProjection(filteredItems, referenceDate, 3),
      monthly_commitment_evolution: buildMonthlyEvolution(filteredItems, referenceDate),
      card_distribution: cardDistribution,
      top_categories: buildTopCategories(filteredItems),
    },
    filter_options: buildFilterOptions(allItems),
    items: filteredItems.map(({ __remainingRows, ...item }) => item),
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
