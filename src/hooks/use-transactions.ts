import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  commitTransactionImport,
  deleteTransaction,
  getCategories,
  getTransactions,
  patchTransaction,
  postCategory,
  postTransaction,
  previewTransactionImport,
} from "@/lib/api";
import { insightsQueryKey, spendingQueryKey } from "@/hooks/use-insights";
import type {
  CategoryItem,
  CreateCategoryInput,
  CreateTransactionInput,
  ImportCommitItem,
  ImportPreviewData,
  TransactionItem,
  UpdateTransactionInput,
} from "@/types/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";

export const transactionsQueryKey = (limit?: number) => ["transactions", limit ?? "all"] as const;
export const categoriesQueryKey = ["categories"] as const;
export const transactionImportPreviewQueryKey = ["transactions", "import", "preview"] as const;

export function useTransactions(limit?: number) {
  return useQuery({
    queryKey: transactionsQueryKey(limit),
    queryFn: () => getTransactions(limit),
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: getCategories,
    staleTime: 60_000,
  });
}

function upsertTransaction(items: TransactionItem[], transaction: TransactionItem) {
  const nextItems = items.filter((item) => String(item.id) !== String(transaction.id));
  nextItems.push(transaction);

  return nextItems.sort((left, right) => {
    const dateDiff = new Date(right.occurredOn).getTime() - new Date(left.occurredOn).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return String(right.id).localeCompare(String(left.id), undefined, { numeric: true });
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => postCategory(input),
    onSuccess: (category) => {
      queryClient.setQueryData<CategoryItem[]>(categoriesQueryKey, (items = []) => [...items, category]);
    },
  });
}

export function useCreateTransaction(limit?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => postTransaction(input),
    onSuccess: (transaction) => {
      queryClient.setQueryData<TransactionItem[]>(transactionsQueryKey(limit), (items = []) =>
        upsertTransaction(items, transaction),
      );
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    },
  });
}

export function useUpdateTransaction(limit?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => patchTransaction(input),
    onSuccess: (transaction) => {
      queryClient.setQueryData<TransactionItem[]>(transactionsQueryKey(limit), (items = []) =>
        upsertTransaction(items, transaction),
      );
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    },
  });
}

export function useDeleteTransaction(limit?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => deleteTransaction(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<TransactionItem[]>(transactionsQueryKey(limit), (items = []) =>
        items.filter((item) => String(item.id) !== String(id)),
      );
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    },
  });
}

export function usePreviewTransactionImport() {
  return useMutation({
    mutationFn: (file: File) => previewTransactionImport(file),
  });
}

export function useCommitTransactionImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ previewToken, items }: { previewToken: string; items: ImportCommitItem[] }) =>
      commitTransactionImport(previewToken, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: spendingQueryKey });
      queryClient.invalidateQueries({ queryKey: insightsQueryKey });
      queryClient.removeQueries({ queryKey: transactionImportPreviewQueryKey });
    },
  });
}
