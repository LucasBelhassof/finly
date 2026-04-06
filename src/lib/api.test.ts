import { CircleHelp } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
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
    });

    expect(transaction.formattedAmount).toBe("- R$ 42,90");
    expect(transaction.relativeDate).toBe("Hoje");
    expect(transaction.category.icon).toBe(CircleHelp);
    expect(transaction.category.color).toBe("text-primary");
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
});
