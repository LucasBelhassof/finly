import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildChatProviderRequest,
  extractChatResponse,
  getDirectChatProviderConfig,
  requestDirectChatReply,
  requestDirectChatReplyByProvider,
} from "./chat-ai-provider-direct.js";

describe("chat-ai-provider-direct", () => {
  const originalEnv = { ...process.env };
  const payload = {
    generatedAt: "2026-04-23",
    context: {
      user: { id: 1, name: "Lucas", email: "lucas@example.com" },
      summaryCards: [{ label: "Saldo Total", formattedValue: "R$ 1.000,00" }],
    },
    history: [
      { role: "user", content: "Como economizar?", createdAt: "2026-04-23T10:00:00.000Z" },
      { role: "assistant", content: "Vamos analisar.", createdAt: "2026-04-23T10:00:01.000Z" },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds an OpenAI chat request with developer instructions and history", () => {
    const request = buildChatProviderRequest("openai", payload, {
      model: "gpt-test",
      openAiApiKey: "test-key",
      geminiApiKey: "",
      timeoutMs: 12000,
    });

    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer test-key");
    expect(request.body.model).toBe("gpt-test");
    expect(request.body.messages[0].role).toBe("developer");
    expect(request.body.messages[1]).toMatchObject({
      role: "user",
      content: "Como economizar?",
    });
  });

  it("builds a Gemini chat request with system instruction and history", () => {
    const request = buildChatProviderRequest("gemini", payload, {
      model: "gemini-test",
      openAiApiKey: "",
      geminiApiKey: "gem-key",
      timeoutMs: 12000,
    });

    expect(request.url).toContain("models/gemini-test:generateContent");
    expect(request.headers["x-goog-api-key"]).toBe("gem-key");
    expect(request.body.system_instruction.parts[0].text).toContain("Assistente Finly");
    expect(request.body.contents[1]).toEqual({
      role: "model",
      parts: [{ text: "Vamos analisar." }],
    });
  });

  it("extracts a plain text OpenAI reply", () => {
    expect(
      extractChatResponse("openai", {
        choices: [{ message: { content: "Corte 10% em restaurantes nesta semana." } }],
      }),
    ).toEqual({
      text: "Corte 10% em restaurantes nesta semana.",
      truncated: false,
    });
  });

  it("extracts a Gemini reply from candidate parts", () => {
    expect(
      extractChatResponse("gemini", {
        candidates: [
          {
            content: {
              parts: [{ text: "Revise assinaturas e defina um teto semanal." }],
            },
          },
        ],
      }),
    ).toEqual({
      text: "Revise assinaturas e defina um teto semanal.",
      truncated: false,
    });
  });

  it("requests and normalizes a valid OpenAI chat response", async () => {
    process.env.CHAT_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "Seu maior gasto esta em moradia. Posso montar um plano para 30 dias.",
                },
              },
            ],
          }),
      }),
    );

    await expect(requestDirectChatReply(payload)).resolves.toEqual({
      content: "Seu maior gasto esta em moradia. Posso montar um plano para 30 dias.",
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("requests and normalizes a valid Gemini chat response", async () => {
    process.env.CHAT_AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gem-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Seu fluxo de caixa pede cautela com parcelamentos novos." }],
                },
              },
            ],
          }),
      }),
    );

    await expect(requestDirectChatReply(payload)).resolves.toEqual({
      content: "Seu fluxo de caixa pede cautela com parcelamentos novos.",
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  it("defaults chat provider to gemini", () => {
    process.env.CHAT_AI_PROVIDER = "";
    process.env.GEMINI_API_KEY = "";
    process.env.OPENAI_API_KEY = "";

    expect(getDirectChatProviderConfig()).toMatchObject({
      provider: "gemini",
      fallbackProvider: "openai",
    });
  });

  it("allows requesting a specific provider explicitly", async () => {
    process.env.GEMINI_API_KEY = "gem-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Resposta Gemini." }],
                },
              },
            ],
          }),
      }),
    );

    await expect(requestDirectChatReplyByProvider(payload, "gemini")).resolves.toEqual({
      content: "Resposta Gemini.",
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  it("continues when OpenAI stops due to token length", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  finish_reason: "length",
                  message: {
                    content: "Plano de viagem: reserve 20% da renda mensal",
                  },
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content: " e reduza gastos variaveis para acumular a meta ate dezembro.",
                  },
                },
              ],
            }),
        }),
    );

    await expect(requestDirectChatReplyByProvider(payload, "openai")).resolves.toEqual({
      content: "Plano de viagem: reserve 20% da renda mensal e reduza gastos variaveis para acumular a meta ate dezembro.",
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });
});
