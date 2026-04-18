import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImportPreviewRow from "@/components/transactions/ImportPreviewRow";
import { Table, TableBody } from "@/components/ui/table";
import type { CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

const categories: CategoryItem[] = [
  {
    id: 1,
    slug: "salario",
    label: "Salario",
    transactionType: "income",
    iconName: "Wallet",
    icon: (() => null) as never,
    color: "text-income",
    groupSlug: "receitas",
    groupLabel: "Receitas",
    groupColor: "bg-income",
  },
  {
    id: 2,
    slug: "outros-despesas",
    label: "Outros",
    transactionType: "expense",
    iconName: "Wallet",
    icon: (() => null) as never,
    color: "text-muted-foreground",
    groupSlug: "outros",
    groupLabel: "Outros",
    groupColor: "bg-muted-foreground",
  },
];

const incomeDraft: ImportCommitItem = {
  rowIndex: 1,
  description: "Transferencia recebida",
  amount: "396.00",
  occurredOn: "2026-03-28",
  type: "income",
  categoryId: "",
  exclude: false,
  ignoreDuplicate: false,
};

const baseItem: ImportPreviewItem = {
  rowIndex: 1,
  description: "Transferencia recebida",
  normalizedDescription: "transferencia recebida",
  purchaseDescriptionBase: null,
  normalizedPurchaseDescriptionBase: null,
  amount: "396.00",
  normalizedAmount: "396.00",
  occurredOn: "2026-03-28",
  normalizedOccurredOn: "2026-03-28",
  purchaseOccurredOn: null,
  isInstallment: false,
  installmentIndex: null,
  installmentCount: null,
  generatedInstallmentCount: null,
  type: "income",
  suggestedCategoryId: null,
  suggestedCategoryLabel: null,
  suggestionSource: null,
  importSource: "bank_statement",
  bankConnectionId: 1,
  bankConnectionName: "Itau",
  matchedRuleId: null,
  aiSuggestedType: null,
  aiSuggestedCategoryId: null,
  aiSuggestedCategoryLabel: null,
  aiConfidence: null,
  aiReason: null,
  aiStatus: "idle",
  possibleDuplicate: true,
  duplicateReason: "Ja existe uma transacao importada com os mesmos dados.",
  canImport: false,
  requiresCategorySelection: true,
  requiresUserAction: true,
  defaultExclude: false,
  warnings: ["Duplicata provavel encontrada."],
  errors: [],
};

describe("ImportPreviewRow", () => {
  it("keeps category mandatory for income rows", () => {
    render(
      <Table>
        <TableBody>
          <ImportPreviewRow
            draft={incomeDraft}
            item={baseItem}
            categories={categories}
            onChange={vi.fn()}
            onCreateCategory={vi.fn()}
            previewToken="preview-1"
          />
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("button", { name: /Duplicata na linha 1/i })).toBeInTheDocument();
  });

  it("shows fallback guidance for expenses without category", () => {
    render(
      <Table>
        <TableBody>
          <ImportPreviewRow
            draft={{ ...incomeDraft, type: "expense", categoryId: "" }}
            item={{ ...baseItem, type: "expense", requiresCategorySelection: false, canImport: true, requiresUserAction: false }}
            categories={categories}
            onChange={vi.fn()}
            onCreateCategory={vi.fn()}
            previewToken="preview-1"
          />
        </TableBody>
      </Table>,
    );

    expect(screen.queryByText("Categoria obrigatoria")).not.toBeInTheDocument();
    expect(screen.getByText(/sera importada como Outros/i)).toBeInTheDocument();
  });

  it("shows history and recurring source badges from the preview", () => {
    render(
      <Table>
        <TableBody>
          <ImportPreviewRow
            draft={{ ...incomeDraft, categoryId: 1 }}
            item={{
              ...baseItem,
              suggestionSource: "history",
              suggestedCategoryLabel: "Salario",
            }}
            categories={categories}
            onChange={vi.fn()}
            onCreateCategory={vi.fn()}
            previewToken="preview-1"
          />
          <ImportPreviewRow
            draft={{ ...incomeDraft, rowIndex: 2, categoryId: 1 }}
            item={{
              ...baseItem,
              rowIndex: 2,
              suggestionSource: "recurring_rule",
              suggestedCategoryLabel: "Salario",
            }}
            categories={categories}
            onChange={vi.fn()}
            onCreateCategory={vi.fn()}
            previewToken="preview-2"
          />
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("button", { name: /Duplicata na linha 1/i })).toBeInTheDocument();
    expect(screen.getByText(/Historico do usuario: Receita - Salario/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Duplicata na linha 2/i })).toBeInTheDocument();
    expect(screen.getByText(/Regra recorrente: Receita - Salario/i)).toBeInTheDocument();
  });

  it("shows installment expansion details when the row is parcelled", () => {
    render(
      <Table>
        <TableBody>
          <ImportPreviewRow
            draft={{ ...incomeDraft, type: "expense", categoryId: 2 }}
            item={{
              ...baseItem,
              type: "expense",
              isInstallment: true,
              installmentIndex: 3,
              installmentCount: 10,
              generatedInstallmentCount: 8,
              canImport: true,
              requiresCategorySelection: false,
              requiresUserAction: false,
            }}
            categories={categories}
            onChange={vi.fn()}
            onCreateCategory={vi.fn()}
            previewToken="preview-1"
          />
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("button", { name: /Duplicata na linha 1/i })).toBeInTheDocument();
    expect(screen.getByText(/Parcela detectada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Detalhes da parcela da linha 1/i })).toBeInTheDocument();
  });
});
