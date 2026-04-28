import { requestDirectImportAiSuggestionsWithTelemetry } from "./import-ai-provider-direct.js";
import { requestWebhookImportAiSuggestionsWithTelemetry } from "./import-ai-provider-webhook.js";

function parseBooleanFlag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "true";
}

function parseNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getImportAiConfig() {
  return {
    enabled: parseBooleanFlag(process.env.IMPORT_AI_ENABLED),
    mode: process.env.IMPORT_AI_MODE?.trim() === "webhook" ? "webhook" : "direct",
    provider: process.env.IMPORT_AI_PROVIDER?.trim() === "gemini" ? "gemini" : "openai",
    model: process.env.IMPORT_AI_MODEL?.trim() || "",
    autoApplyThreshold: Math.max(0, Math.min(1, parseNumber(process.env.IMPORT_AI_AUTO_APPLY_THRESHOLD, 0.8))),
    maxRowsPerRequest: Math.max(1, Math.floor(parseNumber(process.env.IMPORT_AI_MAX_ROWS_PER_REQUEST, 100))),
  };
}

export async function suggestImportCategories(payload) {
  const config = getImportAiConfig();

  if (!config.enabled) {
    return {
      status: "disabled",
      items: [],
      provider: config.provider,
      model: config.model,
      autoApplyThreshold: config.autoApplyThreshold,
      maxRowsPerRequest: config.maxRowsPerRequest,
    };
  }

  if (config.mode === "direct") {
    if (config.provider === "gemini" && !String(process.env.GEMINI_API_KEY ?? "").trim()) {
      throw new Error("GEMINI_API_KEY is required when IMPORT_AI_MODE=direct and IMPORT_AI_PROVIDER=gemini.");
    }

    if (config.provider === "openai" && !String(process.env.OPENAI_API_KEY ?? "").trim()) {
      throw new Error("OPENAI_API_KEY is required when IMPORT_AI_MODE=direct and IMPORT_AI_PROVIDER=openai.");
    }
  }

  const items =
    config.mode === "webhook"
      ? await requestWebhookImportAiSuggestionsWithTelemetry(payload)
      : await requestDirectImportAiSuggestionsWithTelemetry(payload);

  return {
    status: "completed",
    items: items.items,
    provider: items.provider ?? config.provider,
    model: items.model ?? config.model,
    usage: items.usage ?? null,
    estimatedCostUsd: items.estimatedCostUsd ?? null,
    autoApplyThreshold: config.autoApplyThreshold,
    maxRowsPerRequest: config.maxRowsPerRequest,
  };
}
