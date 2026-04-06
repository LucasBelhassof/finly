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
  const needsCategory = !draft.categoryId;

  return (
    <TableRow className={cn(draft.exclude && "opacity-55")}>
      <TableCell className="w-[76px] text-xs text-muted-foreground">#{item.rowIndex}</TableCell>
      <TableCell className="min-w-[220px]">
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
        </div>
        {item.errors.length > 0 ? (
          <p className="mt-2 text-xs text-destructive">{item.errors[0]}</p>
        ) : item.warnings[0] ? (
          <p className="mt-2 text-xs text-warning">{item.warnings[0]}</p>
        ) : null}
      </TableCell>
      <TableCell className="w-[140px]">
        <Input
          value={draft.amount}
          onChange={(event) => onChange(item.rowIndex, { amount: event.target.value })}
          inputMode="decimal"
          className="h-9 rounded-lg border-border/50 bg-secondary/30"
        />
      </TableCell>
      <TableCell className="w-[148px]">
        <Input
          type="date"
          value={draft.occurredOn}
          onChange={(event) => onChange(item.rowIndex, { occurredOn: event.target.value })}
          className="h-9 rounded-lg border-border/50 bg-secondary/30"
        />
      </TableCell>
      <TableCell className="w-[140px]">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/50 p-1">
          <button
            type="button"
            onClick={() => onChange(item.rowIndex, { type: "expense" })}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs transition-colors",
              draft.type === "expense" ? "bg-expense/15 text-expense" : "text-muted-foreground",
            )}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() => onChange(item.rowIndex, { type: "income" })}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs transition-colors",
              draft.type === "income" ? "bg-income/15 text-income" : "text-muted-foreground",
            )}
          >
            Receita
          </button>
        </div>
      </TableCell>
      <TableCell className="min-w-[220px]">
        <div className="flex items-center gap-2">
          <Select value={String(draft.categoryId ?? "")} onValueChange={(value) => onChange(item.rowIndex, { categoryId: value })}>
            <SelectTrigger className="h-9 rounded-lg border-border/50 bg-secondary/30">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
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
      <TableCell className="min-w-[190px]">
        <div className="space-y-3">
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
            <div className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{item.duplicateReason || "Linha semelhante encontrada."}</span>
            </div>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
