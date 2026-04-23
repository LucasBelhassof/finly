import { normalizeAiCategorizationResults, requestDirectImportAiSuggestions } from "./import-ai-provider-direct.js";
import { requestWebhookImportAiSuggestions } from "./import-ai-provider-webhook.js";
import { OpenClawSocketError, sendMessage as sendOpenClawMessage } from "./shared/openclaw-client.js";

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
  const providers = parseProviderChain(process.env.IMPORT_AI_PROVIDER);

  return {
    enabled: parseBooleanFlag(process.env.IMPORT_AI_ENABLED),
    mode: process.env.IMPORT_AI_MODE?.trim() === "webhook" ? "webhook" : "direct",
    provider: providers[0],
    fallbackProviders: providers.slice(1),
    model: process.env.IMPORT_AI_MODEL?.trim() || process.env.OPENCLAW_MODEL?.trim() || "",
    autoApplyThreshold: Math.max(0, Math.min(1, parseNumber(process.env.IMPORT_AI_AUTO_APPLY_THRESHOLD, 0.8))),
    maxRowsPerRequest: Math.max(1, Math.floor(parseNumber(process.env.IMPORT_AI_MAX_ROWS_PER_REQUEST, 100))),
  };
}

function parseProviderChain(value) {
  const rawProviders = String(value ?? "openclaw")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const normalizedProviders = [];

  for (const provider of rawProviders) {
    if (!["openclaw", "openai", "gemini"].includes(provider)) {
      continue;
    }

    if (!normalizedProviders.includes(provider)) {
      normalizedProviders.push(provider);
    }
  }

  return normalizedProviders.length > 0 ? normalizedProviders : ["openclaw"];
}

export class ImportAiDisabledError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImportAiDisabledError";
    this.code = "import_ai_disabled";
  }
}

export function isImportAiDisabledError(error) {
  return error instanceof ImportAiDisabledError || error?.code === "import_ai_disabled";
}

function assertDirectProviderKey(provider) {
  if (provider === "gemini" && !String(process.env.GEMINI_API_KEY ?? "").trim()) {
    throw new Error("GEMINI_API_KEY is required when IMPORT_AI_MODE=direct and IMPORT_AI_PROVIDER=gemini.");
  }

  if (provider === "openai" && !String(process.env.OPENAI_API_KEY ?? "").trim()) {
    throw new Error("OPENAI_API_KEY is required when IMPORT_AI_MODE=direct and IMPORT_AI_PROVIDER=openai.");
  }
}

function stripJsonCodeFence(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

function buildOpenClawCategorizationPrompt(payload) {
  return [
    "Voce classifica transacoes financeiras.",
    "Responda apenas com JSON valido, sem markdown e sem texto extra.",
    'Formato obrigatorio: {"items":[{"rowIndex":number,"suggestedType":"income"|"expense"|null,"categoryKey":string|null,"confidence":number|null,"reason":string|null,"status":"suggested"|"no_match"|"error"|"invalid"}]}',
    "Use somente categoryKey da whitelist enviada.",
    "Nunca invente categoryKey fora da whitelist.",
    "confidence deve ser numero entre 0 e 1.",
    "Se nao souber, retorne categoryKey null e status no_match.",
    "Considere descricao, valor e data quando disponiveis.",
    "",
    `Categorias permitidas: ${JSON.stringify(payload.categories)}`,
    `Transacoes: ${JSON.stringify(
      payload.items.map((item) => ({
        rowIndex: item.rowIndex,
        description: item.description ?? null,
        amount: item.amount ?? null,
        occurredOn: item.occurredOn ?? null,
        type: item.type ?? null,
      })),
    )}`,
  ].join("\n");
}

async function requestOpenClawImportAiSuggestions(payload) {
  console.log("[import-ai] OpenClaw provider selected.");
  const responseText = await sendOpenClawMessage(buildOpenClawCategorizationPrompt(payload));
  const parsed = JSON.parse(stripJsonCodeFence(responseText));
  return normalizeAiCategorizationResults(parsed);
}

async function requestProviderSuggestions(provider, payload) {
  if (provider === "openclaw") {
    return requestOpenClawImportAiSuggestions(payload);
  }

  assertDirectProviderKey(provider);
  return requestDirectImportAiSuggestions(payload, {
    provider,
  });
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

  try {
    if (config.mode === "webhook") {
      const items = await requestWebhookImportAiSuggestions(payload);

      return {
        status: "completed",
        items,
        provider: config.provider,
        model: config.model,
        autoApplyThreshold: config.autoApplyThreshold,
        maxRowsPerRequest: config.maxRowsPerRequest,
      };
    }

    const providers = [config.provider, ...config.fallbackProviders];
    let lastError = null;

    for (const provider of providers) {
      try {
        const items = await requestProviderSuggestions(provider, payload);

        return {
          status: "completed",
          items,
          provider,
          model: config.model,
          autoApplyThreshold: config.autoApplyThreshold,
          maxRowsPerRequest: config.maxRowsPerRequest,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[import-ai] Provider ${provider} failed:`, lastError.message);
      }
    }

    return {
      status: "disabled",
      items: [],
      provider: config.provider,
      model: config.model,
      autoApplyThreshold: config.autoApplyThreshold,
      maxRowsPerRequest: config.maxRowsPerRequest,
      reason: lastError?.message ?? "Nenhum provider de IA conseguiu processar a importacao.",
    };
  } catch (error) {
    if (config.mode === "direct" && error instanceof OpenClawSocketError) {
      return {
        status: "disabled",
        items: [],
        provider: config.provider,
        model: config.model,
        autoApplyThreshold: config.autoApplyThreshold,
        maxRowsPerRequest: config.maxRowsPerRequest,
        reason: error.message,
      };
    }

    throw error;
  }
}
