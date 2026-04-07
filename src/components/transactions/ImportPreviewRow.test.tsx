import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImportPreviewRow from "@/components/transactions/ImportPreviewRow";
import { Table, TableBody } from "@/components/ui/table";
import type { CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

const categories: CategoryItem[] = [
  {
    id: 1,
    slug: "receitas",
    label: "Receitas",
    iconName: "Wallet",
    icon: (() => null) as never,
    color: "text-income",
    groupSlug: "receitas",
    groupLabel: "Receitas",
    groupColor: "bg-income",
  },
];

const draft: ImportCommitItem = {
  rowIndex: 1,
  description: "Transferencia recebida",
  amount: "396.00",
  occurredOn: "2026-03-28",
  type: "income",
  categoryId: "",
  exclude: false,
  ignoreDuplicate: false,
};

const item: ImportPreviewItem = {
  rowIndex: 1,
  description: "Transferencia recebida",
  normalizedDescription: "transferencia recebida",
  amount: "396.00",
  normalizedAmount: "396.00",
  occurredOn: "2026-03-28",
  normalizedOccurredOn: "2026-03-28",
  type: "income",
  suggestedCategoryId: null,
  suggestedCategoryLabel: null,
  matchedRuleId: null,
  possibleDuplicate: true,
  duplicateReason: "Ja existe uma transacao importada com os mesmos dados.",
  canImport: false,
  requiresCategorySelection: true,
  requiresUserAction: true,
  warnings: ["Duplicata provavel encontrada."],
  errors: [],
};

describe("ImportPreviewRow", () => {
  it("renders a readable segmented control with the active type highlighted", () => {
    render(
      <Table>
        <TableBody>
          <ImportPreviewRow
            draft={draft}
            item={item}
            categories={categories}
            onChange={vi.fn()}
            onCreateCategory={vi.fn()}
          />
        </TableBody>
      </Table>,
    );

    const expenseButton = screen.getByRole("button", { name: "Despesa" });
    const incomeButton = screen.getByRole("button", { name: "Receita" });

    expect(expenseButton).toBeInTheDocument();
    expect(incomeButton).toBeInTheDocument();
    expect(incomeButton.className).toContain("bg-income");
    expect(expenseButton.className).toContain("flex-1");
  });
});
