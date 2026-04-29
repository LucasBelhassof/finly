import { Info } from "lucide-react";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

import ImportPreviewRow from "./ImportPreviewRow";

export type ImportPreviewTableRow = {
  bankConnectionName: string;
  draft: ImportCommitItem;
  item: ImportPreviewItem;
  previewToken: string;
};

type ImportPreviewTableProps = {
  categories: CategoryItem[];
  rows: ImportPreviewTableRow[];
  onChangeDraft: (previewToken: string, rowIndex: number, patch: Partial<ImportCommitItem>) => void;
};

export default function ImportPreviewTable({
  categories,
  rows,
  onChangeDraft,
}: ImportPreviewTableProps) {
  return (
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[7%] whitespace-nowrap">Linha</TableHead>
          <TableHead className="w-[28%]">Descricao</TableHead>
          <TableHead className="w-[11%] whitespace-nowrap">Valor</TableHead>
          <TableHead className="w-[13%] whitespace-nowrap">Data</TableHead>
          <TableHead className="w-[12%] whitespace-nowrap">Tipo</TableHead>
          <TableHead className="w-[15%]">
            <div className="flex items-center gap-1.5">
              <span>Categoria</span>
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Regra de categoria"
                    >
                      <Info size={12} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
                    Se nenhuma categoria for escolhida em uma despesa, a importação usa a categoria Outros.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableHead>
          <TableHead className="w-[14%]">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <ImportPreviewRow
            key={`${row.previewToken}:${row.item.rowIndex}`}
            draft={row.draft}
            item={row.item}
            previewToken={row.previewToken}
            categories={categories}
            onChange={onChangeDraft}
          />
        ))}
      </TableBody>
    </Table>
  );
}
