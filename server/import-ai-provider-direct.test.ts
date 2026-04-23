import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildProviderRequest,
  extractStructuredBody,
  normalizeAiCategorizationResults,
  requestDirectImportAiSuggestions,
} from "./import-ai-provider-direct.js";

describe("import-ai-provider-direct", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds an OpenAI HTTP request with json_schema structured output", () => {
    const request = buildProviderRequest(
      "openai",
      {
        items: [{ rowIndex: 1, description: "Uber", normalizedDescription: "uber", type: "expense" }],
        categories: [{ categoryKey: "transport", label: "Transporte" }],
      },
      {
        model: "gpt-test",
        openAiApiKey: "test-key",
        geminiApiKey: "",
        timeoutMs: 8000,
      },
    );

    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer test-key");
    expect(request.body.model).toBe("gpt-test");
    expect(request.body.response_format.type).toBe("json_schema");
    expect(request.body.response_format.json_schema.strict).toBe(true);
  });

  it("builds an OpenClaw HTTP request with local OpenAI-compatible schema output", () => {
    const request = buildProviderRequest(
      "openclaw",
      {
        items: [{ rowIndex: 1, description: "Uber", normalizedDescription: "uber", type: "expense" }],
        categories: [{ categoryKey: "transport", label: "Transporte" }],
      },
      {
        model: "openclaw-test",
        openClawBaseUrl: "http://127.0.0.1:11434/v1",
        openClawApiKey: "local-key",
        openAiApiKey: "",
        geminiApiKey: "",
        timeoutMs: 8000,
      },
    );

    expect(request.url).toBe("http://127.0.0.1:11434/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer local-key");
    expect(request.body.model).toBe("openclaw-test");
    expect(request.body.response_format.type).toBe("json_schema");
  });

  it("builds a Gemini HTTP request with JSON schema output", () => {
    const request = buildProviderRequest(
      "gemini",
      {
        items: [{ rowIndex: 1, description: "Uber", normalizedDescription: "uber", type: "expense" }],
        categories: [{ categoryKey: "transport", label: "Transporte" }],
      },
      {
        model: "gemini-test",
        openAiApiKey: "",
        geminiApiKey: "gem-key",
        timeoutMs: 8000,
      },
    );

    expect(request.url).toContain("models/gemini-test:generateContent");
    expect(request.url).toContain("key=gem-key");
    expect(request.body.generationConfig.responseMimeType).toBe("application/json");
    expect(request.body.generationConfig.responseJsonSchema).toBeTruthy();
  });

  it("extracts and normalizes a valid OpenAI structured response", async () => {
    process.env.IMPORT_AI_PROVIDER = "openai";
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
                  content: JSON.stringify({
                    items: [
                      {
                        rowIndex: 1,
                        suggestedType: "expense",
                        categoryKey: "transport",
                        confidence: 0.91,
                        reason: "Descricao relacionada a corrida.",
                        status: "suggested",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
      }),
    );

    const items = await requestDirectImportAiSuggestions({
      items: [{ rowIndex: 1, description: "Uber", normalizedDescription: "uber", type: "expense" }],
      categories: [{ categoryKey: "transport", label: "Transporte" }],
    });

    expect(items).toEqual([
      {
        rowIndex: 1,
        suggestedType: "expense",
        categoryKey: "transport",
        confidence: 0.91,
        reason: "Descricao relacionada a corrida.",
        status: "suggested",
      },
    ]);
  });

  it("uses OpenAI as the default direct provider when no override is provided", async () => {
    delete process.env.IMPORT_AI_PROVIDER;
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
                  content: JSON.stringify({
                    items: [
                      {
                        rowIndex: 1,
                        suggestedType: "expense",
                        categoryKey: "transport",
                        confidence: 0.9,
                        reason: "Descricao de transporte.",
                        status: "suggested",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
      }),
    );

    const items = await requestDirectImportAiSuggestions({
      items: [{ rowIndex: 1, description: "Uber", normalizedDescription: "uber", type: "expense" }],
      categories: [{ categoryKey: "transport", label: "Transporte" }],
    });

    expect(items[0]).toMatchObject({
      rowIndex: 1,
      categoryKey: "transport",
      status: "suggested",
    });
  });

  it("extracts and normalizes a valid Gemini structured response", async () => {
    process.env.IMPORT_AI_PROVIDER = "gemini";
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
                  parts: [
                    {
                      text: JSON.stringify({
                        items: [
                          {
                            rowIndex: 2,
                            suggestedType: null,
                            categoryKey: null,
                            confidence: null,
                            reason: "Descricao insuficiente.",
                            status: "no_match",
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      }),
    );

    const items = await requestDirectImportAiSuggestions({
      items: [{ rowIndex: 2, description: "PIX", normalizedDescription: "pix", type: "income" }],
      categories: [{ categoryKey: "salary", label: "Salario" }],
    });

    expect(items).toEqual([
      {
        rowIndex: 2,
        suggestedType: null,
        categoryKey: null,
        confidence: null,
        reason: "Descricao insuficiente.",
        status: "no_match",
      },
    ]);
  });

  it("accepts no_match with semantic type but without categoryKey", () => {
    const items = normalizeAiCategorizationResults({
      items: [
        {
          rowIndex: 5,
          suggestedType: "income",
          categoryKey: null,
          confidence: 0.89,
          reason: "Transferencia recebida sem categoria especifica.",
          status: "no_match",
        },
      ],
    });

    expect(items).toEqual([
      {
        rowIndex: 5,
        suggestedType: "income",
        categoryKey: null,
        confidence: 0.89,
        reason: "Transferencia recebida sem categoria especifica.",
        status: "no_match",
      },
    ]);
  });

  it("marks malformed provider items as invalid conservatively", () => {
    const items = normalizeAiCategorizationResults({
      items: [
        {
          rowIndex: 3,
          suggestedType: "expense",
          categoryKey: "transport",
          confidence: 4,
          reason: "Confianca invalida.",
          status: "suggested",
        },
      ],
    });

    expect(items).toEqual([
      {
        rowIndex: 3,
        suggestedType: null,
        categoryKey: null,
        confidence: null,
        reason: "Confianca invalida.",
        status: "invalid",
      },
    ]);
  });

  it("marks a suggested item without suggestedType as invalid", () => {
    const items = normalizeAiCategorizationResults({
      items: [
        {
          rowIndex: 4,
          suggestedType: null,
          categoryKey: "salary",
          confidence: 0.92,
          reason: "Recebimento identificado.",
          status: "suggested",
        },
      ],
    });

    expect(items).toEqual([
      {
        rowIndex: 4,
        suggestedType: null,
        categoryKey: null,
        confidence: null,
        reason: "Recebimento identificado.",
        status: "invalid",
      },
    ]);
  });

  it("throws a controlled error when the structured body is missing", () => {
    expect(() => extractStructuredBody("openai", { choices: [{ message: { content: "" } }] })).toThrow("OpenAI");
  });
});
