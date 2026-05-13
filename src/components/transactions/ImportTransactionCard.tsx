import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BankItem, CategoryItem, ImportPreviewItem, ImportReviewDraft } from "@/types/api";

export type ImportTransactionCardRow = {
  key: string;
  draft: ImportReviewDraft;
  item: ImportPreviewItem;
  displayIssues: ImportPreviewItem["issues"];
  frontendErrors: string[];
  hasError: boolean;
  hasWarning: boolean;
  isDuplicate: boolean;
  isIgnored: boolean;
  needsReview: boolean;
};

type ImportTransactionCardProps = {
  banks: BankItem[];
  categories: CategoryItem[];
  row: ImportTransactionCardRow;
  onChange: (patch: Partial<ImportReviewDraft>) => void;
  onOpenCreateCategory: () => void;
};

function StatusDot({ row, compact }: { row: ImportTransactionCardRow; compact?: boolean }) {
  const configs = {
    ignored: { dot: "bg-muted-foreground", label: "Ignorado", labelClass: "text-muted-foreground" },
    error: { dot: "bg-destructive", label: "Erro", labelClass: "text-destructive" },
    duplicate: { dot: "bg-orange-400", label: "Duplicata", labelClass: "text-orange-400" },
    review: { dot: "bg-warning", label: "Revisar", labelClass: "text-warning" },
    ok: { dot: "bg-green-400", label: "Pronto", labelClass: "text-green-400" },
  };

  const cfg = row.isIgnored
    ? configs.ignored
    : row.hasError
      ? configs.error
      : row.isDuplicate
        ? configs.duplicate
        : row.needsReview
          ? configs.review
          : configs.ok;

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
      {!compact && <span className={cn("text-xs", cfg.labelClass)}>{cfg.label}</span>}
      {compact && <span className={cn("hidden text-xs sm:inline", cfg.labelClass)}>{cfg.label}</span>}
    </span>
  );
}

export default function ImportTransactionCard({
  banks,
  categories,
  row,
  onChange,
  onOpenCreateCategory,
}: ImportTransactionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { draft, item } = row;
  const filteredCategories = categories.filter(
    (category) => draft.type !== "unknown" && category.transactionType === draft.type,
  );
  const categoryValue = String(draft.categoryId ?? "");
  const allIssues = [
    ...row.frontendErrors.map((message) => ({ kind: "error" as const, message })),
    ...row.displayIssues.map((issue) => ({
      kind: issue.level === "error" ? ("error" as const) : ("warning" as const),
      message: issue.message,
    })),
  ];

  const bankName = banks.find((b) => String(b.id) === String(draft.bankConnectionId))?.name;
  const categoryName = categories.find((c) => String(c.id) === String(draft.categoryId))?.label;

  const typeLabel = draft.type === "income" ? "Receita" : draft.type === "expense" ? "Despesa" : "?";
  const amountClass =
    draft.type === "income" ? "text-green-400" : draft.type === "expense" ? "text-red-400" : "text-foreground";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-lg border border-border/50 bg-card transition-colors",
          row.isIgnored && "opacity-55",
          row.hasError && "border-destructive/30 bg-destructive/5",
          !row.hasError && row.hasWarning && "border-warning/30 bg-warning/5",
        )}
      >
        {/* Collapsed header */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Checkbox
            checked={draft.selected}
            onCheckedChange={(checked) => onChange({ selected: checked === true })}
            aria-label={`Selecionar linha ${item.rowIndex}`}
            onClick={(event) => event.stopPropagation()}
          />

          {/* Status: only dot on xs, dot+label on sm+ */}
          <div className="shrink-0">
            <StatusDot row={row} compact />
          </div>

          <span className="hidden w-[80px] shrink-0 text-xs text-muted-foreground sm:block">
            {draft.occurredOn || "—"}
          </span>

          <CollapsibleTrigger asChild>
            <button type="button" className="group min-w-0 flex-1 cursor-pointer text-left">
              <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                {draft.description
                  ? draft.description.length > 20
                    ? `${draft.description.slice(0, 20)}…`
                    : draft.description
                  : "—"}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {[bankName, categoryName].filter(Boolean).join(" · ") || (
                  <span className="italic">conta e categoria não definidas</span>
                )}
              </p>
            </button>
          </CollapsibleTrigger>

          <span className={cn("shrink-0 text-sm font-semibold tabular-nums", amountClass)}>{draft.amount || "—"}</span>

          <Badge
            variant="outline"
            className={cn(
              "hidden shrink-0 text-xs sm:flex",
              draft.type === "income" && "border-green-500/30 text-green-400",
              draft.type === "expense" && "border-red-500/30 text-red-400",
              draft.type === "unknown" && "text-muted-foreground",
            )}
          >
            {typeLabel}
          </Badge>

          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={isOpen ? "Recolher linha" : "Expandir linha"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="border-t border-border/50 px-3 pb-3 pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
                <DatePickerInput
                  value={draft.occurredOn}
                  onChange={(value) => onChange({ occurredOn: value })}
                  className="h-9 rounded-xl"
                  placeholder="Data"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                <Input
                  value={draft.amount}
                  onChange={(event) => onChange({ amount: event.target.value })}
                  inputMode="decimal"
                  className="h-9 rounded-xl border-border/50 bg-secondary/30 text-right tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</p>
                <Select
                  value={draft.type}
                  onValueChange={(value: "income" | "expense" | "unknown") =>
                    onChange({
                      type: value,
                      categoryId: value === draft.type ? draft.categoryId : "",
                    })
                  }
                >
                  <SelectTrigger className="h-9 rounded-xl border-border/50 bg-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Definir depois</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Categoria</p>
                <Select
                  value={categoryValue || undefined}
                  onValueChange={(value) => onChange({ categoryId: value === "__uncategorized__" ? "" : value })}
                >
                  <SelectTrigger className="h-9 rounded-xl border-border/50 bg-secondary/30">
                    <SelectValue placeholder={draft.type === "income" ? "Categoria obrigatória" : "Categoria"} />
                  </SelectTrigger>
                  <SelectContent>
                    {draft.type === "expense" ? <SelectItem value="__uncategorized__">Compras</SelectItem> : null}
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-6 px-0 text-xs"
                  onClick={onOpenCreateCategory}
                >
                  + Nova categoria
                </Button>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</p>
                {item.isInstallment ? (
                  <p className="text-xs text-muted-foreground">
                    Parcela {item.installmentIndex ?? "?"}/{item.installmentCount ?? "?"}
                  </p>
                ) : null}
                <Textarea
                  value={draft.description}
                  onChange={(event) => onChange({ description: event.target.value })}
                  rows={2}
                  className="min-h-[60px] resize-none rounded-xl border-border/50 bg-secondary/30 text-sm"
                />
              </div>
            </div>

            {allIssues.length > 0 || item.externalId ? (
              <div className="mt-2 space-y-1">
                {allIssues.map((issue, index) => (
                  <p
                    key={index}
                    className={cn("text-xs", issue.kind === "error" ? "text-destructive" : "text-muted-foreground")}
                  >
                    {issue.message}
                  </p>
                ))}
                {item.externalId ? (
                  <p className="text-xs text-muted-foreground">ID externo: {item.externalId}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => onChange({ exclude: !draft.exclude })}
              >
                {draft.exclude ? "Restaurar" : "Ignorar"}
              </Button>
              {!row.hasError && row.needsReview ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => onChange({ reviewed: true })}
                >
                  Marcar revisado
                </Button>
              ) : null}
              {row.isDuplicate ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={draft.ignoreDuplicate}
                    onCheckedChange={(checked) => onChange({ ignoreDuplicate: checked === true })}
                  />
                  Importar mesmo assim
                </label>
              ) : null}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
