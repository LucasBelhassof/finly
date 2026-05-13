import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImportTransactionsModal from "@/components/transactions/ImportTransactionsModal";
import type { ImportPreviewData } from "@/types/api";

const previewMutateAsync = vi.fn();
const commitMutateAsync = vi.fn();
const createCategoryMutateAsync = vi.fn();
const createImportTemplateMutateAsync = vi.fn();

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
  useCreateImportMappingTemplate: () => ({
    mutateAsync: createImportTemplateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/components/transactions/ImportTransactionCard", () => ({
  default: ({
    row,
    onChange,
  }: {
    row: { key: string; draft: { exclude: boolean }; hasError?: boolean; needsReview?: boolean };
    onChange: (patch: {
      exclude?: boolean;
      categoryId?: string;
      reviewed?: boolean;
      reviewConfirmed?: boolean;
    }) => void;
  }) => (
    <div data-testid={`import-card:${row.key}`}>
      <span data-testid={`row-status:${row.key}`}>{row.draft.exclude ? "ignored" : "included"}</span>
      <span data-testid={`row-review-status:${row.key}`}>
        {"hasError" in row && row.hasError ? "error" : "needsReview" in row && row.needsReview ? "review" : "ready"}
      </span>
      <button type="button" onClick={() => onChange({ exclude: true })}>
        ignore-{row.key}
      </button>
      <button type="button" onClick={() => onChange({ exclude: false })}>
        restore-{row.key}
      </button>
      <button type="button" onClick={() => onChange({ categoryId: "99" })}>
        categorize-{row.key}
      </button>
      {!row.hasError && row.needsReview ? (
        <button type="button" onClick={() => onChange({ reviewed: true, reviewConfirmed: true })}>
          mark-reviewed-{row.key}
        </button>
      ) : null}
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
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select data-testid="bank-select" value={value ?? ""} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectLabel: () => null,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
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
  requiresManualMapping: false,
  mappingPreflight: null,
  appliedImportTemplate: null,
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

const installmentPreviewData: ImportPreviewData = {
  ...previewData,
  fileSummary: {
    totalRows: 1,
    importableRows: 1,
    errorRows: 0,
    warningRows: 1,
    duplicateRows: 0,
    actionRequiredRows: 1,
  },
  items: [
    {
      rowIndex: 30,
      description: "Kabum - Parcela 3/10",
      normalizedDescription: "kabum parcela 3/10",
      purchaseDescriptionBase: "Kabum",
      normalizedPurchaseDescriptionBase: "kabum",
      amount: "154.25",
      normalizedAmount: "154.25",
      occurredOn: "2026-03-25",
      normalizedOccurredOn: "2026-03-25",
      purchaseOccurredOn: "2026-02-25",
      isInstallment: true,
      installmentIndex: 3,
      installmentCount: 10,
      generatedInstallmentCount: 10,
      type: "expense",
      importSource: "credit_card_statement",
      sourceKind: "credit_card_statement",
      bankConnectionId: 2,
      bankConnectionName: "Caixa/Dinheiro",
      suggestedCategoryId: 99,
      suggestedCategoryLabel: "Eletrônicos",
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
      warnings: [
        "Compra parcelada detectada: 10 despesas mensais serao geradas ao importar, incluindo parcelas anteriores.",
      ],
      errors: [],
      issues: [
        {
          level: "warning",
          message:
            "Compra parcelada detectada: 10 despesas mensais serao geradas ao importar, incluindo parcelas anteriores.",
        },
      ],
      confidence: 0.9,
      externalId: null,
      rawMetadata: null,
    },
  ],
};

const reviewOnlyPreviewData: ImportPreviewData = {
  ...previewData,
  fileSummary: {
    totalRows: 1,
    importableRows: 0,
    errorRows: 0,
    warningRows: 1,
    duplicateRows: 0,
    actionRequiredRows: 1,
  },
  items: [
    {
      rowIndex: 40,
      description: "Linha para revisar",
      normalizedDescription: "linha para revisar",
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
      issues: [{ level: "warning", message: "Revisar a linha." }],
      confidence: 0.4,
      externalId: null,
      rawMetadata: null,
    },
  ],
};

const uncategorizedExpensePreviewData: ImportPreviewData = {
  ...previewData,
  fileSummary: {
    totalRows: 1,
    importableRows: 1,
    errorRows: 0,
    warningRows: 1,
    duplicateRows: 0,
    actionRequiredRows: 0,
  },
  items: [
    {
      rowIndex: 50,
      description: "Compra sem categoria sugerida",
      normalizedDescription: "compra sem categoria sugerida",
      purchaseDescriptionBase: null,
      normalizedPurchaseDescriptionBase: null,
      amount: "89.90",
      normalizedAmount: "89.90",
      occurredOn: "2026-03-30",
      normalizedOccurredOn: "2026-03-30",
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
      warnings: ["Se nenhuma categoria for escolhida, a despesa sera importada como Compras."],
      errors: [],
      issues: [
        { level: "warning", message: "Se nenhuma categoria for escolhida, a despesa sera importada como Compras." },
      ],
      confidence: 0.9,
      externalId: null,
      rawMetadata: null,
    },
  ],
};

const categoryResolutionPreviewData: ImportPreviewData = {
  ...previewData,
  fileSummary: {
    totalRows: 1,
    importableRows: 0,
    errorRows: 0,
    warningRows: 1,
    duplicateRows: 0,
    actionRequiredRows: 1,
  },
  items: [
    {
      rowIndex: 60,
      description: "Receita para categorizar",
      normalizedDescription: "receita para categorizar",
      purchaseDescriptionBase: null,
      normalizedPurchaseDescriptionBase: null,
      amount: "1200.00",
      normalizedAmount: "1200.00",
      occurredOn: "2026-03-30",
      normalizedOccurredOn: "2026-03-30",
      purchaseOccurredOn: null,
      isInstallment: false,
      installmentIndex: null,
      installmentCount: null,
      generatedInstallmentCount: null,
      type: "income",
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
      canImport: false,
      requiresCategorySelection: true,
      requiresUserAction: true,
      defaultExclude: false,
      warnings: ["Selecione uma categoria antes de importar."],
      errors: [],
      issues: [{ level: "warning", message: "Selecione uma categoria antes de importar." }],
      confidence: 0.9,
      externalId: null,
      rawMetadata: null,
    },
  ],
};

const mappingRequiredPreviewData: ImportPreviewData = {
  ...previewData,
  requiresManualMapping: true,
  mappingPreflight: {
    supported: true,
    strategy: "tabular_columns",
    delimiter: ",",
    headerRowIndex: 1,
    headerDetectionMode: "fallback",
    availableColumns: [
      { index: 0, header: "posted_at", normalizedHeader: "posted at" },
      { index: 1, header: "narrative", normalizedHeader: "narrative" },
      { index: 2, header: "outflow", normalizedHeader: "outflow" },
      { index: 3, header: "inflow", normalizedHeader: "inflow" },
    ],
    sampleRows: [{ rowIndex: 1, values: ["2026-03-28", "Coffee", "12.90", ""] }],
    selectedMapping: {
      date: { index: null, header: null },
      description: { index: null, header: null },
      amount: { index: null, header: null },
      debit: { index: null, header: null },
      credit: { index: null, header: null },
      balance: { index: null, header: null },
      currency: { index: null, header: null },
      externalId: { index: null, header: null },
    },
    missingRequiredFields: ["date", "description", "amount"],
    requiresManualMapping: true,
    canApplyMapping: true,
    sheetCandidates: [
      { sheetName: "Imports", score: 12, availableColumns: [], missingRequiredFields: [], requiresManualMapping: true },
    ],
    selectedSheetName: "Imports",
  },
  items: [],
};

function hasChip(label: string, value: number) {
  return screen.queryByText((_, node) => node?.textContent === `${value}${label}`) !== null;
}

describe("ImportTransactionsModal", () => {
  beforeEach(() => {
    previewMutateAsync.mockReset();
    commitMutateAsync.mockReset();
    createCategoryMutateAsync.mockReset();
    createImportTemplateMutateAsync.mockReset();
    previewMutateAsync.mockResolvedValue(previewData);
    commitMutateAsync.mockResolvedValue({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      results: [],
    });
    createImportTemplateMutateAsync.mockResolvedValue({
      id: 1,
      name: "Saved template",
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
      previewOptions: {
        preflight: true,
      },
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

  it("opens manual mapping when the backend requires column resolution and reruns preview with mapping", async () => {
    previewMutateAsync.mockResolvedValueOnce(mappingRequiredPreviewData).mockResolvedValueOnce({
      ...previewData,
      warnings: [],
    });

    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["posted_at,narrative,outflow,inflow"], "unknown.csv", { type: "text/csv" })],
      },
    });

    selectBankItau();
    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    await waitFor(() => expect(screen.getByTestId("import-mapping-step")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("mapping-select:date"), { target: { value: "posted_at" } });
    fireEvent.change(screen.getByTestId("mapping-select:description"), { target: { value: "narrative" } });
    fireEvent.change(screen.getByTestId("mapping-select:debit"), { target: { value: "outflow" } });
    fireEvent.change(screen.getByTestId("mapping-select:credit"), { target: { value: "inflow" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /salvar template de importação/i }));
    fireEvent.change(screen.getByTestId("import-template-name-input"), {
      target: { value: "Unknown CSV template" },
    });

    fireEvent.click(screen.getByRole("button", { name: /gerar preview com mapeamento/i }));

    await waitFor(() => expect(screen.getByTestId("import-preview-body")).toBeInTheDocument());

    expect(previewMutateAsync).toHaveBeenNthCalledWith(1, {
      file: expect.any(File),
      bankConnectionId: "2",
      filePassword: "",
      previewOptions: {
        preflight: true,
      },
    });
    expect(previewMutateAsync).toHaveBeenNthCalledWith(2, {
      file: expect.any(File),
      bankConnectionId: "2",
      filePassword: "",
      previewOptions: {
        preflight: true,
        columnMapping: {
          date: "posted_at",
          description: "narrative",
          debit: "outflow",
          credit: "inflow",
        },
        sheetName: "Imports",
      },
    });
    expect(createImportTemplateMutateAsync).toHaveBeenCalledWith({
      previewToken: "preview-1",
      name: "Unknown CSV template",
      sheetName: "Imports",
      columnMapping: {
        date: "posted_at",
        description: "narrative",
        debit: "outflow",
        credit: "inflow",
      },
    });
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

    expect(screen.getByTestId("row-review-status:preview-1:15")).toHaveTextContent("review");
    fireEvent.click(screen.getByRole("button", { name: "mark-reviewed-preview-1:15" }));
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

  it("does not count installment-only warnings as review rows", async () => {
    previewMutateAsync.mockResolvedValueOnce(installmentPreviewData);

    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "fatura.csv", { type: "text/csv" })],
      },
    });

    selectBankItau();
    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    await waitFor(() => expect(screen.getByTestId("import-preview-body")).toBeInTheDocument());

    expect(hasChip("Rev.", 1)).toBe(false);
    expect(hasChip("OK", 1)).toBe(true);
  });

  it("marks uncategorized expenses for review and lets the user confirm the Compras fallback", async () => {
    previewMutateAsync.mockResolvedValueOnce(uncategorizedExpensePreviewData);

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

    expect(screen.getByTestId("row-review-status:preview-1:50")).toHaveTextContent("review");
    expect(hasChip("Rev.", 1)).toBe(true);
    expect(hasChip("OK", 1)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "mark-reviewed-preview-1:50" }));

    expect(screen.getByTestId("row-review-status:preview-1:50")).toHaveTextContent("ready");
    expect(hasChip("Rev.", 1)).toBe(false);
    expect(hasChip("OK", 1)).toBe(true);
  });

  it("commits an uncategorized reviewed expense without category so the backend uses Compras", async () => {
    previewMutateAsync.mockResolvedValueOnce(uncategorizedExpensePreviewData);

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

    fireEvent.click(screen.getByRole("button", { name: "mark-reviewed-preview-1:50" }));
    fireEvent.click(screen.getByRole("button", { name: /importar 1 linha válida/i }));

    await waitFor(() =>
      expect(commitMutateAsync).toHaveBeenCalledWith({
        previewToken: "preview-1",
        bankConnectionId: "2",
        items: [
          expect.not.objectContaining({
            categoryId: expect.anything(),
          }),
        ],
      }),
    );
  });

  it("marks a categorized line as ready after the user resolves the category", async () => {
    previewMutateAsync.mockResolvedValueOnce(categoryResolutionPreviewData);

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

    expect(screen.getByTestId("row-review-status:preview-1:60")).toHaveTextContent("error");
    fireEvent.click(screen.getByRole("button", { name: "categorize-preview-1:60" }));
    expect(screen.getByTestId("row-review-status:preview-1:60")).toHaveTextContent("ready");
  });

  it("marks a review-only line as ready when the user explicitly confirms it", async () => {
    previewMutateAsync.mockResolvedValueOnce(reviewOnlyPreviewData);

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

    expect(screen.getByTestId("row-review-status:preview-1:40")).toHaveTextContent("review");
    expect(hasChip("Rev.", 1)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "mark-reviewed-preview-1:40" }));

    expect(screen.getByTestId("row-review-status:preview-1:40")).toHaveTextContent("ready");
    expect(hasChip("Rev.", 1)).toBe(false);
    expect(hasChip("OK", 1)).toBe(true);
  });

  it("commits a reviewed low-confidence row when importing valid lines", async () => {
    previewMutateAsync.mockResolvedValueOnce(reviewOnlyPreviewData);

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

    fireEvent.click(screen.getByRole("button", { name: "mark-reviewed-preview-1:40" }));
    fireEvent.click(screen.getByRole("button", { name: /importar 1 linha válida/i }));

    await waitFor(() =>
      expect(commitMutateAsync).toHaveBeenCalledWith({
        previewToken: "preview-1",
        bankConnectionId: "2",
        items: [
          expect.objectContaining({
            rowIndex: 40,
            type: "expense",
          }),
        ],
      }),
    );
  });

  it("removes ignored rows from the review count", async () => {
    previewMutateAsync.mockResolvedValueOnce(reviewOnlyPreviewData);

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

    expect(hasChip("Rev.", 1)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "ignore-preview-1:40" }));
    expect(hasChip("Rev.", 1)).toBe(false);
  });

  it("blocks preview generation and shows error when no bank connection is selected", async () => {
    const { toast } = await import("@/components/ui/sonner");

    render(<ImportTransactionsModal open onOpenChange={vi.fn()} categories={[]} banks={banks} />);

    const fileInput = screen.getByTestId("import-file-input") as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    // Deliberately do NOT select a bank; the gate must fire.
    fireEvent.click(screen.getByRole("button", { name: /gerar preview/i }));

    expect(previewMutateAsync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Selecione uma conta ou cartão antes de gerar o preview.");
    expect(screen.queryByTestId("import-preview-body")).not.toBeInTheDocument();
  });
});
