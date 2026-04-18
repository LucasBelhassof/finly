import { Info } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

type ImportPreviewRowProps = {
  draft: ImportCommitItem;
  item: ImportPreviewItem;
  categories: CategoryItem[];
  onChange: (previewToken: string, rowIndex: number, patch: Partial<ImportCommitItem>) => void;
  previewToken: string;
};

export default function ImportPreviewRow({
  draft,
  item,
  categories,
  onChange,
  previewToken,
}: ImportPreviewRowProps) {
  const filteredCategories = categories.filter((category) => category.transactionType === draft.type);
  const descriptionWidth = `${Math.min(Math.max(draft.description.length + 2, 28), 48)}ch`;
  const amountWidth = `${Math.min(Math.max(draft.amount.length + 2, 10), 16)}ch`;

  return (
    <TableRow
      className={cn(
        draft.exclude && "opacity-55",
        item.possibleDuplicate && "bg-warning/5 hover:bg-warning/10",
      )}
    >
      <TableCell className="w-[72px] px-4 py-4 align-top text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span>#{item.rowIndex}</span>
          {item.possibleDuplicate ? (
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-warning transition-colors hover:text-warning"
                    aria-label={`Duplicata na linha ${item.rowIndex}`}
                  >
                    <Info size={12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
                  {item.duplicateReason || "Linha semelhante encontrada."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="w-[300px] px-4 py-4 align-top">
        <div className="space-y-2">
          <Textarea
            value={draft.description}
            onChange={(event) => onChange(previewToken, item.rowIndex, { description: event.target.value })}
            rows={3}
            style={{ width: descriptionWidth }}
            className="min-h-[84px] max-w-full resize-none whitespace-pre-wrap break-words rounded-xl border-border/50 bg-secondary/30 text-sm leading-relaxed"
          />
          {item.errors.length === 0 && item.isInstallment && item.generatedInstallmentCount ? (
            <div className="flex items-center gap-1.5 text-xs text-info">
              <span>Parcela detectada</span>
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:text-foreground"
                      aria-label={`Detalhes da parcela da linha ${item.rowIndex}`}
                    >
                      <Info size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
                    Esta linha sera expandida em {item.generatedInstallmentCount} despesa
                    {item.generatedInstallmentCount > 1 ? "s" : ""} mensa
                    {item.generatedInstallmentCount > 1 ? "is" : "l"} ao confirmar a importacao, incluindo parcelas anteriores.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : null}
        </div>
        {item.errors.length === 0 &&
        (item.suggestionSource === "history" || item.suggestionSource === "recurring_rule") &&
        item.suggestedCategoryLabel ? (
          <p className="mt-2 text-xs text-primary">
            {item.suggestionSource === "history" ? "Historico do usuario" : "Regra recorrente"}:{" "}
            {item.type === "income" ? "Receita" : "Despesa"} - {item.suggestedCategoryLabel}
          </p>
        ) : null}
        {item.errors.length === 0 && draft.type === "expense" && !draft.categoryId ? (
          <p className="mt-2 text-xs text-muted-foreground">Sem categoria definida, sera importada como Outros.</p>
        ) : null}
      </TableCell>
      <TableCell className="w-[132px] px-4 py-4 align-top">
        <Input
          value={draft.amount}
          onChange={(event) => onChange(previewToken, item.rowIndex, { amount: event.target.value })}
          inputMode="decimal"
          style={{ width: amountWidth }}
          className="h-10 max-w-full rounded-xl border-border/50 bg-secondary/30 px-2.5 text-right font-medium tabular-nums"
        />
      </TableCell>
      <TableCell className="w-[156px] px-4 py-4 align-top">
        <DatePickerInput
          value={draft.occurredOn}
          onChange={(value) => onChange(previewToken, item.rowIndex, { occurredOn: value })}
          className="h-10 w-[148px] rounded-xl"
          placeholder="Data"
        />
      </TableCell>
      <TableCell className="w-[156px] px-4 py-4 align-top">
        <Select
          value={draft.type}
          onValueChange={(value: "income" | "expense") =>
            onChange(previewToken, item.rowIndex, {
              type: value,
              categoryId: draft.type === value ? draft.categoryId : "",
            })
          }
        >
          <SelectTrigger
            className={cn(
              "h-10 rounded-xl border-border/50 font-medium",
              draft.type === "expense"
                ? "bg-expense/15 text-expense"
                : "bg-income/15 text-income",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense" className="text-expense focus:text-expense">
              Despesa
            </SelectItem>
            <SelectItem value="income" className="text-income focus:text-income">
              Receita
            </SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-[192px] px-4 py-4 align-top">
        <div className="flex items-center gap-2">
          <Select
            value={String(draft.categoryId ?? "")}
            onValueChange={(value) => onChange(previewToken, item.rowIndex, { categoryId: value })}
          >
            <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
              <SelectValue placeholder={draft.type === "income" ? "Categoria" : "Categoria"} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TableCell>
      <TableCell className="w-[176px] px-4 py-4 align-top">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={draft.exclude}
              onCheckedChange={(checked) => onChange(previewToken, item.rowIndex, { exclude: checked === true })}
            />
            Excluir da importacao
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={draft.ignoreDuplicate}
              disabled={!item.possibleDuplicate}
              onCheckedChange={(checked) => onChange(previewToken, item.rowIndex, { ignoreDuplicate: checked === true })}
            />
            Importar mesmo com duplicata
          </label>
        </div>
      </TableCell>
    </TableRow>
  );
}
