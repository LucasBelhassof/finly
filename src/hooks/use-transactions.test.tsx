import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockCommitTransactionImport = vi.fn();
const mockDeleteCategory = vi.fn();
const mockPreviewUniversalTransactionImport = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    commitTransactionImport: (...args: unknown[]) => mockCommitTransactionImport(...args),
    deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
    previewUniversalTransactionImport: (...args: unknown[]) => mockPreviewUniversalTransactionImport(...args),
  };
});

import { dashboardQueryKey } from "@/hooks/use-dashboard";
import { housingQueryKey } from "@/hooks/use-housing";
import { insightsQueryKey, spendingQueryKey } from "@/hooks/use-insights";
import {
  transactionsQueryKey,
  useCommitTransactionImport,
  useDeleteCategory,
  categoriesQueryKey,
  useUniversalImportPreview,
} from "@/hooks/use-transactions";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useCommitTransactionImport", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates transactions and dashboard-related caches after commit", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(transactionsQueryKey(), [{ id: 1 }]);
    queryClient.setQueryData(dashboardQueryKey, { summaryCards: [] });
    queryClient.setQueryData(spendingQueryKey, [{ slug: "alimentacao" }]);
    queryClient.setQueryData(insightsQueryKey, [{ id: 1 }]);

    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    mockCommitTransactionImport.mockResolvedValue({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      results: [],
    });

    const { result } = renderHook(() => useCommitTransactionImport(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        previewToken: "preview-1",
        items: [
          {
            rowIndex: 1,
            description: "iFood",
            amount: "67.90",
            occurredOn: "2026-04-06",
            type: "expense",
            categoryId: 1,
            exclude: false,
            ignoreDuplicate: false,
          },
        ],
      });
    });

    expect(mockCommitTransactionImport).toHaveBeenCalledWith(
      "preview-1",
      [
        {
          rowIndex: 1,
          description: "iFood",
          amount: "67.90",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 1,
          exclude: false,
          ignoreDuplicate: false,
        },
      ],
      { bankConnectionId: undefined },
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: transactionsQueryKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: dashboardQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: spendingQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: insightsQueryKey });
  });
});

describe("useUniversalImportPreview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forwards file, bank account, source hint, and PDF password to the API layer", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockPreviewUniversalTransactionImport.mockResolvedValue({
      previewToken: "preview-1",
      expiresAt: "2026-04-06T21:32:00.000Z",
      importSource: "credit_card_statement",
      parserId: "pdf-text",
      parserLabel: "PDF text parser",
      detectedFileType: "pdf",
      detectedSourceKind: "credit_card_statement",
      sourceKindConfidence: 0.96,
      institutionName: "Nubank",
      accountHint: null,
      selectedBankConnectionId: 20,
      warnings: [],
      bankConnectionId: 20,
      bankConnectionName: "Cartao Nubank",
      fileMetadata: {
        originalFilename: "fatura.pdf",
        issuerName: "Nubank",
        statementDueDate: null,
        statementReferenceMonth: "2026-03",
      },
      fileSummary: {
        totalRows: 1,
        importableRows: 1,
        errorRows: 0,
        warningRows: 0,
        duplicateRows: 0,
        actionRequiredRows: 0,
      },
      items: [],
    });

    const { result } = renderHook(() => useUniversalImportPreview(), {
      wrapper: createWrapper(queryClient),
    });
    const file = new File(["%PDF"], "fatura.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.mutateAsync({
        file,
        bankConnectionId: 20,
        importSource: "credit_card_statement",
        filePassword: "123456",
      });
    });

    expect(mockPreviewUniversalTransactionImport).toHaveBeenCalledWith(file, {
      bankConnectionId: 20,
      importSource: "credit_card_statement",
      filePassword: "123456",
    });
  });
});

describe("useDeleteCategory", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("removes the category from cache and invalidates related views", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(categoriesQueryKey, [{ id: 7 }, { id: 8 }]);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    mockDeleteCategory.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteCategory(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(7);
    });

    expect(mockDeleteCategory).toHaveBeenCalledWith(7);
    expect(queryClient.getQueryData(categoriesQueryKey)).toEqual([{ id: 8 }]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: transactionsQueryKey() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: dashboardQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: spendingQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: insightsQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: housingQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["installments", "overview"] });
  });
});
