import { useMemo } from "react";

import { isDateInRange } from "@/lib/transactions-date-filter";
import type { CategoryItem, TransactionItem } from "@/types/api";

export type TransactionsTypeFilter = "all" | "income" | "expense";

export type TransactionsDerivedFilters = {
  categoryFilter: string;
  range: {
    startDate: string;
    endDate: string;
  };
  search: string;
  typeFilter: TransactionsTypeFilter;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getFilteredTransactionsData(
  transactions: TransactionItem[],
  categories: CategoryItem[],
  filters: TransactionsDerivedFilters,
) {
  const normalizedSearch = normalizeText(filters.search);

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesDate = isDateInRange(transaction.occurredOn, filters.range);
    const matchesType =
      filters.typeFilter === "all" ||
      (filters.typeFilter === "income" ? transaction.amount > 0 : transaction.amount < 0);
    const matchesCategory =
      filters.categoryFilter === "all" || String(transaction.category.id) === filters.categoryFilter;
    const matchesSearch =
      !normalizedSearch ||
      normalizeText(transaction.description).includes(normalizedSearch) ||
      normalizeText(transaction.category.groupLabel).includes(normalizedSearch) ||
      normalizeText(transaction.category.label).includes(normalizedSearch);

    return matchesDate && matchesType && matchesCategory && matchesSearch;
  });

  const totalIncomes = filteredTransactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const groupedMap = new Map<string, { id: string; label: string; color: string; count: number }>();

  filteredTransactions.forEach((transaction) => {
    const categoryKey = String(transaction.category.id);
    const current = groupedMap.get(categoryKey);

    if (current) {
      current.count += 1;
    } else {
      groupedMap.set(categoryKey, {
        id: categoryKey,
        label: transaction.category.label,
        color: transaction.category.groupColor,
        count: 1,
      });
    }
  });

  categories.forEach((category) => {
    const categoryKey = String(category.id);

    if (!groupedMap.has(categoryKey)) {
      groupedMap.set(categoryKey, {
        id: categoryKey,
        label: category.label,
        color: category.groupColor,
        count: 0,
      });
    }
  });

  return {
    filteredTransactions,
    summaryCardsData: {
      totalIncomes,
      totalExpenses,
      balance: totalIncomes - totalExpenses,
    },
    categoryCounts: Array.from(groupedMap.values()).sort((left, right) => left.label.localeCompare(right.label)),
  };
}

export function useFilteredTransactionsData(
  transactions: TransactionItem[],
  categories: CategoryItem[],
  filters: TransactionsDerivedFilters,
) {
  return useMemo(
    () => getFilteredTransactionsData(transactions, categories, filters),
    [categories, filters.categoryFilter, filters.range.endDate, filters.range.startDate, filters.search, filters.typeFilter, transactions],
  );
}
