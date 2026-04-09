import { CircleHelp } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  mapImportAiSuggestionsResponse,
  mapImportCommitResponse,
  mapImportPreviewResponse,
  mapInstallmentsOverviewResponse,
  mapChatMessagesResponse,
  mapChatReplyResponse,
  mapSpendingResponse,
  mapTransaction,
} from "@/lib/api";

describe("api mappers", () => {
  it("maps transactions and falls back to a safe icon", () => {
    const transaction = mapTransaction({
      id: 12,
      description: "Mercado",
      amount: -42.9,
      formattedAmount: "- R$ 42,90",
      occurredOn: "2026-04-06",
      relativeDate: "Hoje",
      category: {
        slug: "supermercado",
        label: "Supermercado",
        icon: "UnknownIcon",
        color: "text-primary",
      },
      account: {
        id: 2,
        slug: "caixa",
        name: "Caixa/Dinheiro",
        accountType: "cash",
        color: "bg-amber-500",
      },
    });

    expect(transaction.formattedAmount).toBe("- R$ 42,90");
    expect(transaction.relativeDate).toBe("Hoje");
    expect(transaction.category.icon).toBe(CircleHelp);
    expect(transaction.category.color).toBe("text-primary");
    expect(transaction.account.name).toBe("Caixa/Dinheiro");
    expect(transaction.account.accountType).toBe("cash");
    expect(transaction.isInstallment).toBe(false);
  });

  it("maps spending payloads with sane defaults", () => {
    const spending = mapSpendingResponse({
      spending: [
        {
          slug: "alimentacao",
          label: "Alimentacao",
          total: 1120.45,
          formattedTotal: "R$ 1.120,45",
          color: "bg-warning",
          percentage: 145,
        },
        {
          label: undefined,
          total: undefined,
          percentage: undefined,
        },
      ],
    });

    expect(spending[0]).toEqual({
      slug: "alimentacao",
      label: "Alimentacao",
      total: 1120.45,
      formattedTotal: "R$ 1.120,45",
      color: "bg-warning",
      percentage: 100,
    });
    expect(spending[1]).toMatchObject({
      slug: "outros",
      label: "Outros",
      total: 0,
      color: "bg-muted-foreground",
      percentage: 0,
    });
    expect(spending[1].formattedTotal).toContain("0,00");
  });

  it("maps chat payloads and reply payloads", () => {
    const messages = mapChatMessagesResponse({
      messages: [
        {
          id: 1,
          role: "assistant",
          content: "Oi",
          createdAt: "2026-04-06T10:00:00.000Z",
        },
      ],
    });

    const reply = mapChatReplyResponse({
      userMessage: {
        id: 2,
        role: "user",
        content: "Como economizar?",
        createdAt: "2026-04-06T10:01:00.000Z",
      },
      assistantMessage: {
        id: 3,
        role: "assistant",
        content: "Comece pelo delivery.",
        createdAt: "2026-04-06T10:01:01.000Z",
      },
    });

    expect(messages[0]).toEqual({
      id: 1,
      role: "assistant",
      content: "Oi",
      createdAt: "2026-04-06T10:00:00.000Z",
    });
    expect(reply.userMessage.role).toBe("user");
    expect(reply.assistantMessage.role).toBe("assistant");
    expect(reply.assistantMessage.content).toBe("Comece pelo delivery.");
  });

  it("maps import preview and commit payloads", () => {
    const preview = mapImportPreviewResponse({
      previewToken: "preview-1",
      expiresAt: "2026-04-06T10:15:00.000Z",
      importSource: "credit_card_statement",
      bankConnectionId: 9,
      bankConnectionName: "Nubank",
      fileMetadata: {
        originalFilename: "Nubank_2026-03-27.csv",
        issuerName: "Nubank",
        statementDueDate: "2026-03-27",
        statementReferenceMonth: "2026-03",
      },
      fileSummary: {
        totalRows: 3,
        importableRows: 1,
        errorRows: 1,
        duplicateRows: 1,
        actionRequiredRows: 2,
      },
      items: [
        {
          rowIndex: 1,
          description: "iFood",
          normalizedDescription: "ifood",
          purchaseDescriptionBase: null,
          normalizedPurchaseDescriptionBase: null,
          amount: "67.90",
          normalizedAmount: "67.90",
          occurredOn: "2026-04-06",
          normalizedOccurredOn: "2026-04-06",
          purchaseOccurredOn: null,
          type: "expense",
          bankConnectionId: 9,
          bankConnectionName: "Nubank",
          suggestedCategoryId: 12,
          suggestedCategoryLabel: "Restaurantes",
          suggestionSource: "rule",
          importSource: "credit_card_statement",
          matchedRuleId: "ifood",
          aiSuggestedType: null,
          aiSuggestedCategoryId: null,
          aiSuggestedCategoryLabel: null,
          aiConfidence: null,
          aiReason: null,
          aiStatus: "idle",
          possibleDuplicate: true,
          duplicateReason: "Ja existe uma transacao importada com os mesmos dados.",
          canImport: true,
          requiresCategorySelection: false,
          requiresUserAction: true,
          defaultExclude: false,
          warnings: ["Duplicata provavel encontrada."],
          errors: [],
        },
      ],
    });

    const commit = mapImportCommitResponse({
      importedCount: 1,
      skippedCount: 1,
      failedCount: 0,
      results: [
        {
          rowIndex: 1,
          status: "imported",
          reason: "success",
          message: "Linha importada com sucesso.",
          transaction: {
            id: 40,
            description: "iFood",
            amount: -67.9,
            occurredOn: "2026-04-06",
            installmentPurchaseId: 51,
            installmentNumber: 2,
            installmentCount: 10,
            purchaseOccurredOn: "2026-03-15",
            isInstallment: true,
            account: {
              id: 9,
              slug: "nubank",
              name: "Nubank",
              accountType: "credit_card",
              color: "bg-purple-500",
            },
            category: {
              id: 12,
              slug: "restaurantes",
              label: "Restaurantes",
            },
          },
        },
      ],
    });

    expect(preview.previewToken).toBe("preview-1");
    expect(preview.importSource).toBe("credit_card_statement");
    expect(preview.bankConnectionName).toBe("Nubank");
    expect(preview.fileMetadata.issuerName).toBe("Nubank");
    expect(preview.fileMetadata.statementDueDate).toBe("2026-03-27");
    expect(preview.fileMetadata.statementReferenceMonth).toBe("2026-03");
    expect(preview.fileSummary.duplicateRows).toBe(1);
    expect(preview.items[0].matchedRuleId).toBe("ifood");
    expect(preview.items[0].possibleDuplicate).toBe(true);
    expect(preview.items[0].suggestionSource).toBe("rule");

    expect(commit.importedCount).toBe(1);
    expect(commit.results[0].status).toBe("imported");
    expect(commit.results[0].transaction?.description).toBe("iFood");
    expect(commit.results[0].transaction?.account.name).toBe("Nubank");
    expect(commit.results[0].transaction?.installmentNumber).toBe(2);
    expect(commit.results[0].transaction?.purchaseOccurredOn).toBe("2026-03-15");
  });

  it("maps preview suggestion sources from history and recurring rules", () => {
    const preview = mapImportPreviewResponse({
      previewToken: "preview-2",
      expiresAt: "2026-04-06T10:15:00.000Z",
      bankConnectionId: 1,
      bankConnectionName: "Itau",
      fileSummary: {
        totalRows: 2,
        importableRows: 2,
        errorRows: 0,
        duplicateRows: 0,
        actionRequiredRows: 0,
      },
      items: [
        {
          rowIndex: 1,
          description: "PIX Levi",
          normalizedDescription: "pix levi",
          purchaseDescriptionBase: null,
          normalizedPurchaseDescriptionBase: null,
          amount: "396.00",
          normalizedAmount: "396.00",
          occurredOn: "2026-04-06",
          normalizedOccurredOn: "2026-04-06",
          purchaseOccurredOn: null,
          type: "income",
          bankConnectionId: 1,
          bankConnectionName: "Itau",
          suggestedCategoryId: 3,
          suggestedCategoryLabel: "Salario",
          suggestionSource: "history",
          matchedRuleId: null,
          aiStatus: "idle",
          possibleDuplicate: false,
          canImport: true,
          requiresCategorySelection: false,
          requiresUserAction: false,
          warnings: [],
          errors: [],
        },
        {
          rowIndex: 2,
          description: "PIX Levi",
          normalizedDescription: "pix levi",
          purchaseDescriptionBase: null,
          normalizedPurchaseDescriptionBase: null,
          amount: "396.00",
          normalizedAmount: "396.00",
          occurredOn: "2026-04-06",
          normalizedOccurredOn: "2026-04-06",
          purchaseOccurredOn: null,
          type: "income",
          bankConnectionId: 1,
          bankConnectionName: "Itau",
          suggestedCategoryId: 3,
          suggestedCategoryLabel: "Salario",
          suggestionSource: "recurring_rule",
          matchedRuleId: null,
          aiStatus: "idle",
          possibleDuplicate: false,
          canImport: true,
          requiresCategorySelection: false,
          requiresUserAction: false,
          warnings: [],
          errors: [],
        },
      ],
    });

    expect(preview.items[0].suggestionSource).toBe("history");
    expect(preview.items[1].suggestionSource).toBe("recurring_rule");
  });

  it("maps import AI suggestion payloads", () => {
    const result = mapImportAiSuggestionsResponse({
      previewToken: "preview-1",
      status: "completed",
      autoApplyThreshold: 0.8,
      summary: {
        requestedRows: 2,
        suggestedRows: 1,
        noMatchRows: 1,
        failedRows: 0,
      },
      items: [
        {
          rowIndex: 2,
          aiSuggestedType: "income",
          aiSuggestedCategoryId: 3,
          aiSuggestedCategoryLabel: "Salario",
          aiConfidence: 0.88,
          aiReason: "Recebimento recorrente.",
          aiStatus: "suggested",
          suggestionSource: "ai",
        },
      ],
    });

    expect(result.previewToken).toBe("preview-1");
    expect(result.autoApplyThreshold).toBe(0.8);
    expect(result.items[0].aiStatus).toBe("suggested");
    expect(result.items[0].aiConfidence).toBe(0.88);
    expect(result.items[0].aiSuggestedType).toBe("income");
    expect(result.items[0].suggestionSource).toBe("ai");
  });

  it("maps installments overview payloads", () => {
    const result = mapInstallmentsOverviewResponse({
      applied_filters: {
        cardId: 2,
        categoryId: "all",
        status: "overdue",
        installmentAmountMin: 50,
        installmentAmountMax: 300,
        installmentCountMode: "remaining_installments",
        installmentCountValue: 6,
        purchaseStart: "2026-01-01",
        purchaseEnd: "2026-12-31",
        sortBy: "smart",
        sortOrder: "desc",
      },
      active_installments_count: 2,
      monthly_commitment: 450,
      remaining_balance_total: 1200,
      original_amount_total: 1800,
      payoff_projection_month: "2026-08",
      alerts: {
        concentration: {
          threshold_ratio: 0.5,
          triggered: true,
          card_id: 2,
          card_name: "Nubank",
          share_ratio: 0.6,
          monthly_amount: 270,
        },
      },
      charts: {
        next_3_months_projection: [{ month: "2026-04", amount: 450 }],
        monthly_commitment_evolution: [{ month: "2026-04", amount: 450 }],
        card_distribution: [{ card_id: 2, card_name: "Nubank", amount: 270, share_ratio: 0.6 }],
        top_categories: [{ category_id: 1, category: "Eletronicos", amount: 270 }],
      },
      filter_options: {
        cards: [{ id: 2, name: "Nubank" }],
        categories: [{ id: 1, label: "Eletronicos" }],
        statuses: ["active", "paid", "overdue"],
        installment_count_values: [2, 8],
        remaining_installment_values: [1, 6],
        installment_amount_range: {
          min: 50,
          max: 300,
        },
      },
      items: [
        {
          transaction_id: 10,
          installment_transaction_id: 10,
          installment_purchase_id: 12,
          description: "Notebook",
          category: "Eletronicos",
          category_id: 1,
          card_id: 2,
          card_name: "Nubank",
          purchase_date: "2026-02-01",
          total_amount: 1200,
          installment_amount: 150,
          installment_count: 8,
          current_installment: 3,
          display_installment_number: 3,
          remaining_installments: 6,
          remaining_balance: 900,
          next_due_date: "2026-04-15",
          installment_due_date: "2026-04-15",
          installment_month: "2026-04",
          status: "overdue",
        },
      ],
    });

    expect(result.appliedFilters.cardId).toBe("2");
    expect(result.appliedFilters.installmentCountMode).toBe("remaining_installments");
    expect(result.appliedFilters.installmentCountValue).toBe(6);
    expect(result.alerts.concentration.triggered).toBe(true);
    expect(result.filterOptions.statuses).toEqual(["active", "paid", "overdue"]);
    expect(result.filterOptions.installmentCountValues).toEqual([2, 8]);
    expect(result.filterOptions.remainingInstallmentValues).toEqual([1, 6]);
    expect(result.items[0].status).toBe("overdue");
    expect(result.items[0].installmentAmount).toBe(150);
    expect(result.items[0].displayInstallmentNumber).toBe(3);
    expect(result.items[0].installmentDueDate).toBe("2026-04-15");
    expect(result.items[0].installmentMonth).toBe("2026-04");
  });
});
