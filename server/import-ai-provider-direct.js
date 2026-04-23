import { getOpenClawConfig } from "./openclaw-config.js";
import { extractOpenAiCompatibleContent, requestOpenClawChatCompletion } from "./openclaw-client.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const AI_STATUS_VALUES = ["suggested", "no_match", "error", "invalid"];
const AI_REASON_MAX_LENGTH = 160;

const aiCategorizationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rowIndex: { type: "integer" },
          suggestedType: {
            type: ["string", "null"],
            enum: ["income", "expense", null],
          },
          categoryKey: { type: ["string", "null"] },
          confidence: { type: ["number", "null"] },
          reason: { type: ["string", "null"] },
          status: {
            type: "string",
            enum: AI_STATUS_VALUES,
          },
        },
        required: ["rowIndex", "suggestedType", "categoryKey", "confidence", "reason", "status"],
      },
    },
  },
  required: ["items"],
};

function parseTimeoutMs(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

export function getDirectProviderConfig() {
  const configuredProvider = process.env.IMPORT_AI_PROVIDER?.trim();
  const provider =
    configuredProvider === "gemini" ? "gemini" : "openai";
  const openClawConfig = getOpenClawConfig({
    model: process.env.IMPORT_AI_MODEL?.trim() || undefined,
    timeoutMs: parseTimeoutMs(process.env.IMPORT_AI_TIMEOUT_MS),
  });

  return {
    provider,
    model: process.env.IMPORT_AI_MODEL?.trim() || openClawConfig.model,
    timeoutMs: openClawConfig.timeoutMs,
    openClawBaseUrl: openClawConfig.baseUrl,
    openClawApiKey: openClawConfig.apiKey,
    openAiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
  };
}

function buildPrompt(payload) {
  return [
    "Classifique transacoes financeiras usando apenas categoryKey da whitelist fornecida.",
    "Classifique tambem semanticamente se a linha e income ou expense.",
    "Cada categoria da whitelist informa o transactionType permitido. Nunca combine uma categoria income com suggestedType expense, nem o contrario.",
    "Nunca invente categorias fora da whitelist.",
    "Se nao houver confianca suficiente, retorne categoryKey null e status no_match.",
    "Se a descricao indicar pix recebido, transferencia recebida, ted recebida, doc recebido, deposito ou credito em conta, priorize income.",
    "Se a descricao indicar pix enviado, pagamento, transferencia enviada, compra, debito, saque, tarifa ou consumo, priorize expense.",
    "confidence deve ficar entre 0 e 1.",
    "reason deve ser curta e objetiva.",
    "Nao altere valor, data, tipo, persistencia ou duplicidade.",
    "",
    `Categorias permitidas: ${JSON.stringify(payload.categories)}`,
    `Itens para classificar: ${JSON.stringify(payload.items)}`,
  ].join("\n");
}

export function buildProviderRequest(provider, payload, config) {
  const prompt = buildPrompt(payload);

  if (provider === "openclaw") {
    return {
      url: `${config.openClawBaseUrl}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        ...(config.openClawApiKey ? { Authorization: `Bearer ${config.openClawApiKey}` } : {}),
      },
      body: {
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "Voce classifica transacoes financeiras e sempre responde no schema fornecido sem inventar categorias.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "transaction_import_ai_suggestions",
            strict: true,
            schema: aiCategorizationSchema,
          },
        },
      },
    };
  }

  if (provider === "gemini") {
    return {
      url: `${GEMINI_API_URL}/${encodeURIComponent(config.model || DEFAULT_GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: aiCategorizationSchema,
        },
      },
    };
  }

  return {
    url: OPENAI_API_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`,
    },
    body: {
      model: config.model || DEFAULT_OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Voce classifica transacoes financeiras e sempre responde no schema fornecido sem inventar categorias.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "transaction_import_ai_suggestions",
          strict: true,
          schema: aiCategorizationSchema,
        },
      },
    },
  };
}

export async function executeProviderRequest({ url, headers, body }, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let parsedBody = {};

    if (text) {
      try {
        parsedBody = JSON.parse(text);
      } catch {
        throw new Error("O provider de IA retornou um corpo JSON invalido.");
      }
    }

    if (!response.ok) {
      throw new Error(parsedBody?.error?.message ?? parsedBody?.message ?? "O provider de IA falhou.");
    }

    return parsedBody;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("A sugestao por IA expirou antes da resposta.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractStructuredBody(provider, responseBody) {
  if (provider === "gemini") {
    const text = responseBody?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text;

    if (!text) {
      throw new Error("O Gemini nao retornou conteudo estruturado.");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("O Gemini retornou JSON estruturado invalido.");
    }
  }

  const providerLabel = provider === "openclaw" ? "OpenClaw" : "OpenAI";
  const content = extractOpenAiCompatibleContent(responseBody, providerLabel);

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`O ${providerLabel} retornou JSON estruturado invalido.`);
  }
}

function normalizeReason(value) {
  const reason = String(value ?? "").trim();
  return reason ? reason.slice(0, AI_REASON_MAX_LENGTH) : null;
}

function normalizeItem(rawItem) {
  const rowIndex = Number(rawItem?.rowIndex);

  if (!Number.isInteger(rowIndex)) {
    throw new Error("O provider retornou item sem rowIndex valido.");
  }

  const status = typeof rawItem?.status === "string" ? rawItem.status : "";
  const suggestedType =
    rawItem?.suggestedType === null || rawItem?.suggestedType === "income" || rawItem?.suggestedType === "expense"
      ? rawItem.suggestedType
      : undefined;
  const categoryKey =
    rawItem?.categoryKey === null || typeof rawItem?.categoryKey === "string" ? rawItem.categoryKey : null;
  const confidence =
    rawItem?.confidence === null || rawItem?.confidence === undefined ? null : Number(rawItem.confidence);
  const reason = normalizeReason(rawItem?.reason);

  if (!AI_STATUS_VALUES.includes(status)) {
    return {
      rowIndex,
      suggestedType: null,
      categoryKey: null,
      confidence: null,
      reason,
      status: "invalid",
    };
  }

  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    return {
      rowIndex,
      suggestedType: null,
      categoryKey: null,
      confidence: null,
      reason,
      status: "invalid",
    };
  }

  if (status === "suggested" && (suggestedType === null || suggestedType === undefined || !categoryKey || typeof categoryKey !== "string")) {
    return {
      rowIndex,
      suggestedType: null,
      categoryKey: null,
      confidence: null,
      reason,
      status: "invalid",
    };
  }

  if ((status === "error" || status === "invalid") && (categoryKey || suggestedType)) {
    return {
      rowIndex,
      suggestedType: null,
      categoryKey: null,
      confidence: null,
      reason,
      status: "invalid",
    };
  }

  if (status === "no_match" && categoryKey) {
    return {
      rowIndex,
      suggestedType: null,
      categoryKey: null,
      confidence: null,
      reason,
      status: "invalid",
    };
  }

  return {
    rowIndex,
    suggestedType: suggestedType ?? null,
    categoryKey: categoryKey ?? null,
    confidence,
    reason,
    status,
  };
}

export function normalizeAiCategorizationResults(structuredBody) {
  if (!Array.isArray(structuredBody?.items)) {
    throw new Error("O provider nao retornou a lista estruturada de itens.");
  }

  return structuredBody.items.map(normalizeItem);
}

async function requestOpenAiImportSuggestions(payload, config) {
  const request = buildProviderRequest("openai", payload, config);
  const responseBody = await executeProviderRequest(request, config.timeoutMs);
  const structuredBody = extractStructuredBody("openai", responseBody);
  return normalizeAiCategorizationResults(structuredBody);
}

async function requestOpenClawImportSuggestions(payload, config) {
  const responseBody = await requestOpenClawChatCompletion(
    {
      messages: [
        {
          role: "system",
          content:
            "Voce classifica transacoes financeiras e sempre responde no schema fornecido sem inventar categorias.",
        },
        {
          role: "user",
          content: buildPrompt(payload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "transaction_import_ai_suggestions",
          strict: true,
          schema: aiCategorizationSchema,
        },
      },
    },
    {
      baseUrl: config.openClawBaseUrl,
      model: config.model,
      timeoutMs: config.timeoutMs,
      apiKey: config.openClawApiKey,
    },
  );
  const structuredBody = extractStructuredBody("openclaw", responseBody);
  return normalizeAiCategorizationResults(structuredBody);
}

async function requestGeminiImportSuggestions(payload, config) {
  const request = buildProviderRequest("gemini", payload, config);
  const responseBody = await executeProviderRequest(request, config.timeoutMs);
  const structuredBody = extractStructuredBody("gemini", responseBody);
  return normalizeAiCategorizationResults(structuredBody);
}

export async function requestDirectImportAiSuggestions(payload, overrides = {}) {
  const config = {
    ...getDirectProviderConfig(),
    ...overrides,
  };

  if (config.provider === "gemini") {
    return requestGeminiImportSuggestions(payload, config);
  }

  if (config.provider === "openclaw") {
    return requestOpenClawImportSuggestions(payload, config);
  }

  return requestOpenAiImportSuggestions(payload, config);
}
