import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImportTransactionsModal from "@/components/transactions/ImportTransactionsModal";
import type { ImportPreviewData } from "@/types/api";

const previewMutateAsync = vi.fn();
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
  fileMetadata: {
    originalFilename: "extrato.csv",
    issuerName: null,
    statementDueDate: null,
    statementReferenceMonth: null,
  },
  fileSummary: {
    totalRows: 1,
    importableRows: 1,
    errorRows: 0,
    duplicateRows: 0,
    actionRequiredRows: 0,
  },
  items: [
    {
      rowIndex: 15,
      description: "Despesa sem categoria",
      normalizedDescription: "despesa sem categoria",
      amount: "396.00",
      normalizedAmount: "396.00",
      occurredOn: "2026-03-28",
      normalizedOccurredOn: "2026-03-28",
      type: "expense",
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
      possibleDuplicate: false,
      duplicateReason: "",
      canImport: true,
      requiresCategorySelection: false,
      requiresUserAction: false,
      defaultExclude: false,
      warnings: [],
      errors: [],
    },
  ],
};

describe("ImportTransactionsModal", () => {
  beforeEach(() => {
    previewMutateAsync.mockReset();
    commitMutateAsync.mockReset();
    createCategoryMutateAsync.mockReset();
    previewMutateAsync.mockResolvedValue(previewData);
    commitMutateAsync.mockResolvedValue({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      results: [],
    });
  });

  it("keeps the footer accessible and does not call AI after generating preview", async () => {
    render(
      <ImportTransactionsModal
        open
        onOpenChange={vi.fn()}
        categories={[]}
        banks={[
          {
            id: 2,
            slug: "itau",
            name: "Itau",
            accountType: "bank_account",
            parentBankConnectionId: null,
            parentAccountName: null,
            statementCloseDay: null,
            statementDueDay: null,
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

    expect(previewMutateAsync).toHaveBeenCalledWith({
      file: expect.any(File),
      importSource: "bank_statement",
      bankConnectionId: "2",
    });
  });

  it("accepts PDF uploads for credit card statements", () => {
    render(
      <ImportTransactionsModal
        open
        onOpenChange={vi.fn()}
        categories={[]}
        banks={[
          {
            id: 7,
            slug: "nubank",
            name: "Nubank",
            accountType: "credit_card",
            parentBankConnectionId: 2,
            parentAccountName: "Itau",
            statementCloseDay: 10,
            statementDueDay: 17,
            connected: true,
            color: "bg-purple-500",
            currentBalance: 0,
            formattedBalance: "R$ 0,00",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Fatura do cartao/i }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput.accept).toContain(".pdf");
    expect(screen.getByText(/Selecione um arquivo CSV ou PDF da fatura/i)).toBeInTheDocument();
  });

  it("commits expenses without category so the backend can apply Outros", async () => {
    render(
      <ImportTransactionsModal
        open
        onOpenChange={vi.fn()}
        categories={[]}
        banks={[
          {
            id: 2,
            slug: "itau",
            name: "Itau",
            accountType: "bank_account",
            parentBankConnectionId: null,
            parentAccountName: null,
            statementCloseDay: null,
            statementDueDay: null,
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
