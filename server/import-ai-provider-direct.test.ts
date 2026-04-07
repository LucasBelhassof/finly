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
        categoryKey: "transport",
        confidence: 0.91,
        reason: "Descricao relacionada a corrida.",
        status: "suggested",
      },
    ]);
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
        categoryKey: null,
        confidence: null,
        reason: "Descricao insuficiente.",
        status: "no_match",
      },
    ]);
  });

  it("marks malformed provider items as invalid conservatively", () => {
    const items = normalizeAiCategorizationResults({
      items: [
        {
          rowIndex: 3,
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
        categoryKey: null,
        confidence: null,
        reason: "Confianca invalida.",
        status: "invalid",
      },
    ]);
  });

  it("throws a controlled error when the structured body is missing", () => {
    expect(() => extractStructuredBody("openai", { choices: [{ message: { content: "" } }] })).toThrow(
      "A OpenAI nao retornou conteudo estruturado.",
    );
  });
});
