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

  it("defaults provider to openai when not configured", async () => {
    const { getImportAiConfig } = await import("./import-ai-service.js");

    process.env.IMPORT_AI_ENABLED = "false";
    delete process.env.IMPORT_AI_PROVIDER;

    expect(getImportAiConfig().provider).toBe("openai");
  });

  it("requires OPENAI_API_KEY for direct OpenAI mode", async () => {
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
    ).rejects.toThrow("OPENAI_API_KEY is required");
  });

  it("requires GEMINI_API_KEY for direct Gemini mode", async () => {
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
    ).rejects.toThrow("GEMINI_API_KEY is required");
  });

  it("keeps webhook mode isolated from direct provider keys", async () => {
    const webhookMock = vi.fn().mockResolvedValue({
      items: [],
      provider: "openai",
      model: "gpt-4o-mini",
      usage: null,
      estimatedCostUsd: null,
    });

    vi.doMock("./import-ai-provider-webhook.js", () => ({
      requestWebhookImportAiSuggestionsWithTelemetry: webhookMock,
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
});
