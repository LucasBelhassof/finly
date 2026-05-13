import { CheckCircle2, FileSpreadsheet, Info, Loader2, Search, Upload } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import ImportTransactionCard, { type ImportTransactionCardRow } from "@/components/transactions/ImportTransactionCard";
import { ColorField } from "@/components/ui/color-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  useCommitTransactionImport,
  useCreateCategory,
  useCreateImportMappingTemplate,
  useUniversalImportPreview,
} from "@/hooks/use-transactions";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import type {
  BankItem,
  CategoryItem,
  CreateCategoryInput,
  ImportCommitData,
  ImportCommitItem,
  ImportMappingField,
  ImportMappingPreflight,
  ImportPreviewData,
  ImportPreviewItem,
  ImportReviewDraft,
  ImportSourceKind,
} from "@/types/api";

type ImportTransactionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryItem[];
  banks: BankItem[];
};

type StepState = "upload" | "processing" | "mapping" | "preview" | "result";
type PreviewFilter = "all" | "valid" | "warnings" | "errors" | "duplicates" | "ignored";

type ModalState = {
  step: StepState;
  selectedFile: File | null;
  filePassword: string;
  passwordRequired: boolean;
  globalBankConnectionId: string;
  preview: ImportPreviewData | null;
  drafts: Record<string, ImportReviewDraft>;
  result: ImportCommitData | null;
  search: string;
  filter: PreviewFilter;
  processingLabelIndex: number;
};

type ModalAction =
  | { type: "reset" }
  | { type: "set-file"; file: File | null }
  | { type: "set-password"; value: string }
  | { type: "set-password-required"; value: boolean }
  | { type: "set-global-bank"; value: string }
  | { type: "set-step"; value: StepState }
  | { type: "set-preview"; preview: ImportPreviewData; drafts: Record<string, ImportReviewDraft>; step?: StepState }
  | { type: "patch-draft"; rowKey: string; patch: Partial<ImportReviewDraft> }
  | { type: "set-result"; result: ImportCommitData }
  | { type: "set-search"; value: string }
  | { type: "set-filter"; value: PreviewFilter }
  | { type: "advance-processing" };

const PROCESSING_LABELS = [
  "Lendo arquivo",
  "Detectando formato",
  "Detectando colunas",
  "Normalizando transações",
  "Gerando preview",
];
const transactionTypeOptions: Array<{ label: string; value: "income" | "expense" }> = [
  { label: "Despesa", value: "expense" },
  { label: "Receita", value: "income" },
];
const filterOptions: Array<{ value: PreviewFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "valid", label: "Válidas" },
  { value: "warnings", label: "Revisão" },
  { value: "errors", label: "Erros" },
  { value: "duplicates", label: "Duplicatas" },
  { value: "ignored", label: "Ignoradas" },
];
const reviewableDraftFields = new Set<keyof ImportReviewDraft>([
  "description",
  "amount",
  "occurredOn",
  "type",
  "categoryId",
  "bankConnectionId",
  "sourceKind",
]);
const mappingFieldOptions: Array<{ field: ImportMappingField; label: string; required?: boolean }> = [
  { field: "date", label: "Data", required: true },
  { field: "description", label: "Descrição", required: true },
  { field: "amount", label: "Valor com sinal" },
  { field: "debit", label: "Débito / saída" },
  { field: "credit", label: "Crédito / entrada" },
  { field: "balance", label: "Saldo" },
  { field: "currency", label: "Moeda" },
  { field: "externalId", label: "Referência / ID externo" },
];

const initialState: ModalState = {
  step: "upload",
  selectedFile: null,
  filePassword: "",
  passwordRequired: false,
  globalBankConnectionId: "",
  preview: null,
  drafts: {},
  result: null,
  search: "",
  filter: "all",
  processingLabelIndex: 0,
};

function makeDraftKey(previewToken: string, rowIndex: number) {
  return `${previewToken}:${rowIndex}`;
}

function isPdfFile(file: File | null) {
  if (!file) {
    return false;
  }

  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatConfidenceLabel(value: number | null) {
  return value === null ? "n/d" : `${Math.round(value * 100)}%`;
}

function getMappingFieldLabel(field: ImportMappingField) {
  return mappingFieldOptions.find((option) => option.field === field)?.label ?? field;
}

function getSourceKindLabel(sourceKind: ImportSourceKind) {
  switch (sourceKind) {
    case "credit_card_statement":
      return "Fatura de cartão";
    case "generic_transactions":
      return "Transações genéricas";
    case "unknown":
      return "Origem indefinida";
    case "bank_statement":
    default:
      return "Extrato bancário";
  }
}

function parseAmountInput(value: string) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return Number.NaN;
  }

  const normalized = trimmed
    .replace(/\s+/g, "")
    .replace(/R\$/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  return Number.parseFloat(normalized);
}

function buildDrafts(preview: ImportPreviewData): Record<string, ImportReviewDraft> {
  return Object.fromEntries(
    preview.items.map((item) => [
      makeDraftKey(preview.previewToken, item.rowIndex),
      {
        rowIndex: item.rowIndex,
        description: item.description,
        amount: item.amount,
        occurredOn: item.occurredOn,
        type: item.type,
        categoryId: item.suggestedCategoryId ? String(item.suggestedCategoryId) : "",
        bankConnectionId:
          item.bankConnectionId !== ""
            ? String(item.bankConnectionId)
            : preview.selectedBankConnectionId
              ? String(preview.selectedBankConnectionId)
              : "",
        sourceKind: item.sourceKind,
        exclude: item.defaultExclude,
        ignoreDuplicate: false,
        selected: false,
        reviewed: false,
        reviewConfirmed: false,
      },
    ]),
  );
}

function buildInitialMappingSelection(preflight: ImportMappingPreflight | null) {
  return {
    date: preflight?.selectedMapping.date.header ?? "",
    description: preflight?.selectedMapping.description.header ?? "",
    amount: preflight?.selectedMapping.amount.header ?? "",
    debit: preflight?.selectedMapping.debit.header ?? "",
    credit: preflight?.selectedMapping.credit.header ?? "",
    balance: preflight?.selectedMapping.balance.header ?? "",
    currency: preflight?.selectedMapping.currency.header ?? "",
    externalId: preflight?.selectedMapping.externalId.header ?? "",
  } satisfies Record<ImportMappingField, string>;
}

function buildColumnMappingPayload(selection: Record<ImportMappingField, string>) {
  return Object.fromEntries(
    Object.entries(selection)
      .map(([field, header]) => [field, String(header ?? "").trim()])
      .filter(([, header]) => header.length > 0),
  ) as Partial<Record<ImportMappingField, string>>;
}

function validateDraft(draft: ImportReviewDraft, item: ImportPreviewItem) {
  const errors: string[] = [];

  if (!draft.description.trim()) {
    errors.push("Descrição obrigatória.");
  }

  if (!draft.occurredOn.trim()) {
    errors.push("Data obrigatória.");
  }

  if (!Number.isFinite(parseAmountInput(draft.amount))) {
    errors.push("Valor inválido.");
  }

  if (draft.type === "unknown") {
    errors.push("Defina se a linha é despesa ou receita.");
  }

  if (!String(draft.bankConnectionId ?? "").trim()) {
    errors.push("Selecione a conta ou cartão.");
  }

  if (draft.type === "income" && !String(draft.categoryId ?? "").trim()) {
    errors.push("Categoria obrigatória para receitas.");
  }

  if (item.requiresCategorySelection && draft.type !== "expense" && !String(draft.categoryId ?? "").trim()) {
    errors.push("Categoria obrigatória para esta linha.");
  }

  return errors;
}

function buildCommitItem(draft: ImportReviewDraft): ImportCommitItem {
  if (draft.type === "unknown") {
    throw new Error("A linha ainda possui tipo indefinido.");
  }

  return {
    rowIndex: draft.rowIndex,
    description: draft.description.trim(),
    amount: draft.amount.trim(),
    occurredOn: draft.occurredOn.trim(),
    type: draft.type,
    ...(String(draft.categoryId ?? "").trim() ? { categoryId: draft.categoryId } : {}),
    ...(String(draft.bankConnectionId ?? "").trim() ? { bankConnectionId: draft.bankConnectionId } : {}),
    ...(draft.sourceKind ? { sourceKind: draft.sourceKind } : {}),
    exclude: draft.exclude,
    ignoreDuplicate: draft.ignoreDuplicate,
  };
}

function patchTouchesReviewableField(patch: Partial<ImportReviewDraft>) {
  return Object.keys(patch).some((key) => reviewableDraftFields.has(key as keyof ImportReviewDraft));
}

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "reset":
      return initialState;
    case "set-file":
      return {
        ...state,
        selectedFile: action.file,
        filePassword: "",
        passwordRequired: action.file ? isPdfFile(action.file) : false,
      };
    case "set-password":
      return { ...state, filePassword: action.value };
    case "set-password-required":
      return { ...state, passwordRequired: action.value };
    case "set-global-bank":
      return { ...state, globalBankConnectionId: action.value };
    case "set-step":
      return { ...state, step: action.value };
    case "set-preview":
      return {
        ...state,
        preview: action.preview,
        drafts: action.drafts,
        step: action.step ?? "preview",
        result: null,
      };
    case "patch-draft": {
      const currentDraft = state.drafts[action.rowKey];

      if (!currentDraft) {
        return state;
      }

      const reviewed =
        action.patch.reviewed === true || currentDraft.reviewed || patchTouchesReviewableField(action.patch);
      const reviewConfirmed = action.patch.reviewConfirmed === true || currentDraft.reviewConfirmed === true;

      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.rowKey]: {
            ...currentDraft,
            ...action.patch,
            reviewed,
            reviewConfirmed,
          },
        },
      };
    }
    case "set-result":
      return { ...state, result: action.result, step: "result" };
    case "set-search":
      return { ...state, search: action.value };
    case "set-filter":
      return { ...state, filter: action.value };
    case "advance-processing":
      return { ...state, processingLabelIndex: (state.processingLabelIndex + 1) % PROCESSING_LABELS.length };
    default:
      return state;
  }
}

function matchesFilter(row: ImportTransactionCardRow, filter: PreviewFilter, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (
    normalizedSearch &&
    ![row.draft.description, row.item.description, row.item.normalizedDescription]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  ) {
    return false;
  }

  switch (filter) {
    case "valid":
      return !row.isIgnored && !row.hasError && !row.hasWarning && !row.isDuplicate && !row.needsReview;
    case "warnings":
      return !row.isIgnored && !row.hasError && (row.hasWarning || row.needsReview);
    case "errors":
      return row.hasError;
    case "duplicates":
      return row.isDuplicate;
    case "ignored":
      return row.isIgnored;
    case "all":
    default:
      return true;
  }
}

function isInformationalIssue(issue: ImportPreviewItem["issues"][number]) {
  if (issue.level !== "warning") {
    return false;
  }

  return (
    issue.message.startsWith("Compra parcelada detectada:") ||
    issue.message === "Selecione uma categoria antes de importar."
  );
}

function isUncategorizedExpenseIssue(issue: ImportPreviewItem["issues"][number]) {
  return issue.level === "warning" && issue.message.startsWith("Se nenhuma categoria for escolhida, a despesa");
}

function isReviewIssueResolved(issue: ImportPreviewItem["issues"][number], draft: ImportReviewDraft) {
  if (issue.level !== "warning") {
    return false;
  }

  if (isInformationalIssue(issue)) {
    return true;
  }

  if (isUncategorizedExpenseIssue(issue)) {
    return (
      draft.type !== "expense" || String(draft.categoryId ?? "").trim().length > 0 || draft.reviewConfirmed === true
    );
  }

  if (!draft.reviewed) {
    return false;
  }

  switch (issue.field) {
    case "description":
      return draft.description.trim().length > 0;
    case "occurredOn":
      return draft.occurredOn.trim().length > 0;
    case "amount":
      return Number.isFinite(parseAmountInput(draft.amount));
    case "categoryId":
      return draft.type === "expense" || String(draft.categoryId ?? "").trim().length > 0;
    case "sourceKind":
      return Boolean(draft.sourceKind);
    default:
      return true;
  }
}

function PreviewCountChip({
  label,
  value,
  variant,
  onClick,
}: {
  label: string;
  value: number;
  variant?: "warning" | "error";
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
        onClick &&
          "cursor-pointer hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        variant === "warning" && "border-warning/30 bg-warning/10",
        !variant && "border-border/70 bg-secondary/30",
      )}
    >
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default function ImportTransactionsModal({
  open,
  onOpenChange,
  categories,
  banks,
}: ImportTransactionsModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveTemplateEnabled, setSaveTemplateEnabled] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [mappingSelection, setMappingSelection] = useState<Record<ImportMappingField, string>>({
    date: "",
    description: "",
    amount: "",
    debit: "",
    credit: "",
    balance: "",
    currency: "",
    externalId: "",
  });
  const [mappingSheetName, setMappingSheetName] = useState("");
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [bulkAccountValue, setBulkAccountValue] = useState("");
  const [bulkTypeValue, setBulkTypeValue] = useState<"income" | "expense" | "unknown" | "">("");
  const [bulkCategoryValue, setBulkCategoryValue] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    label: "",
    transactionType: "expense",
    icon: "Wallet",
    color: DEFAULT_CATEGORY_COLOR,
    groupLabel: "Outros",
    groupColor: DEFAULT_CATEGORY_COLOR,
  });
  const previewImport = useUniversalImportPreview();
  const commitImport = useCommitTransactionImport();
  const createCategory = useCreateCategory();
  const createImportTemplate = useCreateImportMappingTemplate();

  useEffect(() => {
    if (!open) {
      dispatch({ type: "reset" });
      setDragActive(false);
      setSubmitting(false);
      setSaveTemplateEnabled(false);
      setTemplateName("");
      setMappingSelection({
        date: "",
        description: "",
        amount: "",
        debit: "",
        credit: "",
        balance: "",
        currency: "",
        externalId: "",
      });
      setMappingSheetName("");
      setMappingError(null);
      setBulkAccountValue("");
      setBulkTypeValue("");
      setBulkCategoryValue("");
      setCategoryDialogOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (state.step !== "processing") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      dispatch({ type: "advance-processing" });
    }, 850);

    return () => window.clearInterval(interval);
  }, [state.step]);

  useEffect(() => {
    if (state.step !== "mapping") {
      return;
    }

    setMappingSelection(buildInitialMappingSelection(state.preview?.mappingPreflight ?? null));
    setMappingSheetName(state.preview?.mappingPreflight?.selectedSheetName ?? "");
    setTemplateName(
      state.preview?.institutionName ??
        state.preview?.fileMetadata.originalFilename?.replace(/\.[^.]+$/, "") ??
        "Saved import template",
    );
    setMappingError(null);
  }, [state.preview, state.step]);

  const rows = useMemo<ImportTransactionCardRow[]>(() => {
    if (!state.preview || state.step !== "preview") {
      return [];
    }

    return state.preview.items.map((item) => {
      const key = makeDraftKey(state.preview!.previewToken, item.rowIndex);
      const draft = state.drafts[key];
      const hasCategory = String(draft.categoryId ?? "").trim().length > 0;
      const frontendErrors = validateDraft(draft, item);
      const backendHasError = item.issues.some((issue) => issue.level === "error");
      const displayIssues = item.issues.filter((issue) => !isReviewIssueResolved(issue, draft));
      const backendHasWarning = displayIssues.some((issue) => issue.level === "warning");
      const lowConfidence = (item.confidence ?? 1) < 0.75;
      const lowConfidenceNeedsReview = lowConfidence && !draft.reviewed;
      const hasPendingCategorySelection = item.requiresCategorySelection && draft.type !== "expense" && !hasCategory;
      const hasUncategorizedExpense = draft.type === "expense" && !hasCategory && draft.reviewConfirmed !== true;
      const hasError = backendHasError || frontendErrors.length > 0;
      const needsReview =
        !hasError &&
        (lowConfidenceNeedsReview || hasPendingCategorySelection || hasUncategorizedExpense || backendHasWarning);

      return {
        key,
        draft,
        item,
        displayIssues,
        frontendErrors,
        hasError,
        hasWarning: backendHasWarning || lowConfidenceNeedsReview || hasUncategorizedExpense,
        isDuplicate: item.possibleDuplicate,
        isIgnored: draft.exclude,
        needsReview,
      };
    });
  }, [state.drafts, state.preview]);

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesFilter(row, state.filter, state.search)),
    [rows, state.filter, state.search],
  );
  const rowCounts = useMemo(
    () => ({
      total: rows.length,
      valid: rows.filter((row) => matchesFilter(row, "valid", "")).length,
      warnings: rows.filter((row) => matchesFilter(row, "warnings", "")).length,
      errors: rows.filter((row) => matchesFilter(row, "errors", "")).length,
      duplicates: rows.filter((row) => matchesFilter(row, "duplicates", "")).length,
      ignored: rows.filter((row) => matchesFilter(row, "ignored", "")).length,
    }),
    [rows],
  );

  const selectedRows = visibleRows.filter((row) => row.draft.selected);
  const selectedCount = selectedRows.length;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => row.draft.selected);
  const showPasswordField = state.passwordRequired || isPdfFile(state.selectedFile);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "set-file", file: event.target.files?.[0] ?? null });
    event.target.value = "";
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openFilePicker();
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    dispatch({ type: "set-file", file: event.dataTransfer.files?.[0] ?? null });
  };

  const handlePreview = async (previewOptions?: {
    columnMapping?: Partial<Record<ImportMappingField, string>>;
    sheetName?: string;
  }) => {
    const fallbackStep: StepState = state.step === "mapping" ? "mapping" : "upload";

    if (!state.selectedFile) {
      toast.error("Selecione um arquivo para gerar o preview.");
      return;
    }

    if (!state.globalBankConnectionId) {
      toast.error("Selecione uma conta ou cartão antes de gerar o preview.");
      return;
    }

    dispatch({ type: "set-step", value: "processing" });

    try {
      const preview = await previewImport.mutateAsync({
        file: state.selectedFile,
        bankConnectionId: state.globalBankConnectionId || undefined,
        filePassword: state.filePassword,
        previewOptions: {
          preflight: true,
          ...(previewOptions?.columnMapping ? { columnMapping: previewOptions.columnMapping } : {}),
          ...(previewOptions?.sheetName ? { sheetName: previewOptions.sheetName } : {}),
        },
      });
      const shouldOpenMapping = preview.requiresManualMapping && Boolean(preview.mappingPreflight?.canApplyMapping);
      dispatch({
        type: "set-preview",
        preview,
        drafts: shouldOpenMapping ? {} : buildDrafts(preview),
        step: shouldOpenMapping ? "mapping" : "preview",
      });
      toast.success(shouldOpenMapping ? "Mapeamento manual necessário." : "Preview gerado com sucesso.");
      return preview;
    } catch (error) {
      dispatch({ type: "set-step", value: fallbackStep });
      const errorCode = error instanceof Error && "code" in error ? String(error.code) : "";

      if (errorCode === "import_pdf_password_required" || errorCode === "import_pdf_password_invalid") {
        dispatch({ type: "set-password-required", value: true });
        window.setTimeout(() => passwordInputRef.current?.focus(), 0);
      }

      toast.error("Não foi possível gerar o preview.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
      return null;
    }
  };

  const handleMappingPreview = async () => {
    const hasAmount = Boolean(mappingSelection.amount.trim());
    const hasDebit = Boolean(mappingSelection.debit.trim());
    const hasCredit = Boolean(mappingSelection.credit.trim());

    if (!mappingSelection.date.trim() || !mappingSelection.description.trim()) {
      setMappingError("Mapeie date e description antes de gerar o preview.");
      return;
    }

    if (!hasAmount && !(hasDebit && hasCredit)) {
      setMappingError("Mapeie signed amount ou informe debit e credit.");
      return;
    }

    setMappingError(null);
    const preview = await handlePreview({
      columnMapping: buildColumnMappingPayload(mappingSelection),
      sheetName: mappingSheetName || undefined,
    });

    if (preview && !preview.requiresManualMapping && saveTemplateEnabled) {
      try {
        await createImportTemplate.mutateAsync({
          previewToken: state.preview!.previewToken,
          name: templateName.trim() || undefined,
          sheetName: mappingSheetName || undefined,
          columnMapping: buildColumnMappingPayload(mappingSelection),
        });
        toast.success("Template salvo para reutilização automática.");
        setSaveTemplateEnabled(false);
      } catch (error) {
        toast.error("O preview foi gerado, mas não foi possível salvar o template.", {
          description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        });
      }
    }
  };

  const patchRows = (targetRows: ImportTransactionCardRow[], patch: Partial<ImportReviewDraft>) => {
    targetRows.forEach((row) => dispatch({ type: "patch-draft", rowKey: row.key, patch }));
  };

  const applyBulkPatch = (patch: Partial<ImportReviewDraft>) => {
    if (!selectedRows.length) {
      toast.error("Selecione ao menos uma linha para aplicar a ação em lote.");
      return;
    }

    patchRows(selectedRows, patch);
  };

  const handleBulkAccount = (value: string) => {
    setBulkAccountValue(value);
    if (value) {
      applyBulkPatch({ bankConnectionId: value });
      setBulkAccountValue("");
    }
  };

  const handleBulkType = (value: "income" | "expense" | "unknown") => {
    setBulkTypeValue(value);
    applyBulkPatch({ type: value, categoryId: "" });
    setBulkTypeValue("");
  };

  const handleBulkCategory = (value: string) => {
    setBulkCategoryValue(value);
    applyBulkPatch({ categoryId: value === "__uncategorized__" ? "" : value });
    setBulkCategoryValue("");
  };

  const buildCommitRows = (onlyValidRows: boolean) => {
    const candidateRows = rows.filter((row) => !row.draft.exclude);

    if (onlyValidRows) {
      return candidateRows.filter((row) => !row.hasError && !row.hasWarning && !row.isDuplicate && !row.needsReview);
    }

    return candidateRows;
  };

  const validImportCount = buildCommitRows(true).length;

  const handleCommit = async (onlyValidRows: boolean) => {
    if (!state.preview) {
      return;
    }

    const candidateRows = buildCommitRows(onlyValidRows);

    if (!candidateRows.length) {
      toast.error(
        onlyValidRows
          ? "Nenhuma linha válida foi encontrada para importar."
          : "Nenhuma linha foi marcada para importação.",
      );
      return;
    }

    if (!onlyValidRows) {
      const invalidRows = candidateRows.filter((row) => row.frontendErrors.length > 0);

      if (invalidRows.length > 0) {
        toast.error("Revise as linhas com erros antes de confirmar a importação.");
        dispatch({ type: "set-filter", value: "errors" });
        return;
      }
    }

    setSubmitting(true);

    try {
      const result = await commitImport.mutateAsync({
        previewToken: state.preview.previewToken,
        bankConnectionId: state.globalBankConnectionId || undefined,
        items: candidateRows.map((row) => buildCommitItem(row.draft)),
      });
      dispatch({ type: "set-result", result });
      toast.success(
        `${result.importedCount} importadas, ${result.skippedCount} ignoradas e ${result.failedCount} com falha.`,
      );
    } catch (error) {
      toast.error("Não foi possível concluir a importação.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.label.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    try {
      await createCategory.mutateAsync(categoryForm);
      toast.success("Categoria criada.");
      setCategoryDialogOpen(false);
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: DEFAULT_CATEGORY_COLOR,
        groupLabel: "Outros",
        groupColor: DEFAULT_CATEGORY_COLOR,
      });
    } catch (error) {
      toast.error("Não foi possível criar a categoria.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[90dvh] flex-col overflow-hidden p-0",
            state.step === "upload" || state.step === "processing"
              ? "w-[calc(100%-1rem)] sm:max-w-2xl"
              : state.step === "mapping"
                ? "w-[calc(100%-1rem)] sm:max-w-4xl"
                : "h-[90dvh] w-[95vw] sm:max-w-6xl",
          )}
        >
          <div className="border-b border-border/70 px-5 py-3">
            <DialogHeader>
              <DialogTitle>Importar transações</DialogTitle>
              <DialogDescription>
                Envie CSV, Excel, OFX, QIF, PDF, TXT ou JSON. O sistema detecta o formato e você revisa tudo antes do
                commit.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
            {state.step === "upload" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Dropzone */}
                <div
                  role="button"
                  tabIndex={0}
                  data-testid="import-file-dropzone"
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors",
                    dragActive ? "border-primary bg-primary/5" : "border-border/60 bg-secondary/10",
                  )}
                  onClick={openFilePicker}
                  onKeyDown={handleDropzoneKeyDown}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleFileDrop}
                >
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <FileSpreadsheet className="h-10 w-10" />
                  </div>

                  {state.selectedFile ? (
                    <>
                      <div className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5">
                        <div className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium text-foreground">{state.selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(state.selectedFile.size)}</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            dispatch({ type: "set-file", file: null });
                          }}
                          aria-label="Remover arquivo"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground underline-offset-2 hover:underline">Trocar arquivo</p>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">Arraste o arquivo aqui</p>
                        <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        data-testid="select-file-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openFilePicker();
                        }}
                      >
                        Selecionar arquivo
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {["CSV", "Excel", "OFX", "QIF", "PDF", "TXT", "JSON"].join(" · ")}
                      </p>
                    </>
                  )}
                </div>
                <Input
                  ref={inputRef}
                  data-testid="import-file-input"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Config column */}
                <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Configuração da importação</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Selecione a conta ou cartão de destino.</p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Conta ou cartão padrão <span className="text-destructive">*</span>
                    </p>
                    <Select
                      value={state.globalBankConnectionId}
                      onValueChange={(value) => dispatch({ type: "set-global-bank", value })}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-9 rounded-xl text-sm",
                          !state.globalBankConnectionId && "border-destructive/50",
                        )}
                      >
                        <SelectValue placeholder="Selecione uma conta ou cartão" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const accounts = banks.filter((b) => b.accountType === "bank_account");
                          const cards = banks.filter((b) => b.accountType === "credit_card");
                          const cash = banks.filter((b) => b.accountType === "cash");
                          return (
                            <>
                              {accounts.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel className="flex items-center gap-1.5">
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                      Conta bancária
                                    </span>
                                  </SelectLabel>
                                  {accounts.map((bank) => (
                                    <SelectItem key={bank.id} value={String(bank.id)}>
                                      {bank.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              {cards.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel className="flex items-center gap-1.5">
                                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
                                      Cartão de crédito
                                    </span>
                                  </SelectLabel>
                                  {cards.map((bank) => (
                                    <SelectItem key={bank.id} value={String(bank.id)}>
                                      {bank.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              {cash.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel className="flex items-center gap-1.5">
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-500">
                                      Caixa
                                    </span>
                                  </SelectLabel>
                                  {cash.map((bank) => (
                                    <SelectItem key={bank.id} value={String(bank.id)}>
                                      {bank.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                            </>
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {showPasswordField ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Senha do PDF
                      </p>
                      <Input
                        ref={passwordInputRef}
                        value={state.filePassword}
                        onChange={(event) => dispatch({ type: "set-password", value: event.target.value })}
                        placeholder="Senha do arquivo"
                        className="h-9 rounded-xl text-sm"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Como funciona
                    </p>
                    <ul className="space-y-1">
                      {[
                        "Detecta o formato do arquivo",
                        "O sistema extrai datas, valores e descrições",
                        "Você revisa antes de confirmar",
                      ].map((label) => (
                        <li key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {state.step === "processing" ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 rounded-[28px] border border-border/70 bg-secondary/15 p-8 text-center">
                <div className="rounded-full bg-primary/10 p-5 text-primary">
                  <FileSpreadsheet className="h-12 w-12 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    {PROCESSING_LABELS[state.processingLabelIndex]}
                  </p>
                  <p className="text-sm text-muted-foreground">{state.selectedFile?.name ?? "Arquivo selecionado"}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(state.selectedFile?.size ?? 0)}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {PROCESSING_LABELS.map((label, index) => (
                    <Badge
                      key={`processing:${label}`}
                      variant={index === state.processingLabelIndex ? "default" : "outline"}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {state.step === "mapping" && state.preview?.mappingPreflight ? (
              <div data-testid="import-mapping-step" className="flex h-full min-h-0 flex-col gap-4">
                <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Manual mapping required</p>
                      <p className="text-xs text-muted-foreground">
                        This file uses unknown headers or an ambiguous sheet. Map the required columns below and then
                        generate the preview again.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  <div className="min-h-0 rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {state.preview.mappingPreflight.headerDetectionMode ?? "manual"}
                      </Badge>
                      {state.preview.mappingPreflight.headerRowIndex ? (
                        <Badge variant="outline" className="text-xs">
                          Header row {state.preview.mappingPreflight.headerRowIndex}
                        </Badge>
                      ) : null}
                      {state.preview.mappingPreflight.selectedSheetName ? (
                        <Badge variant="outline" className="text-xs">
                          Sheet {state.preview.mappingPreflight.selectedSheetName}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {state.preview.mappingPreflight.sheetCandidates.length > 1 ? (
                        <label className="space-y-1 text-sm text-foreground sm:col-span-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Sheet
                          </span>
                          <select
                            data-testid="mapping-sheet-select"
                            value={mappingSheetName}
                            onChange={(event) => setMappingSheetName(event.target.value)}
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          >
                            <option value="">Use best detected sheet</option>
                            {state.preview.mappingPreflight.sheetCandidates.map((candidate) =>
                              candidate.sheetName ? (
                                <option key={candidate.sheetName} value={candidate.sheetName}>
                                  {candidate.sheetName}
                                </option>
                              ) : null,
                            )}
                          </select>
                        </label>
                      ) : null}

                      {mappingFieldOptions.map((option) => (
                        <label key={option.field} className="space-y-1 text-sm text-foreground">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {option.label}
                            {option.required ? " *" : ""}
                          </span>
                          <select
                            data-testid={`mapping-select:${option.field}`}
                            value={mappingSelection[option.field]}
                            onChange={(event) =>
                              setMappingSelection((current) => ({
                                ...current,
                                [option.field]: event.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                          >
                            <option value="">Not mapped</option>
                            {state.preview.mappingPreflight.availableColumns.map((column) => (
                              <option
                                key={`${option.field}:${column.index}:${column.header ?? "column"}`}
                                value={column.header ?? ""}
                              >
                                {column.header || `Column ${column.index + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/70">
                      <div className="border-b border-border/70 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sample rows</p>
                      </div>
                      <ScrollArea className="max-h-[260px]">
                        <div className="min-w-full">
                          <div
                            className="grid items-center gap-2 border-b border-border/70 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                            style={{
                              gridTemplateColumns: `60px repeat(${Math.max(
                                state.preview.mappingPreflight.availableColumns.length,
                                1,
                              )}, minmax(120px, 1fr))`,
                            }}
                          >
                            <span>Row</span>
                            {state.preview.mappingPreflight.availableColumns.map((column) => (
                              <span key={`mapping-column:${column.index}`}>
                                {column.header || `Column ${column.index + 1}`}
                              </span>
                            ))}
                          </div>
                          {state.preview.mappingPreflight.sampleRows.map((row) => (
                            <div
                              key={`mapping-row:${row.rowIndex}`}
                              className="grid items-start gap-2 border-b border-border/50 px-3 py-2 text-sm last:border-b-0"
                              style={{
                                gridTemplateColumns: `60px repeat(${Math.max(
                                  state.preview.mappingPreflight.availableColumns.length,
                                  1,
                                )}, minmax(120px, 1fr))`,
                              }}
                            >
                              <span className="text-xs font-medium text-muted-foreground">#{row.rowIndex}</span>
                              {state.preview.mappingPreflight.availableColumns.map((column) => (
                                <span key={`mapping-cell:${row.rowIndex}:${column.index}`} className="break-words">
                                  {row.values[column.index] || "—"}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Review rules</p>
                      <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                        <li>Date and description are required.</li>
                        <li>Map either a single signed amount column or both debit and credit columns.</li>
                        <li>Balance, currency, and reference columns are optional.</li>
                      </ul>
                    </div>

                    {state.preview.mappingPreflight.missingRequiredFields.length > 0 ? (
                      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        Missing fields:{" "}
                        {state.preview.mappingPreflight.missingRequiredFields
                          .map((field) => getMappingFieldLabel(field as ImportMappingField))
                          .join(", ")}
                      </div>
                    ) : null}

                    {mappingError ? (
                      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {mappingError}
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-border/70 bg-secondary/20 px-3 py-3">
                      <label className="flex items-start gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={saveTemplateEnabled}
                          onCheckedChange={(checked) => setSaveTemplateEnabled(Boolean(checked))}
                          aria-label="Salvar template de importação"
                        />
                        <span className="space-y-1">
                          <span className="block font-medium">Salvar mapeamento como template</span>
                          <span className="block text-xs text-muted-foreground">
                            Reaplica automaticamente este mapeamento quando o arquivo tiver os mesmos cabeçalhos.
                          </span>
                        </span>
                      </label>
                      {saveTemplateEnabled ? (
                        <Input
                          data-testid="import-template-name-input"
                          value={templateName}
                          onChange={(event) => setTemplateName(event.target.value)}
                          placeholder="Nome do template"
                          className="mt-3 h-9 rounded-xl text-sm"
                        />
                      ) : null}
                    </div>

                    {state.preview.warnings.length > 0 ? (
                      <div className="rounded-2xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                        {state.preview.warnings[0]}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {state.step === "preview" && state.preview ? (
              <div className="flex h-full min-h-0 flex-col gap-1.5">
                {/* Summary bar — compact, single line */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-2">
                  <span className="hidden min-w-0 truncate text-sm font-medium text-foreground sm:block sm:max-w-[200px]">
                    {state.preview.fileMetadata.originalFilename ?? state.selectedFile?.name ?? "Importação"}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {getSourceKindLabel(state.preview.detectedSourceKind)}
                  </Badge>
                  {state.preview.appliedImportTemplate ? (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Template: {state.preview.appliedImportTemplate.name}
                    </Badge>
                  ) : null}
                  {state.preview ? (
                    <div className="flex flex-wrap gap-1.5">
                      <PreviewCountChip
                        label="Total"
                        value={rowCounts.total}
                        onClick={() => dispatch({ type: "set-filter", value: "all" })}
                      />
                      <PreviewCountChip
                        label="OK"
                        value={rowCounts.valid}
                        onClick={() => dispatch({ type: "set-filter", value: "valid" })}
                      />
                      {rowCounts.warnings > 0 ? (
                        <PreviewCountChip
                          label="Rev."
                          value={rowCounts.warnings}
                          variant="warning"
                          onClick={() => dispatch({ type: "set-filter", value: "warnings" })}
                        />
                      ) : null}
                      {rowCounts.errors > 0 ? (
                        <PreviewCountChip
                          label="Erros"
                          value={rowCounts.errors}
                          variant="error"
                          onClick={() => dispatch({ type: "set-filter", value: "errors" })}
                        />
                      ) : null}
                      {rowCounts.duplicates > 0 ? (
                        <PreviewCountChip
                          label="Dup."
                          value={rowCounts.duplicates}
                          onClick={() => dispatch({ type: "set-filter", value: "duplicates" })}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {state.preview.warnings.length > 0 ? (
                    <span className="ml-auto text-xs text-warning">⚠ {state.preview.warnings[0]}</span>
                  ) : null}
                  <details data-testid="import-technical-details" className="hidden sm:block">
                    <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                      Detalhes
                    </summary>
                    <div className="absolute z-10 mt-1 grid min-w-[280px] grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-background p-3 shadow-lg sm:grid-cols-3">
                      {state.preview.parserLabel ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parser</p>
                          <p className="text-xs font-medium">{state.preview.parserLabel}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</p>
                        <p className="text-xs font-medium">{state.preview.detectedFileType ?? "n/d"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confiança</p>
                        <p className="text-xs font-medium">
                          {formatConfidenceLabel(state.preview.sourceKindConfidence)}
                        </p>
                      </div>
                      {state.preview.institutionName ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Instituição</p>
                          <p className="text-xs font-medium">{state.preview.institutionName}</p>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>

                {/* Filter + search bar */}
                <div className="shrink-0 rounded-2xl border border-border/70 bg-background/70 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all-visible"
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => {
                        visibleRows.forEach((row) =>
                          dispatch({ type: "patch-draft", rowKey: row.key, patch: { selected: !!checked } }),
                        );
                      }}
                      aria-label="Selecionar todos visíveis"
                    />
                    <div className="flex min-w-0 flex-1 overflow-x-auto">
                      <div className="flex gap-1">
                        {filterOptions.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            size="sm"
                            variant={state.filter === option.value ? "secondary" : "ghost"}
                            className="h-7 shrink-0 rounded-lg px-2 text-xs"
                            onClick={() => dispatch({ type: "set-filter", value: option.value })}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-7 w-32 rounded-lg pl-7 text-xs sm:w-48"
                        placeholder="Buscar…"
                        value={state.search}
                        onChange={(event) => dispatch({ type: "set-search", value: event.target.value })}
                      />
                    </div>
                  </div>

                  {/* Contextual bulk actions */}
                  {selectedCount > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                      <Badge variant="secondary" className="text-xs">
                        {selectedCount} sel.
                      </Badge>
                      <Select value={bulkAccountValue} onValueChange={handleBulkAccount}>
                        <SelectTrigger className="h-7 rounded-lg text-xs sm:w-[160px]">
                          <SelectValue placeholder="Conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {banks.map((bank) => (
                            <SelectItem key={`bulk-bank:${bank.id}`} value={String(bank.id)}>
                              {bank.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={bulkTypeValue} onValueChange={handleBulkType}>
                        <SelectTrigger className="h-7 rounded-lg text-xs sm:w-[130px]">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unknown">Definir depois</SelectItem>
                          <SelectItem value="expense">Despesa</SelectItem>
                          <SelectItem value="income">Receita</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={bulkCategoryValue} onValueChange={handleBulkCategory}>
                        <SelectTrigger className="h-7 rounded-lg text-xs sm:w-[160px]">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__uncategorized__">Compras</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={`bulk-category:${category.id}`} value={String(category.id)}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg px-2 text-xs"
                        onClick={() => applyBulkPatch({ exclude: true })}
                      >
                        Ignorar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg px-2 text-xs"
                        onClick={() => applyBulkPatch({ exclude: false })}
                      >
                        Restaurar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg px-2 text-xs"
                        onClick={() => {
                          const duplicateRows = selectedRows.filter((row) => row.isDuplicate);
                          if (!duplicateRows.length) {
                            toast.error("Selecione ao menos uma linha duplicada.");
                            return;
                          }
                          patchRows(duplicateRows, { exclude: true });
                        }}
                      >
                        Rem. dup.
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Card list — gets all remaining space */}
                <div
                  data-testid="import-preview-body"
                  className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70"
                >
                  <ScrollArea className="h-full">
                    <div className="flex flex-col gap-1.5 p-2">
                      {visibleRows.map((row) => (
                        <ImportTransactionCard
                          key={row.key}
                          row={row}
                          banks={banks}
                          categories={categories}
                          onChange={(patch) => dispatch({ type: "patch-draft", rowKey: row.key, patch })}
                          onOpenCreateCategory={() => setCategoryDialogOpen(true)}
                        />
                      ))}
                      {visibleRows.length === 0 ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">
                          Nenhuma linha encontrada para o filtro selecionado.
                        </p>
                      ) : null}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : null}

            {state.step === "result" && state.result ? (
              <div className="flex h-full flex-col gap-4 rounded-[28px] border border-border/70 bg-background/70 p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Importadas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{state.result.importedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Ignoradas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{state.result.skippedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Falhas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{state.result.failedCount}</p>
                  </div>
                </div>

                {state.result.results.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground">
                      Ver detalhes por linha ({state.result.results.length})
                    </summary>
                    <div className="mt-3 rounded-2xl border border-border/70">
                      <div className="grid grid-cols-[80px,100px,1fr] border-b border-border/70 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Linha</span>
                        <span>Status</span>
                        <span>Mensagem</span>
                      </div>
                      <div className="scrollbar-thin max-h-[300px] overflow-auto">
                        {state.result.results.map((item) => (
                          <div
                            key={`result:${item.rowIndex}`}
                            className="grid grid-cols-[80px,100px,1fr] gap-3 border-b border-border/70 px-4 py-2.5 text-sm last:border-b-0"
                          >
                            <span>#{item.rowIndex}</span>
                            <span className="font-medium">{item.status}</span>
                            <span>{item.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/70 px-4 py-3">
            <DialogFooter>
              {state.step === "upload" ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePreview}
                    disabled={!state.selectedFile || previewImport.isPending}
                  >
                    {previewImport.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Gerar preview
                  </Button>
                </>
              ) : state.step === "mapping" ? (
                <>
                  <Button type="button" variant="link" onClick={() => dispatch({ type: "reset" })}>
                    Nova importação
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => dispatch({ type: "set-step", value: "upload" })}
                  >
                    Voltar
                  </Button>
                  <Button type="button" onClick={() => void handleMappingPreview()} disabled={previewImport.isPending}>
                    {previewImport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Gerar preview com mapeamento
                  </Button>
                </>
              ) : state.step === "preview" ? (
                <>
                  <Button type="button" variant="link" onClick={() => dispatch({ type: "reset" })}>
                    Nova importação
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleCommit(true)}
                    disabled={submitting || commitImport.isPending}
                  >
                    {submitting || commitImport.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Importar {validImportCount} {validImportCount === 1 ? "linha válida" : "linhas válidas"}
                  </Button>
                </>
              ) : state.step === "result" ? (
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[510px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription className="sr-only">Formulário de criação de categoria</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={categoryForm.label}
              onChange={(event) => setCategoryForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Nome da categoria"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1">
              {transactionTypeOptions.map((option) => {
                const active = categoryForm.transactionType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategoryForm((current) => ({ ...current, transactionType: option.value }))}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm transition-colors",
                      active
                        ? option.value === "expense"
                          ? "bg-expense/20 text-expense"
                          : "bg-income/20 text-income"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <ColorField
              label="Cor"
              value={categoryForm.groupColor || categoryForm.color}
              onChange={(nextColor) =>
                setCategoryForm((current) => ({
                  ...current,
                  color: nextColor,
                  groupColor: nextColor,
                }))
              }
              inputAriaLabel="Selecionar cor da categoria"
              fallback={DEFAULT_CATEGORY_COLOR}
            />
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="secondary" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateCategory()} disabled={createCategory.isPending}>
              {createCategory.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
