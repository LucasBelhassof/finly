import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("import-ai-service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults provider to openclaw when not configured", async () => {
    const { getImportAiConfig } = await import("./import-ai-service.js");

    process.env.IMPORT_AI_ENABLED = "false";
    delete process.env.IMPORT_AI_PROVIDER;

    expect(getImportAiConfig().provider).toBe("openclaw");
    expect(getImportAiConfig().fallbackProviders).toEqual([]);
  });

  it("degrades gracefully when OpenAI is selected without OPENAI_API_KEY", async () => {
    const { suggestImportCategories } = await import("./import-ai-service.js");

    process.env.IMPORT_AI_ENABLED = "true";
    process.env.IMPORT_AI_MODE = "direct";
    process.env.IMPORT_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "";

    await expect(
      suggestImportCategories({
        items: [],
        categories: [],
      }),
    ).resolves.toMatchObject({
      status: "disabled",
      provider: "openai",
    });
  });

  it("degrades gracefully when Gemini is selected without GEMINI_API_KEY", async () => {
    const { suggestImportCategories } = await import("./import-ai-service.js");

    process.env.IMPORT_AI_ENABLED = "true";
    process.env.IMPORT_AI_MODE = "direct";
    process.env.IMPORT_AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "";

    await expect(
      suggestImportCategories({
        items: [],
        categories: [],
      }),
    ).resolves.toMatchObject({
      status: "disabled",
      provider: "gemini",
    });
  });

  it("keeps webhook mode isolated from direct provider keys", async () => {
    const webhookMock = vi.fn().mockResolvedValue([]);

    vi.doMock("./import-ai-provider-webhook.js", () => ({
      requestWebhookImportAiSuggestions: webhookMock,
    }));

    const { suggestImportCategories } = await import("./import-ai-service.js");

    process.env.IMPORT_AI_ENABLED = "true";
    process.env.IMPORT_AI_MODE = "webhook";
    process.env.IMPORT_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "";
    process.env.IMPORT_AI_WEBHOOK_URL = "https://example.test/webhook";

    const result = await suggestImportCategories({
      items: [{ rowIndex: 1 }],
      categories: [],
    });

    expect(webhookMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("completed");
  });

  it("degrades to disabled when OpenClaw is unavailable", async () => {
    vi.doMock("./shared/openclaw-client.js", () => {
      class OpenClawSocketError extends Error {
        code: string;

        constructor(code: string, message: string) {
          super(message);
          this.name = "OpenClawSocketError";
          this.code = code;
        }
      }

      return {
        OpenClawSocketError,
        sendMessage: vi.fn().mockRejectedValue(new OpenClawSocketError("timeout", "O OpenClaw nao respondeu.")),
      };
    });

    const { suggestImportCategories } = await import("./import-ai-service.js");

    process.env.IMPORT_AI_ENABLED = "true";
    process.env.IMPORT_AI_MODE = "direct";
    process.env.IMPORT_AI_PROVIDER = "openclaw";
    process.env.OPENCLAW_BASE_URL = "wss://127.0.0.1:11434/ws";
    process.env.OPENCLAW_MODEL = "openclaw-test";

    const result = await suggestImportCategories({
      items: [{ rowIndex: 1 }],
      categories: [],
    });

    expect(result.status).toBe("disabled");
    expect(result.items).toEqual([]);
    expect(result.provider).toBe("openclaw");
  });

  it("falls back to the next configured provider when openclaw fails", async () => {
    const openClawSendMock = vi.fn().mockRejectedValue(new Error("socket down"));
    const directProviderMock = vi.fn().mockResolvedValue([
      {
        rowIndex: 1,
        suggestedType: "expense",
        categoryKey: "transport",
        confidence: 0.9,
        reason: "Fallback provider.",
        status: "suggested",
      },
    ]);

    vi.doMock("./shared/openclaw-client.js", () => ({
      OpenClawSocketError: class OpenClawSocketError extends Error {
        code: string;

        constructor(code: string, message: string) {
          super(message);
          this.name = "OpenClawSocketError";
          this.code = code;
        }
      },
      sendMessage: openClawSendMock,
    }));
    vi.doMock("./import-ai-provider-direct.js", () => ({
      normalizeAiCategorizationResults: vi.fn((value) => value.items),
      requestDirectImportAiSuggestions: directProviderMock,
    }));

    const { suggestImportCategories } = await import("./import-ai-service.js");

    process.env.IMPORT_AI_ENABLED = "true";
    process.env.IMPORT_AI_MODE = "direct";
    process.env.IMPORT_AI_PROVIDER = "openclaw,openai";
    process.env.OPENAI_API_KEY = "openai-test-key";

    const result = await suggestImportCategories({
      items: [{ rowIndex: 1, description: "Uber" }],
      categories: [],
    });

    expect(openClawSendMock).toHaveBeenCalledTimes(1);
    expect(directProviderMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        provider: "openai",
      }),
    );
    expect(result.status).toBe("completed");
    expect(result.provider).toBe("openai");
  });
});
