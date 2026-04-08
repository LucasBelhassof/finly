import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

import ImportPreviewRow from "./ImportPreviewRow";

type ImportPreviewTableProps = {
  categories: CategoryItem[];
  drafts: Record<number, ImportCommitItem>;
  items: ImportPreviewItem[];
  onChangeDraft: (rowIndex: number, patch: Partial<ImportCommitItem>) => void;
  onCreateCategory: (rowIndex: number) => void;
};

export default function ImportPreviewTable({
  categories,
  drafts,
  items,
  onChangeDraft,
  onCreateCategory,
}: ImportPreviewTableProps) {
  return (
    <Table className="min-w-[1020px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[72px]">Linha</TableHead>
          <TableHead className="min-w-[240px]">Descricao</TableHead>
          <TableHead className="w-[132px]">Valor</TableHead>
          <TableHead className="w-[144px]">Data</TableHead>
          <TableHead className="w-[176px]">Tipo</TableHead>
          <TableHead className="min-w-[180px]">Categoria</TableHead>
          <TableHead className="min-w-[200px]">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ImportPreviewRow
            key={item.rowIndex}
            item={item}
            draft={drafts[item.rowIndex]}
            categories={categories}
            onChange={onChangeDraft}
            onCreateCategory={onCreateCategory}
          />
        ))}
      </TableBody>
    </Table>
  );
}
