import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import ImportTransactionsModal from "@/components/transactions/ImportTransactionsModal";
import type { ImportPreviewData } from "@/types/api";

const previewMutateAsync = vi.fn();
const aiSuggestionsMutateAsync = vi.fn();
const commitMutateAsync = vi.fn();
const createCategoryMutateAsync = vi.fn();

vi.mock("@/hooks/use-transactions", () => ({
  usePreviewTransactionImport: () => ({
    mutateAsync: previewMutateAsync,
    isPending: false,
  }),
  useCommitTransactionImport: () => ({
    mutateAsync: commitMutateAsync,
    isPending: false,
  }),
  useImportAiSuggestions: () => ({
    mutateAsync: aiSuggestionsMutateAsync,
    isPending: false,
  }),
  useCreateCategory: () => ({
    mutateAsync: createCategoryMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/components/transactions/ImportPreviewTable", () => ({
  default: () => <div data-testid="import-preview-table">preview table</div>,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const previewData: ImportPreviewData = {
  previewToken: "preview-1",
  expiresAt: "2026-04-06T21:32:00.000Z",
  importSource: "bank_statement",
  bankConnectionId: 2,
  bankConnectionName: "Caixa/Dinheiro",
  fileSummary: {
    totalRows: 17,
    importableRows: 4,
    errorRows: 1,
    duplicateRows: 10,
    actionRequiredRows: 12,
  },
  items: [
    {
      rowIndex: 15,
      description: "Transferencia recebida",
      normalizedDescription: "transferencia recebida",
      amount: "396.00",
      normalizedAmount: "396.00",
      occurredOn: "2026-03-28",
      normalizedOccurredOn: "2026-03-28",
      type: "income",
      bankConnectionId: 2,
      bankConnectionName: "Caixa/Dinheiro",
      suggestedCategoryId: null,
      suggestedCategoryLabel: null,
      suggestionSource: null,
      matchedRuleId: null,
      aiSuggestedType: null,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: null,
      aiReason: null,
      aiStatus: "idle",
      possibleDuplicate: true,
      duplicateReason: "Ja existe uma transacao importada com os mesmos dados.",
      canImport: false,
      requiresCategorySelection: true,
      requiresUserAction: true,
      defaultExclude: false,
      warnings: ["Duplicata provavel encontrada."],
      errors: [],
    },
  ],
};

describe("ImportTransactionsModal", () => {
  beforeEach(() => {
    previewMutateAsync.mockReset();
    aiSuggestionsMutateAsync.mockReset();
    commitMutateAsync.mockReset();
    createCategoryMutateAsync.mockReset();
    previewMutateAsync.mockResolvedValue(previewData);
    aiSuggestionsMutateAsync.mockResolvedValue({
      previewToken: "preview-1",
      status: "completed",
      autoApplyThreshold: 0.8,
      summary: {
        requestedRows: 1,
        suggestedRows: 1,
        noMatchRows: 0,
        failedRows: 0,
      },
      items: [
        {
          rowIndex: 15,
          aiSuggestedType: "income",
          aiSuggestedCategoryId: 1,
          aiSuggestedCategoryLabel: "Alimentacao",
          aiConfidence: 0.92,
          aiReason: "Recebimento classificado automaticamente.",
          aiStatus: "suggested",
          suggestionSource: "ai",
        },
      ],
    });
    commitMutateAsync.mockResolvedValue({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      results: [],
    });
  });

  it("keeps the footer accessible and the preview body scrollable after generating preview", async () => {
    const onOpenChange = vi.fn();
    render(
      <ImportTransactionsModal
        open
        onOpenChange={onOpenChange}
        categories={[
          {
            id: 1,
            slug: "alimentacao",
            label: "Alimentacao",
            transactionType: "income",
            iconName: "Wallet",
            icon: (() => null) as never,
            color: "text-warning",
            groupSlug: "alimentacao",
            groupLabel: "Alimentacao",
            groupColor: "bg-warning",
          },
        ]}
        banks={[
          {
            id: 2,
            slug: "itau",
            name: "Itau",
            accountType: "bank_account",
            connected: true,
            color: "bg-orange-500",
            currentBalance: 0,
            formattedBalance: "R$ 0,00",
          },
        ]}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Extrato bancario/i }));
    fireEvent.click(screen.getByRole("combobox", { name: "" }));
    fireEvent.click(screen.getByText("Itau"));
    fireEvent.click(screen.getByRole("button", { name: /Gerar previa/i }));

    await waitFor(() => {
      expect(screen.getByTestId("import-preview-table")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    const body = screen.getByTestId("import-preview-body");
    const footer = screen.getByTestId("import-preview-footer");

    expect(dialog.className).toContain("!top-6");
    expect(dialog.className).toContain("!translate-y-0");
    expect(dialog.className).toContain("max-h-[calc(100vh-48px)]");
    expect(dialog.className).toContain("overflow-hidden");
    expect(body.className).toContain("overflow-y-auto");
    expect(screen.getByRole("button", { name: /Confirmar importacao/i })).toBeInTheDocument();
    expect(footer).toContainElement(screen.getByRole("button", { name: /Confirmar importacao/i }));
    expect(previewMutateAsync).toHaveBeenCalledWith({
      file: expect.any(File),
      importSource: "bank_statement",
      bankConnectionId: "2",
    });
    expect(aiSuggestionsMutateAsync).toHaveBeenCalledWith({
      previewToken: "preview-1",
      rowIndexes: [15],
    });
  });

  it("auto-applies high-confidence AI suggestions only into empty drafts", async () => {
    render(
      <ImportTransactionsModal
        open
        onOpenChange={vi.fn()}
        categories={[
          {
            id: 1,
            slug: "alimentacao",
            label: "Alimentacao",
            transactionType: "income",
            iconName: "Wallet",
            icon: (() => null) as never,
            color: "text-warning",
            groupSlug: "alimentacao",
            groupLabel: "Alimentacao",
            groupColor: "bg-warning",
          },
        ]}
        banks={[
          {
            id: 2,
            slug: "itau",
            name: "Itau",
            accountType: "bank_account",
            connected: true,
            color: "bg-orange-500",
            currentBalance: 0,
            formattedBalance: "R$ 0,00",
          },
        ]}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Extrato bancario/i }));
    fireEvent.click(screen.getByRole("combobox", { name: "" }));
    fireEvent.click(screen.getByText("Itau"));
    fireEvent.click(screen.getByRole("button", { name: /Gerar previa/i }));

    await waitFor(() => {
      expect(aiSuggestionsMutateAsync).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar importacao/i }));

    await waitFor(() => {
      expect(commitMutateAsync).toHaveBeenCalledWith({
        previewToken: "preview-1",
        items: [
          expect.objectContaining({
            rowIndex: 15,
            type: "income",
            categoryId: "1",
          }),
        ],
      });
    });
  });

  it("auto-applies semantic type even when AI has no category match", async () => {
    aiSuggestionsMutateAsync.mockResolvedValueOnce({
      previewToken: "preview-1",
      status: "completed",
      autoApplyThreshold: 0.8,
      summary: {
        requestedRows: 1,
        suggestedRows: 0,
        noMatchRows: 1,
        failedRows: 0,
      },
      items: [
        {
          rowIndex: 15,
          aiSuggestedType: "expense",
          aiSuggestedCategoryId: null,
          aiSuggestedCategoryLabel: null,
          aiConfidence: 0.9,
          aiReason: "Transferencia enviada sem categoria especifica.",
          aiStatus: "no_match",
          suggestionSource: null,
        },
      ],
    });

    render(
      <ImportTransactionsModal
        open
        onOpenChange={vi.fn()}
        categories={[
          {
            id: 1,
            slug: "alimentacao",
            label: "Alimentacao",
            transactionType: "expense",
            iconName: "Wallet",
            icon: (() => null) as never,
            color: "text-warning",
            groupSlug: "alimentacao",
            groupLabel: "Alimentacao",
            groupColor: "bg-warning",
          },
        ]}
        banks={[
          {
            id: 7,
            slug: "nubank",
            name: "Nubank",
            accountType: "credit_card",
            connected: true,
            color: "bg-purple-500",
            currentBalance: 0,
            formattedBalance: "R$ 0,00",
          },
        ]}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Fatura do cartao/i }));
    fireEvent.click(screen.getByRole("combobox", { name: "" }));
    fireEvent.click(screen.getByText("Nubank"));
    fireEvent.click(screen.getByRole("button", { name: /Gerar previa/i }));

    await waitFor(() => {
      expect(aiSuggestionsMutateAsync).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar importacao/i }));

    await waitFor(() => {
      expect(commitMutateAsync).toHaveBeenCalledWith({
        previewToken: "preview-1",
        items: [
          expect.objectContaining({
            rowIndex: 15,
            type: "expense",
            categoryId: "",
          }),
        ],
      });
    });
  });
});
