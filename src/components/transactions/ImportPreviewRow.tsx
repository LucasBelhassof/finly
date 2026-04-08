import { AlertTriangle, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

type ImportPreviewRowProps = {
  draft: ImportCommitItem;
  item: ImportPreviewItem;
  categories: CategoryItem[];
  onChange: (rowIndex: number, patch: Partial<ImportCommitItem>) => void;
  onCreateCategory: (rowIndex: number) => void;
};

export default function ImportPreviewRow({
  draft,
  item,
  categories,
  onChange,
  onCreateCategory,
}: ImportPreviewRowProps) {
  const isInvalid = item.errors.length > 0;
  const needsCategory = draft.type === "income" && !draft.categoryId;
  const filteredCategories = categories.filter((category) => category.transactionType === draft.type);

  return (
    <TableRow className={cn(draft.exclude && "opacity-55")}>
      <TableCell className="w-[72px] px-4 py-4 align-top text-xs text-muted-foreground">#{item.rowIndex}</TableCell>
      <TableCell className="min-w-[240px] px-4 py-4 align-top">
        <Input
          value={draft.description}
          onChange={(event) => onChange(item.rowIndex, { description: event.target.value })}
          className="h-9 rounded-lg border-border/50 bg-secondary/30"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {isInvalid ? <Badge variant="destructive">Erro</Badge> : null}
          {item.possibleDuplicate ? (
            <Badge variant="secondary" className="bg-warning/15 text-warning">
              Duplicata
            </Badge>
          ) : null}
          {needsCategory ? (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive">
              Categoria obrigatoria
            </Badge>
          ) : null}
          {item.suggestionSource === "history" ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Historico
            </Badge>
          ) : null}
          {item.suggestionSource === "recurring_rule" ? (
            <Badge variant="secondary" className="bg-income/10 text-income">
              Recorrencia
            </Badge>
          ) : null}
        </div>
        {item.errors.length > 0 ? <p className="mt-2 text-xs text-destructive">{item.errors[0]}</p> : null}
        {item.errors.length === 0 && item.warnings[0] ? <p className="mt-2 text-xs text-warning">{item.warnings[0]}</p> : null}
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
          onChange={(event) => onChange(item.rowIndex, { amount: event.target.value })}
          inputMode="decimal"
          className="h-9 rounded-lg border-border/50 bg-secondary/30"
        />
      </TableCell>
      <TableCell className="w-[144px] px-4 py-4 align-top">
        <Input
          type="date"
          value={draft.occurredOn}
          onChange={(event) => onChange(item.rowIndex, { occurredOn: event.target.value })}
          className="h-9 rounded-lg border-border/50 bg-secondary/30"
        />
      </TableCell>
      <TableCell className="w-[176px] px-4 py-4 align-top">
        <div className="flex rounded-xl border border-border/50 bg-secondary/35 p-1">
          <button
            type="button"
            onClick={() => onChange(item.rowIndex, { type: "expense", categoryId: draft.type === "expense" ? draft.categoryId : "" })}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              draft.type === "expense"
                ? "bg-expense text-white shadow-sm"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() => onChange(item.rowIndex, { type: "income", categoryId: draft.type === "income" ? draft.categoryId : "" })}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              draft.type === "income"
                ? "bg-income text-background shadow-sm"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            Receita
          </button>
        </div>
      </TableCell>
      <TableCell className="min-w-[180px] px-4 py-4 align-top">
        <div className="flex items-center gap-2">
          <Select value={String(draft.categoryId ?? "")} onValueChange={(value) => onChange(item.rowIndex, { categoryId: value })}>
            <SelectTrigger className="h-9 rounded-lg border-border/50 bg-secondary/30">
              <SelectValue placeholder={draft.type === "income" ? "Categoria" : "Categoria (opcional)"} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => onCreateCategory(item.rowIndex)}>
            <Plus size={14} />
          </Button>
        </div>
      </TableCell>
      <TableCell className="min-w-[200px] px-4 py-4 align-top">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={draft.exclude}
              onCheckedChange={(checked) => onChange(item.rowIndex, { exclude: checked === true })}
            />
            Excluir da importacao
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={draft.ignoreDuplicate}
              disabled={!item.possibleDuplicate}
              onCheckedChange={(checked) => onChange(item.rowIndex, { ignoreDuplicate: checked === true })}
            />
            Importar mesmo com duplicata
          </label>
          {item.possibleDuplicate ? (
            <div className="flex items-start gap-2 rounded-lg bg-warning/5 px-2 py-1.5 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{item.duplicateReason || "Linha semelhante encontrada."}</span>
            </div>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
