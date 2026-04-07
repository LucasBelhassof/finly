import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

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
      suggestedCategoryId: null,
      suggestedCategoryLabel: null,
      matchedRuleId: null,
      possibleDuplicate: true,
      duplicateReason: "Ja existe uma transacao importada com os mesmos dados.",
      canImport: false,
      requiresCategorySelection: true,
      requiresUserAction: true,
      warnings: ["Duplicata provavel encontrada."],
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
            iconName: "Wallet",
            icon: (() => null) as never,
            color: "text-warning",
            groupSlug: "alimentacao",
            groupLabel: "Alimentacao",
            groupColor: "bg-warning",
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
  });
});
