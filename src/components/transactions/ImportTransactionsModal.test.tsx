import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImportTransactionsModal from "@/components/transactions/ImportTransactionsModal";
import type { ImportPreviewData } from "@/types/api";

const previewMutateAsync = vi.fn();
const commitMutateAsync = vi.fn();
const createCategoryMutateAsync = vi.fn();

vi.mock("@/hooks/use-transactions", () => ({
  useUniversalImportPreview: () => ({
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

vi.mock("@/components/transactions/ImportTransactionCard", () => ({
  default: ({ row, onChange }: { row: { key: string; draft: { exclude: boolean } }; onChange: (patch: { exclude?: boolean }) => void }) => (
    <div data-testid={`import-card:${row.key}`}>
      <span data-testid={`row-status:${row.key}`}>{row.draft.exclude ? "ignored" : "included"}</span>
      <button type="button" onClick={() => onChange({ exclude: true })}>
        ignore-{row.key}
      </button>
      <button type="button" onClick={() => onChange({ exclude: false })}>
        restore-{row.key}
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select data-testid="bank-select" value={value ?? ""} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectLabel: () => null,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));

const banks = [
  {
    id: 2,
    slug: "itau",
    name: "Itau",
    accountType: "bank_account" as const,
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-orange-500",
    currentBalance: 0,
    formattedBalance: "R$ 0,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
];

const previewData: ImportPreviewData = {
  previewToken: "preview-1",
  expiresAt: "2026-04-06T21:32:00.000Z",
  importSource: "generic_transactions",
  parserId: "csv-delimited",
  parserLabel: "CSV/TSV parser",
  detectedFileType: "csv",
  detectedSourceKind: "generic_transactions",
  sourceKindConfidence: 0.88,
  institutionName: "Nubank",
  accountHint: null,
  selectedBankConnectionId: 2,
  warnings: ["Revise as linhas com baixa confiança."],
  bankConnectionId: 2,
  bankConnectionName: "Caixa/Dinheiro",
  fileMetadata: {
    originalFilename: "extrato.csv",
    issuerName: "Nubank",
    statementDueDate: null,
    statementReferenceMonth: null,
  },
  fileSummary: {
    totalRows: 2,
    importableRows: 2,
    errorRows: 0,
    warningRows: 1,
    duplicateRows: 0,
    actionRequiredRows: 1,
  },
  items: [
    {
      rowIndex: 15,
      description: "Despesa sem categoria",
      normalizedDescription: "despesa sem categoria",
      purchaseDescriptionBase: null,
      normalizedPurchaseDescriptionBase: null,
      amount: "396.00",
      normalizedAmount: "396.00",
      occurredOn: "2026-03-28",
      normalizedOccurredOn: "2026-03-28",
      purchaseOccurredOn: null,
      isInstallment: false,
      installmentIndex: null,
      installmentCount: null,
      generatedInstallmentCount: null,
      type: "expense",
      importSource: "generic_transactions",
      sourceKind: "generic_transactions",
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
      issues: [],
      confidence: 0.9,
      externalId: null,
      rawMetadata: null,
    },
    {
      rowIndex: 16,
      description: "Linha ambígua",
      normalizedDescription: "linha ambigua",
      purchaseDescriptionBase: null,
      normalizedPurchaseDescriptionBase: null,
      amount: "120.00",
      normalizedAmount: "120.00",
      occurredOn: "2026-03-29",
      normalizedOccurredOn: "2026-03-29",
      purchaseOccurredOn: null,
      isInstallment: false,
      installmentIndex: null,
      installmentCount: null,
      generatedInstallmentCount: null,
      type: "unknown",
      importSource: "unknown",
      sourceKind: "unknown",
      bankConnectionId: "",
      bankConnectionName: "Conta a definir",
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
      requiresUserAction: true,
      defaultExclude: false,
      warnings: [],
      errors: [],
      issues: [{ level: "warning", message: "Revisar a linha." }],
      confidence: 0.4,
      externalId: null,
      rawMetadata: null,
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

  function selectBankItau() {
    fireEvent.change(screen.getByTestId("bank-select"), { target: { value: "2" } });
  }

  it("renders the upload state without requiring an importSource selector", () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    expect(screen.getByText("Importar transações")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar preview/i })).toBeDisabled();
    expect(screen.getByTestId("import-file-dropzone")).toBeInTheDocument();
    expect(screen.getAllByText(/csv/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/fatura de cartão/i)).not.toBeInTheDocument();
  });

  it("opens the native file picker when clicking Selecionar arquivo", () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByTestId("select-file-button"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("opens the native file picker when clicking the dropzone container", () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByTestId("import-file-dropzone"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("selects a file and requests the universal preview without importSource", async () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    selectBankItau();

    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    await waitFor(() => expect(screen.getByTestId("import-preview-body")).toBeInTheDocument());

    expect(previewMutateAsync).toHaveBeenCalledWith({
      file: expect.any(File),
      bankConnectionId: "2",
      filePassword: "",
    });
  });

  it("renders preview summary metadata after generating preview", async () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    selectBankItau();

    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    await waitFor(() => expect(screen.getByText("CSV/TSV parser")).toBeInTheDocument());
    expect(screen.getByText("Transações genéricas")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText(/revise as linhas com baixa confiança/i)).toBeInTheDocument();
  });

  it("allows rows to be excluded and restored from preview", async () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    selectBankItau();

    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    await waitFor(() => expect(screen.getByTestId("import-preview-body")).toBeInTheDocument());

    expect(screen.getByTestId("row-status:preview-1:15")).toHaveTextContent("included");
    fireEvent.click(screen.getByRole("button", { name: "ignore-preview-1:15" }));
    expect(screen.getByTestId("row-status:preview-1:15")).toHaveTextContent("ignored");
    fireEvent.click(screen.getByRole("button", { name: "restore-preview-1:15" }));
    expect(screen.getByTestId("row-status:preview-1:15")).toHaveTextContent("included");
  });

  it("renders technical import details collapsed by default", async () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    selectBankItau();

    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    await waitFor(() => expect(screen.getByTestId("import-technical-details")).toBeInTheDocument());

    const details = screen.getByTestId("import-technical-details");
    expect(details).not.toHaveAttribute("open");
  });

  it("commits only reviewed valid rows when using importar linhas válidas", async () => {
    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    selectBankItau();

    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    await waitFor(() => expect(screen.getByTestId("import-preview-body")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /importar \d+ linha/i }));

    await waitFor(() =>
      expect(commitMutateAsync).toHaveBeenCalledWith({
        previewToken: "preview-1",
        bankConnectionId: "2",
        items: [
          expect.objectContaining({
            rowIndex: 15,
            type: "expense",
          }),
        ],
      }),
    );
  });
});
