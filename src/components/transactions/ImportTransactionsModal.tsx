import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import ImportPreviewTable, { type ImportPreviewTableRow } from "@/components/transactions/ImportPreviewTable";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import {
  useCommitTransactionImport,
  useCreateCategory,
  usePreviewTransactionImport,
} from "@/hooks/use-transactions";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import type {
  BankItem,
  CategoryItem,
  CreateCategoryInput,
  ImportCommitItem,
  ImportPreviewData,
} from "@/types/api";

const PAGE_SIZE = 12;
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

function makeDraftKey(previewToken: string, rowIndex: number) {
  return `${previewToken}:${rowIndex}`;
}

function buildDrafts(preview: ImportPreviewData) {
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
        exclude: item.defaultExclude,
        ignoreDuplicate: false,
      } satisfies ImportCommitItem,
    ]),
  );
}

function formatStatementReferenceLabel(statementReferenceMonth: string | null) {
  if (!statementReferenceMonth) {
    return null;
  }

  const [year, month] = statementReferenceMonth.split("-");
  const date = new Date(`${year}-${month}-01T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return statementReferenceMonth;
  }

  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export default function ImportTransactionsModal({ open, onOpenChange, categories, banks }: ImportTransactionsModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewImport = usePreviewTransactionImport();
  const commitImport = useCommitTransactionImport();
  const createCategory = useCreateCategory();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importSource, setImportSource] = useState<ImportSource>("");
  const [bankConnectionId, setBankConnectionId] = useState("");
  const [previews, setPreviews] = useState<ImportPreviewData[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ImportCommitItem>>({});
  const [page, setPage] = useState(1);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<{ previewToken: string; rowIndex: number } | null>(null);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    label: "",
    transactionType: "expense",
    icon: "Wallet",
    color: DEFAULT_CATEGORY_COLOR,
    groupLabel: "",
    groupColor: DEFAULT_CATEGORY_COLOR,
  });

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setImportSource("");
      setBankConnectionId("");
      setPreviews([]);
      setDrafts({});
      setPage(1);
      setCategoryDialogOpen(false);
      setCategoryTarget(null);
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: DEFAULT_CATEGORY_COLOR,
        groupLabel: "",
        groupColor: DEFAULT_CATEGORY_COLOR,
      });
    }
  }, [open]);

  const importableBanks = useMemo(
    () =>
      importSource === "credit_card_statement"
        ? banks.filter((bank) => bank.accountType === "credit_card")
        : banks.filter((bank) => bank.accountType === "bank_account"),
    [banks, importSource],
  );

  const previewRows = useMemo<ImportPreviewTableRow[]>(
    () =>
      previews.flatMap((preview) =>
        preview.items.map((item) => ({
          previewToken: preview.previewToken,
          item,
          draft: drafts[makeDraftKey(preview.previewToken, item.rowIndex)],
        })),
      ),
    [drafts, previews],
  );

  const pageCount = Math.max(1, Math.ceil(previewRows.length / PAGE_SIZE));
  const currentRows = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return previewRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, previewRows]);

  const combinedSummary = useMemo(
    () =>
      previews.reduce(
        (summary, preview) => ({
          totalRows: summary.totalRows + preview.fileSummary.totalRows,
          importableRows: summary.importableRows + preview.fileSummary.importableRows,
          errorRows: summary.errorRows + preview.fileSummary.errorRows,
          duplicateRows: summary.duplicateRows + preview.fileSummary.duplicateRows,
          actionRequiredRows: summary.actionRequiredRows + preview.fileSummary.actionRequiredRows,
        }),
        {
          totalRows: 0,
          importableRows: 0,
          errorRows: 0,
          duplicateRows: 0,
          actionRequiredRows: 0,
        },
      ),
    [previews],
  );

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error(
        importSource === "credit_card_statement"
          ? "Selecione uma fatura CSV ou PDF para gerar a previa."
          : "Selecione um arquivo CSV para gerar a previa.",
      );
      return;
    }

    if (!importSource || !bankConnectionId) {
      toast.error("Escolha o tipo do arquivo e o banco ou conta antes de gerar a previa.");
      return;
    }

    try {
      const nextPreview = await previewImport.mutateAsync({
        file: selectedFile,
        importSource,
        bankConnectionId,
      });

      setPreviews((current) => [...current, nextPreview]);
      setDrafts((current) => ({
        ...current,
        ...buildDrafts(nextPreview),
      }));
      setSelectedFile(null);
      setPage(1);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      toast.success("Previa gerada com sucesso.");
    } catch (error) {
      toast.error("Nao foi possivel gerar a previa.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleChangeDraft = (previewToken: string, rowIndex: number, patch: Partial<ImportCommitItem>) => {
    const draftKey = makeDraftKey(previewToken, rowIndex);

    setDrafts((current) => ({
      ...current,
      [draftKey]: {
        ...current[draftKey],
        ...patch,
      },
    }));
  };

  const handleOpenCategoryDialog = (previewToken: string, rowIndex: number) => {
    const targetRow = previewRows.find((row) => row.previewToken === previewToken && row.item.rowIndex === rowIndex);

    if (!targetRow) {
      return;
    }

    setCategoryTarget({
      previewToken: targetRow.previewToken,
      rowIndex,
    });
    setCategoryForm((current) => ({
      ...current,
      transactionType: targetRow.draft.type,
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

      if (categoryTarget) {
        handleChangeDraft(categoryTarget.previewToken, categoryTarget.rowIndex, { categoryId: String(category.id) });
      }

      setCategoryDialogOpen(false);
      setCategoryTarget(null);
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: DEFAULT_CATEGORY_COLOR,
        groupLabel: "",
        groupColor: DEFAULT_CATEGORY_COLOR,
      });
      toast.success("Categoria criada.");
    } catch (error) {
      toast.error("Nao foi possivel criar a categoria.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleRemovePreview = (previewToken: string) => {
    setPreviews((current) => current.filter((preview) => preview.previewToken !== previewToken));
    setDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${previewToken}:`))),
    );
  };

  const handleResetImport = () => {
    setPreviews([]);
    setDrafts({});
    setSelectedFile(null);
    setPage(1);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleCommit = async () => {
    if (previews.length === 0) {
      return;
    }

    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const removablePreviewTokens = new Set<string>();
    const failedFiles: string[] = [];

    for (const preview of previews) {
      try {
        const result = await commitImport.mutateAsync({
          previewToken: preview.previewToken,
          items: preview.items.map((item) => drafts[makeDraftKey(preview.previewToken, item.rowIndex)]),
        });

        importedCount += result.importedCount;
        skippedCount += result.skippedCount;
        failedCount += result.failedCount;

        if (result.failedCount === 0) {
          removablePreviewTokens.add(preview.previewToken);
        } else {
          failedFiles.push(preview.fileMetadata.originalFilename ?? "extrato.csv");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tente novamente em instantes.";

        if (message.toLowerCase().includes("expirou")) {
          removablePreviewTokens.add(preview.previewToken);
        }

        failedFiles.push(preview.fileMetadata.originalFilename ?? "extrato.csv");
      }
    }

    if (removablePreviewTokens.size > 0) {
      setPreviews((current) => current.filter((preview) => !removablePreviewTokens.has(preview.previewToken)));
      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([key]) => !removablePreviewTokens.has(key.split(":")[0] ?? "")),
        ),
      );
    }

    if (importedCount > 0 || skippedCount > 0 || failedCount > 0) {
      toast.success(`${importedCount} importadas, ${skippedCount} ignoradas e ${failedCount} com falha.`);
    }

    if (failedFiles.length === 0) {
      onOpenChange(false);
      return;
    }

    toast.error("Nao foi possivel concluir a importacao.", {
      description: `Revise e tente novamente: ${failedFiles.join(", ")}.`,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!top-6 !translate-y-0 flex max-h-[calc(100vh-48px)] w-[calc(100vw-32px)] max-w-[1240px] flex-col overflow-hidden border-border/70 bg-card p-0 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-border/50 px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet size={18} />
              Importar CSV/PDF
            </DialogTitle>
            <DialogDescription>
              Envie um CSV ou PDF, revise as linhas em tabela e confirme apenas o que deve entrar no banco.
            </DialogDescription>
          </DialogHeader>

          <div data-testid="import-preview-body" className="scrollbar-app min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            <div className="space-y-6">
              {!previews.length ? (
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
                        <SelectValue
                          placeholder={importSource === "credit_card_statement" ? "Selecione o cartao" : "Selecione a conta bancaria"}
                        />
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
                          accept={importSource === "credit_card_statement" ? ".csv,.pdf,text/csv,application/pdf" : ".csv,text/csv"}
                          className="hidden"
                          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                        />
                        <button
                          type="button"
                          onClick={() => inputRef.current?.click()}
                          className="flex h-12 w-full items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                        >
                          <Upload size={16} />
                          {selectedFile
                            ? selectedFile.name
                            : importSource === "credit_card_statement"
                              ? "Selecione um arquivo CSV ou PDF da fatura"
                              : "Selecione um arquivo CSV de extrato"}
                        </button>
                      </div>
                      <Button onClick={() => void handlePreview()} disabled={previewImport.isPending}>
                        {previewImport.isPending ? "Gerando previa..." : "Gerar previa"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full bg-secondary px-3 py-1">
                            {importSource === "credit_card_statement" ? "Fatura do cartao" : "Extrato bancario"}
                          </span>
                          <span className="rounded-full bg-secondary px-3 py-1">
                            {previews[0]?.bankConnectionName ?? "Conta"}
                          </span>
                          <span className="rounded-full bg-secondary px-3 py-1">{combinedSummary.totalRows} linhas</span>
                          <span className="rounded-full bg-secondary px-3 py-1">{combinedSummary.importableRows} importaveis</span>
                          {combinedSummary.errorRows > 0 ? (
                            <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive">
                              {combinedSummary.errorRows} com erro
                            </span>
                          ) : null}
                          {combinedSummary.duplicateRows > 0 ? (
                            <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">
                              {combinedSummary.duplicateRows} duplicatas
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Revise a tabela abaixo. Voce pode adicionar mais {importSource === "credit_card_statement" ? "faturas" : "arquivos"} ou remover um arquivo antes de confirmar.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={handleResetImport}>
                          Nova importacao
                        </Button>
                        <input
                          ref={inputRef}
                          type="file"
                          accept={importSource === "credit_card_statement" ? ".csv,.pdf,text/csv,application/pdf" : ".csv,text/csv"}
                          className="hidden"
                          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                        />
                        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                          <Plus size={16} />
                          {importSource === "credit_card_statement" ? "Adicionar fatura" : "Adicionar arquivo"}
                        </Button>
                        <Button onClick={() => void handlePreview()} disabled={previewImport.isPending || !selectedFile}>
                          {previewImport.isPending
                            ? "Gerando previa..."
                            : importSource === "credit_card_statement"
                              ? "Gerar previa da fatura"
                              : "Gerar previa do arquivo"}
                        </Button>
                      </div>
                    </div>

                    {selectedFile ? (
                      <div className="rounded-xl border border-dashed border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
                        Arquivo selecionado: <span className="font-medium text-foreground">{selectedFile.name}</span>
                      </div>
                    ) : null}

                    <div className="grid gap-3 lg:grid-cols-2">
                      {previews.map((preview) => {
                        const statementReferenceLabel = formatStatementReferenceLabel(preview.fileMetadata.statementReferenceMonth);

                        return (
                          <div key={preview.previewToken} className="rounded-2xl border border-border/50 bg-card p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {preview.fileMetadata.originalFilename ?? "extrato.csv"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {preview.fileSummary.totalRows} linhas · expira em{" "}
                                  {new Date(preview.expiresAt).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                {preview.importSource === "credit_card_statement" ? (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {preview.fileMetadata.issuerName ? `Emissor: ${preview.fileMetadata.issuerName}` : "Fatura"}
                                    {statementReferenceLabel ? ` · competencia: ${statementReferenceLabel}` : ""}
                                    {preview.fileMetadata.statementDueDate
                                      ? ` · vencimento: ${preview.fileMetadata.statementDueDate.split("-").reverse().join("/")}`
                                      : ""}
                                  </p>
                                ) : null}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => handleRemovePreview(preview.previewToken)}
                              >
                                <X size={16} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {previews.length > 0 ? (
                <>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Previa consolidada de {previews[0]?.bankConnectionName} com {previews.length} arquivo
                        {previews.length > 1 ? "s" : ""}.
                      </p>
                      <p className="mt-1">
                        A tabela abaixo substitui o resumo em cards e centraliza erros, duplicatas e acoes pendentes por linha.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const firstRow = currentRows[0];

                        if (firstRow) {
                          handleOpenCategoryDialog(firstRow.previewToken, firstRow.item.rowIndex);
                        }
                      }}
                    >
                      Criar categoria
                    </Button>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-card">
                    <ScrollArea className="scrollbar-app w-full">
                      <ImportPreviewTable
                        categories={categories}
                        rows={currentRows}
                        onChangeDraft={handleChangeDraft}
                      />
                      <ScrollBar orientation="horizontal" className="bg-secondary/20" />
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
            <Button onClick={() => void handleCommit()} disabled={!previews.length || commitImport.isPending}>
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
