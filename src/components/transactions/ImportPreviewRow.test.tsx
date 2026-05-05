import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImportPreviewRow from "@/components/transactions/ImportPreviewRow";
import { Table, TableBody } from "@/components/ui/table";
import type { BankItem, CategoryItem, ImportPreviewItem, ImportReviewDraft } from "@/types/api";

const banks: BankItem[] = [
  {
    id: 1,
    slug: "itau",
    name: "Itau",
    accountType: "bank_account",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-orange-500",
    currentBalance: 0,
    formattedBalance: "R$ 0,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
  {
    id: 9,
    slug: "nubank",
    name: "Nubank",
    accountType: "credit_card",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: 1,
    statementDueDay: 7,
    connected: true,
    color: "bg-purple-500",
    currentBalance: 0,
    formattedBalance: "R$ 0,00",
    creditLimit: 5000,
    formattedCreditLimit: "R$ 5.000,00",
  },
];

const categories: CategoryItem[] = [
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

const draft: ImportReviewDraft = {
  rowIndex: 1,
  description: "Transferencia recebida",
  amount: "396.00",
  occurredOn: "2026-03-28",
  type: "expense",
  categoryId: "",
  bankConnectionId: "",
  sourceKind: "bank_statement",
  exclude: false,
  ignoreDuplicate: false,
  selected: false,
};

const item: ImportPreviewItem = {
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
  type: "expense",
  suggestedCategoryId: null,
  suggestedCategoryLabel: null,
  suggestionSource: null,
  importSource: "bank_statement",
  sourceKind: "bank_statement",
  bankConnectionId: "",
  bankConnectionName: "Conta a definir",
  matchedRuleId: null,
  aiSuggestedType: null,
  aiSuggestedCategoryId: null,
  aiSuggestedCategoryLabel: null,
  aiConfidence: null,
  aiReason: null,
  aiStatus: "idle",
  possibleDuplicate: true,
  duplicateReason: "Já existe uma transação importada com os mesmos dados.",
  canImport: false,
  requiresCategorySelection: false,
  requiresUserAction: true,
  defaultExclude: false,
  warnings: [],
  errors: [],
  issues: [{ level: "warning", message: "Revise esta linha." }],
  confidence: 0.4,
  externalId: "txn-1",
  rawMetadata: null,
};

describe("ImportPreviewRow", () => {
  it("shows duplicate status and issue text", () => {
    render(
      <Table>
        <TableBody>
          <ImportPreviewRow
            banks={banks}
            categories={categories}
            row={{
              key: "preview-1:1",
              draft,
              item,
              frontendErrors: [],
              hasError: false,
              hasWarning: true,
              isDuplicate: true,
              isIgnored: false,
              needsReview: true,
            }}
            onChange={vi.fn()}
            onOpenCreateCategory={vi.fn()}
          />
        </TableBody>
      </Table>,
    );

    expect(screen.getByText(/possível/i)).toBeInTheDocument();
    expect(screen.getByText(/revise esta linha/i)).toBeInTheDocument();
    expect(screen.getByText(/id externo: txn-1/i)).toBeInTheDocument();
  });

  it("emits ignore actions", () => {
    const onChange = vi.fn();

    render(
      <Table>
        <TableBody>
          <ImportPreviewRow
            banks={banks}
            categories={categories}
            row={{
              key: "preview-1:1",
              draft,
              item,
              frontendErrors: [],
              hasError: false,
              hasWarning: true,
              isDuplicate: true,
              isIgnored: false,
              needsReview: true,
            }}
            onChange={onChange}
            onOpenCreateCategory={vi.fn()}
          />
        </TableBody>
      </Table>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ignorar" }));

    expect(onChange).toHaveBeenCalledWith("preview-1:1", {
      exclude: true,
    });
  });
});
