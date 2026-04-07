import { CircleHelp } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  mapImportAiSuggestionsResponse,
  mapImportCommitResponse,
  mapImportPreviewResponse,
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
          amount: "67.90",
          normalizedAmount: "67.90",
          occurredOn: "2026-04-06",
          normalizedOccurredOn: "2026-04-06",
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
          amount: "396.00",
          normalizedAmount: "396.00",
          occurredOn: "2026-04-06",
          normalizedOccurredOn: "2026-04-06",
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
          amount: "396.00",
          normalizedAmount: "396.00",
          occurredOn: "2026-04-06",
          normalizedOccurredOn: "2026-04-06",
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
});
