import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  commitTransactionImport,
  deleteCategory as deleteCategoryRequest,
  getImportAiSuggestions,
  deleteTransaction,
  getCategories,
  getTransactions,
  patchCategory,
  patchTransaction,
  postCategory,
  postTransaction,
  previewTransactionImport,
} from "@/lib/api";
import { insightsQueryKey, spendingQueryKey } from "@/hooks/use-insights";
import { plansQueryKey } from "@/hooks/use-plans";
import type {
  CategoryItem,
  CreateCategoryInput,
  CreateTransactionInput,
  DeleteTransactionInput,
  ImportCommitItem,
  ImportPreviewData,
  UpdateCategoryInput,
  UpdateTransactionInput,
} from "@/types/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";

export const transactionsQueryKey = (limit?: number) => ["transactions", limit ?? "all"] as const;
export const categoriesQueryKey = ["categories"] as const;
export const transactionImportPreviewQueryKey = ["transactions", "import", "preview"] as const;
export const transactionImportAiSuggestionsQueryKey = ["transactions", "import", "ai-suggestions"] as const;

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

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => postCategory(input),
    onSuccess: (category) => {
      queryClient.setQueryData<CategoryItem[]>(categoriesQueryKey, (items = []) => [...items, category]);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCategoryInput) => patchCategory(input),
    onSuccess: (category) => {
      queryClient.setQueryData<CategoryItem[]>(categoriesQueryKey, (items = []) =>
        items.map((item) => (String(item.id) === String(category.id) ? category : item)),
      );
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: spendingQueryKey });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => deleteCategoryRequest(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CategoryItem[]>(categoriesQueryKey, (items = []) =>
        items.filter((item) => String(item.id) !== String(id)),
      );
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: spendingQueryKey });
      queryClient.invalidateQueries({ queryKey: insightsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["housing"] });
      queryClient.invalidateQueries({ queryKey: ["installments", "overview"] });
    },
  });
}

export function useCreateTransaction(limit?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => postTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey(limit) });
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
    },
  });
}

export function useUpdateTransaction(limit?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => patchTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey(limit) });
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
    },
  });
}

export function useDeleteTransaction(limit?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteTransactionInput) => deleteTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey(limit) });
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
    },
  });
}

export function usePreviewTransactionImport() {
  return useMutation({
    mutationFn: ({
      file,
      importSource,
      bankConnectionId,
      filePassword,
    }: {
      file: File;
      importSource: "bank_statement" | "credit_card_statement";
      bankConnectionId: number | string;
      filePassword?: string;
    }) => previewTransactionImport(file, importSource, bankConnectionId, { filePassword }),
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
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
      queryClient.removeQueries({ queryKey: transactionImportPreviewQueryKey });
    },
  });
}

export function useImportAiSuggestions() {
  return useMutation({
    mutationFn: ({ previewToken, rowIndexes }: { previewToken: string; rowIndexes?: number[] }) =>
      getImportAiSuggestions(previewToken, rowIndexes),
  });
}
