import { ChevronLeft, ChevronRight, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import ImportPreviewTable from "@/components/transactions/ImportPreviewTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import {
  useCommitTransactionImport,
  useCreateCategory,
  useImportAiSuggestions,
  usePreviewTransactionImport,
} from "@/hooks/use-transactions";
import { cn } from "@/lib/utils";
import type {
  BankItem,
  CategoryItem,
  CreateCategoryInput,
  ImportCommitItem,
  ImportPreviewData,
} from "@/types/api";

const PAGE_SIZE = 12;
const colorSwatches = [
  { text: "text-income", bg: "bg-income", ring: "ring-income/40" },
  { text: "text-warning", bg: "bg-warning", ring: "ring-warning/40" },
  { text: "text-info", bg: "bg-info", ring: "ring-info/40" },
  { text: "text-expense", bg: "bg-expense", ring: "ring-expense/40" },
  { text: "text-primary", bg: "bg-primary", ring: "ring-primary/40" },
  { text: "text-muted-foreground", bg: "bg-muted-foreground", ring: "ring-muted-foreground/40" },
];
const transactionTypeOptions: Array<{ label: string; value: "income" | "expense" }> = [
  { label: "Receita", value: "income" },
  { label: "Despesa", value: "expense" },
];

type ImportTransactionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryItem[];
  banks: BankItem[];
};

type ImportSource = "bank_statement" | "credit_card_statement" | "";

function buildDrafts(preview: ImportPreviewData) {
  return Object.fromEntries(
    preview.items.map((item) => [
      item.rowIndex,
      {
        rowIndex: item.rowIndex,
        description: item.description,
        amount: item.amount,
        occurredOn: item.occurredOn,
        type: item.type,
        categoryId: item.suggestedCategoryId ? String(item.suggestedCategoryId) : "",
        exclude: item.defaultExclude,
        ignoreDuplicate: false,
      } satisfies ImportCommitItem,
    ]),
  );
}

export default function ImportTransactionsModal({ open, onOpenChange, categories, banks }: ImportTransactionsModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attemptedAiPreviewTokensRef = useRef<Set<string>>(new Set());
  const previewImport = usePreviewTransactionImport();
  const commitImport = useCommitTransactionImport();
  const createCategory = useCreateCategory();
  const importAiSuggestions = useImportAiSuggestions();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importSource, setImportSource] = useState<ImportSource>("");
  const [bankConnectionId, setBankConnectionId] = useState("");
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [drafts, setDrafts] = useState<Record<number, ImportCommitItem>>({});
  const [page, setPage] = useState(1);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryTargetRow, setCategoryTargetRow] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    label: "",
    transactionType: "expense",
    icon: "Wallet",
    color: "text-income",
    groupLabel: "",
    groupColor: "bg-income",
  });

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setImportSource("");
      setBankConnectionId("");
      setPreview(null);
      setDrafts({});
      setPage(1);
      setCategoryDialogOpen(false);
      setCategoryTargetRow(null);
      attemptedAiPreviewTokensRef.current = new Set();
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: "text-income",
        groupLabel: "",
        groupColor: "bg-income",
      });
    }
  }, [open]);

  const originalPreviewTypeByRowIndex = useMemo(
    () => new Map((preview?.items ?? []).map((item) => [item.rowIndex, item.type])),
    [preview],
  );
  const importableBanks = useMemo(
    () =>
      importSource === "credit_card_statement"
        ? banks.filter((bank) => bank.accountType === "credit_card")
        : banks.filter((bank) => bank.accountType === "bank_account"),
    [banks, importSource],
  );

  useEffect(() => {
    if (!preview || attemptedAiPreviewTokensRef.current.has(preview.previewToken)) {
      return;
    }

    const rowIndexes = preview.items
      .filter((item) => !item.suggestedCategoryId && item.errors.length === 0 && item.aiStatus === "idle")
      .map((item) => item.rowIndex);

    if (rowIndexes.length === 0) {
      return;
    }

    attemptedAiPreviewTokensRef.current.add(preview.previewToken);

    void importAiSuggestions
      .mutateAsync({
        previewToken: preview.previewToken,
        rowIndexes,
      })
      .then((response) => {
        if (response.status === "disabled") {
          return;
        }

        const suggestionMap = new Map(response.items.map((item) => [item.rowIndex, item]));

        setPreview((current) => {
          if (!current || current.previewToken !== response.previewToken) {
            return current;
          }

          return {
            ...current,
            items: current.items.map((item) => {
              const suggestion = suggestionMap.get(item.rowIndex);

              if (!suggestion) {
                return item;
              }

              return {
                ...item,
                aiSuggestedType: suggestion.aiSuggestedType,
                aiSuggestedCategoryId: suggestion.aiSuggestedCategoryId,
                aiSuggestedCategoryLabel: suggestion.aiSuggestedCategoryLabel,
                aiConfidence: suggestion.aiConfidence,
                aiReason: suggestion.aiReason,
                aiStatus: suggestion.aiStatus,
                suggestionSource: suggestion.suggestionSource ?? item.suggestionSource,
              };
            }),
          };
        });

        setDrafts((current) => {
          const nextDrafts = { ...current };

          for (const suggestion of response.items) {
            const draft = nextDrafts[suggestion.rowIndex];
            const originalType = originalPreviewTypeByRowIndex.get(suggestion.rowIndex);
            const canApplySuggestedType =
              Boolean(suggestion.aiSuggestedType) &&
              draft?.type === originalType &&
              (suggestion.aiConfidence ?? 0) >= response.autoApplyThreshold;

            if (!draft || draft.categoryId) {
              if (draft && (suggestion.aiStatus === "suggested" || suggestion.aiStatus === "no_match") && canApplySuggestedType) {
                nextDrafts[suggestion.rowIndex] = {
                  ...draft,
                  type: suggestion.aiSuggestedType,
                };
              }
              continue;
            }

            if (
              (suggestion.aiStatus === "suggested" || suggestion.aiStatus === "no_match") &&
              (suggestion.aiConfidence ?? 0) >= response.autoApplyThreshold
            ) {
              nextDrafts[suggestion.rowIndex] = {
                ...draft,
                type: canApplySuggestedType ? suggestion.aiSuggestedType : draft.type,
                categoryId:
                  suggestion.aiStatus === "suggested" && suggestion.aiSuggestedCategoryId !== null
                    ? String(suggestion.aiSuggestedCategoryId)
                    : draft.categoryId,
              };
            }
          }

          return nextDrafts;
        });
      })
      .catch((error) => {
        toast.error("Nao foi possivel enriquecer a previa com sugestoes de IA.", {
          description: error instanceof Error ? error.message : "A revisao continua disponivel sem IA.",
        });
      });
  }, [importAiSuggestions, preview]);

  const pageCount = Math.max(1, Math.ceil((preview?.items.length ?? 0) / PAGE_SIZE));
  const currentItems = useMemo(() => {
    if (!preview) {
      return [];
    }

    const startIndex = (page - 1) * PAGE_SIZE;
    return preview.items.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, preview]);

  const statementReferenceLabel = useMemo(() => {
    if (!preview?.fileMetadata.statementReferenceMonth) {
      return null;
    }

    const [year, month] = preview.fileMetadata.statementReferenceMonth.split("-");
    const date = new Date(`${year}-${month}-01T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return preview.fileMetadata.statementReferenceMonth;
    }

    return date.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  }, [preview]);

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo CSV para gerar a previa.");
      return;
    }

    if (!importSource || !bankConnectionId) {
      toast.error("Escolha o tipo do CSV e o banco ou conta antes de gerar a previa.");
      return;
    }

    try {
      const nextPreview = await previewImport.mutateAsync({
        file: selectedFile,
        importSource,
        bankConnectionId,
      });
      setPreview(nextPreview);
      setDrafts(buildDrafts(nextPreview));
      setPage(1);
      toast.success("Previa gerada com sucesso.");
    } catch (error) {
      toast.error("Nao foi possivel gerar a previa.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleChangeDraft = (rowIndex: number, patch: Partial<ImportCommitItem>) => {
    setDrafts((current) => ({
      ...current,
      [rowIndex]: {
        ...current[rowIndex],
        ...patch,
      },
    }));
  };

  const handleOpenCategoryDialog = (rowIndex: number) => {
    setCategoryTargetRow(rowIndex);
    setCategoryForm((current) => ({
      ...current,
      transactionType: drafts[rowIndex]?.type ?? "expense",
    }));
    setCategoryDialogOpen(true);
  };

  const handleCreateCategory = async () => {
    const label = categoryForm.label.trim();

    if (!label) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    try {
      const category = await createCategory.mutateAsync({
        ...categoryForm,
        label,
        groupLabel: label,
      });

      if (categoryTargetRow !== null) {
        handleChangeDraft(categoryTargetRow, { categoryId: String(category.id) });
      }

      setCategoryDialogOpen(false);
      setCategoryTargetRow(null);
      setCategoryForm({
        label: "",
        transactionType: drafts[categoryTargetRow]?.type ?? "expense",
        icon: "Wallet",
        color: "text-income",
        groupLabel: "",
        groupColor: "bg-income",
      });
      toast.success("Categoria criada.");
    } catch (error) {
      toast.error("Nao foi possivel criar a categoria.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleCommit = async () => {
    if (!preview) {
      return;
    }

    try {
      const result = await commitImport.mutateAsync({
        previewToken: preview.previewToken,
        items: preview.items.map((item) => drafts[item.rowIndex]),
      });

      toast.success(
        `${result.importedCount} importadas, ${result.skippedCount} ignoradas e ${result.failedCount} com falha.`,
      );

      if (result.failedCount === 0) {
        onOpenChange(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tente novamente em instantes.";

      if (message.toLowerCase().includes("expirou")) {
        setPreview(null);
        setDrafts({});
      }

      toast.error("Nao foi possivel concluir a importacao.", {
        description: message,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!top-6 !translate-y-0 max-h-[calc(100vh-48px)] w-[calc(100vw-32px)] max-w-[1180px] overflow-hidden border-border/70 bg-card p-0 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-border/50 px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet size={18} />
              Importar extrato CSV
            </DialogTitle>
            <DialogDescription>
              Envie um CSV do banco, revise as linhas e confirme apenas o que deve entrar no banco.
            </DialogDescription>
          </DialogHeader>

          <div data-testid="import-preview-body" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 rounded-2xl bg-secondary/60 p-1 lg:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImportSource("bank_statement");
                        setBankConnectionId("");
                      }}
                      className={cn(
                        "rounded-xl px-4 py-3 text-left text-sm transition-colors",
                        importSource === "bank_statement"
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <div className="font-medium">Extrato bancario</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Recebimentos entram como receita e saidas como despesa.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportSource("credit_card_statement");
                        setBankConnectionId("");
                      }}
                      className={cn(
                        "rounded-xl px-4 py-3 text-left text-sm transition-colors",
                        importSource === "credit_card_statement"
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <div className="font-medium">Fatura do cartao</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Compras entram como despesa e pagamento recebido sera ignorado por padrao.
                      </div>
                    </button>
                  </div>

                    <Select value={bankConnectionId} onValueChange={setBankConnectionId}>
                      <SelectTrigger className="h-12 rounded-xl border-border/60 bg-card">
                        <SelectValue placeholder={importSource === "credit_card_statement" ? "Selecione o cartao" : "Selecione a conta bancaria"} />
                      </SelectTrigger>
                      <SelectContent>
                        {importableBanks.map((bank) => (
                          <SelectItem key={bank.id} value={String(bank.id)}>
                            {bank.name}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex-1">
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="flex h-12 w-full items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      <Upload size={16} />
                      {selectedFile ? selectedFile.name : "Selecione um arquivo CSV de extrato"}
                    </button>
                  </div>
                  <Button onClick={() => void handlePreview()} disabled={previewImport.isPending}>
                    {previewImport.isPending ? "Gerando previa..." : "Gerar previa"}
                  </Button>
                </div>
                </div>
              </div>

              {preview ? (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                      { label: "Linhas", value: preview.fileSummary.totalRows },
                      { label: "Importaveis", value: preview.fileSummary.importableRows },
                      { label: "Com erro", value: preview.fileSummary.errorRows },
                      { label: "Duplicatas", value: preview.fileSummary.duplicateRows },
                      { label: "Exigem acao", value: preview.fileSummary.actionRequiredRows },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Previa de {preview.bankConnectionName} expira em{" "}
                        {new Date(preview.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
                      </p>
                      {preview.importSource === "credit_card_statement" ? (
                        <p className="mt-1">
                          Arquivo: {preview.fileMetadata.originalFilename ?? "fatura.csv"}
                          {preview.fileMetadata.issuerName ? ` · emissor: ${preview.fileMetadata.issuerName}` : ""}
                          {statementReferenceLabel ? ` · competencia: ${statementReferenceLabel}` : ""}
                          {preview.fileMetadata.statementDueDate
                            ? ` · vencimento: ${preview.fileMetadata.statementDueDate.split("-").reverse().join("/")}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <Button variant="outline" onClick={() => handleOpenCategoryDialog(currentItems[0]?.rowIndex ?? 1)}>
                      Criar categoria
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-card">
                    <ScrollArea className="h-[min(34vh,320px)] min-h-[260px] w-full">
                      <ImportPreviewTable
                        categories={categories}
                        items={currentItems}
                        drafts={drafts}
                        onChangeDraft={handleChangeDraft}
                        onCreateCategory={handleOpenCategoryDialog}
                      />
                    </ScrollArea>
                  </div>

                  <div className="flex items-center justify-between pb-1">
                    <div className="text-sm text-muted-foreground">
                      Pagina {page} de {pageCount}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                        <ChevronLeft size={16} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={page >= pageCount}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <DialogFooter
            data-testid="import-preview-footer"
            className="shrink-0 border-t border-border/50 bg-card px-6 py-4 sm:justify-end"
          >
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={() => void handleCommit()} disabled={!preview || commitImport.isPending}>
              {commitImport.isPending ? "Importando..." : "Confirmar importacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[520px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>Crie a categoria sem sair da revisao do CSV.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={categoryForm.label}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
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

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cor</p>
              <div className="flex flex-wrap gap-3">
                {colorSwatches.map((swatch) => (
                  <button
                    key={swatch.text}
                    type="button"
                    onClick={() =>
                      setCategoryForm((current) => ({
                        ...current,
                        color: swatch.text,
                        groupColor: swatch.bg,
                      }))
                    }
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform hover:scale-105",
                      swatch.bg,
                      categoryForm.color === swatch.text ? `scale-105 border-white ring-2 ${swatch.ring}` : "border-transparent",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateCategory()} disabled={createCategory.isPending}>
              {createCategory.isPending ? "Criando..." : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
