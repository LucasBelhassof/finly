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
    <Table className="min-w-[1200px]">
      <TableHeader>
        <TableRow>
          <TableHead>Linha</TableHead>
          <TableHead>Descricao</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Acoes</TableHead>
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
