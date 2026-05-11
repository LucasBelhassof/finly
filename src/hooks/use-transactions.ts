import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  commitTransactionImport,
  deleteCategory as deleteCategoryRequest,
  getImportAiSuggestions,
  postImportMappingTemplate,
  deleteTransaction,
  getCategories,
  getTransactions,
  patchCategory,
  patchTransaction,
  postCategory,
  postTransaction,
  previewTransactionImport,
  previewUniversalTransactionImport,
} from "@/lib/api";
import { insightsQueryKey, spendingQueryKey } from "@/hooks/use-insights";
import { plansQueryKey } from "@/hooks/use-plans";
import type {
  CategoryItem,
  CreateCategoryInput,
  CreateTransactionInput,
  DeleteTransactionInput,
  ImportCommitItem,
  ImportMappingField,
  ImportPreviewData,
  UpdateCategoryInput,
  UpdateTransactionInput,
} from "@/types/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";

export const transactionsQueryKey = (limit?: number) => ["transactions", limit ?? "all"] as const;
export const categoriesQueryKey = ["categories"] as const;
export const transactionImportPreviewQueryKey = ["transactions", "import", "preview"] as const;
export const transactionImportAiSuggestionsQueryKey = ["transactions", "import", "ai-suggestions"] as const;
export const transactionImportTemplatesQueryKey = ["transactions", "import", "templates"] as const;

export function useTransactions(limit?: number, enabled = true) {
  return useQuery({
    queryKey: transactionsQueryKey(limit),
    queryFn: () => getTransactions(limit),
    staleTime: 30_000,
    enabled,
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
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

export function useUniversalImportPreview() {
  return useMutation({
    mutationFn: ({
      file,
      bankConnectionId,
      importSource,
      filePassword,
      previewOptions,
    }: {
      file: File;
      bankConnectionId?: number | string;
      importSource?: "bank_statement" | "credit_card_statement";
      filePassword?: string;
      previewOptions?: {
        preflight?: boolean;
        columnMapping?: Partial<Record<ImportMappingField, string>>;
        sheetName?: string;
      };
    }) => previewUniversalTransactionImport(file, { bankConnectionId, importSource, filePassword, previewOptions }),
  });
}

export function useCommitTransactionImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      previewToken,
      items,
      bankConnectionId,
    }: {
      previewToken: string;
      items: ImportCommitItem[];
      bankConnectionId?: number | string;
    }) => commitTransactionImport(previewToken, items, { bankConnectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: spendingQueryKey });
      queryClient.invalidateQueries({ queryKey: insightsQueryKey });
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.removeQueries({ queryKey: transactionImportPreviewQueryKey });
    },
  });
}

export function useCreateImportMappingTemplate() {
  return useMutation({
    mutationFn: (input: {
      previewToken: string;
      name?: string;
      sheetName?: string;
      columnMapping: Partial<Record<ImportMappingField, string>>;
    }) => postImportMappingTemplate(input),
  });
}

export function useImportAiSuggestions() {
  return useMutation({
    mutationFn: ({ previewToken, rowIndexes }: { previewToken: string; rowIndexes?: number[] }) =>
      getImportAiSuggestions(previewToken, rowIndexes),
  });
}
