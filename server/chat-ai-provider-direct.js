const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_RESPONSE_TOKENS = 2000;
const MAX_CONTINUATION_ATTEMPTS = 2;

function parseTimeoutMs(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function parseMaxResponseTokens(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RESPONSE_TOKENS;
}

function appendContinuation(previousText, nextText) {
  const left = String(previousText ?? "").trimEnd();
  const right = String(nextText ?? "").trimStart();

  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const needsSpace = /[A-Za-zÀ-ÿ0-9)]$/.test(left) && /^[A-Za-zÀ-ÿ0-9(]/.test(right);
  return `${left}${needsSpace ? " " : ""}${right}`;
}

function parsePricePerMillion(value) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sumNumeric(...values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function estimateUsageCost(usage, pricing) {
  if (!pricing.inputPerMillion || !pricing.outputPerMillion) {
    return null;
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(8));
}

function mergeUsage(left, right) {
  const merged = {
    inputTokens: sumNumeric(left?.inputTokens, right?.inputTokens),
    outputTokens: sumNumeric(left?.outputTokens, right?.outputTokens),
    totalTokens: sumNumeric(left?.totalTokens, right?.totalTokens),
    requestCount: sumNumeric(left?.requestCount, right?.requestCount),
  };

  if (!merged.totalTokens) {
    merged.totalTokens = merged.inputTokens + merged.outputTokens;
  }

  return merged;
}

export function getDirectChatProviderConfig() {
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
  const configuredProvider = process.env.CHAT_AI_PROVIDER?.trim();
  const provider = configuredProvider === "openai" ? "openai" : "gemini";

  return {
    enabled:
      String(process.env.CHAT_AI_ENABLED ?? "")
        .trim()
        .toLowerCase() === "true" || Boolean(openAiApiKey || geminiApiKey),
    provider,
    fallbackProvider: provider === "gemini" ? "openai" : null,
    model: process.env.CHAT_AI_MODEL?.trim() || "",
    timeoutMs: parseTimeoutMs(process.env.CHAT_AI_TIMEOUT_MS),
    maxResponseTokens: parseMaxResponseTokens(process.env.CHAT_AI_MAX_RESPONSE_TOKENS),
    pricing: {
      gemini: {
        inputPerMillion: parsePricePerMillion(process.env.CHAT_AI_PRICING_GEMINI_INPUT_PER_MILLION),
        outputPerMillion: parsePricePerMillion(process.env.CHAT_AI_PRICING_GEMINI_OUTPUT_PER_MILLION),
      },
      openai: {
        inputPerMillion: parsePricePerMillion(process.env.CHAT_AI_PRICING_OPENAI_INPUT_PER_MILLION),
        outputPerMillion: parsePricePerMillion(process.env.CHAT_AI_PRICING_OPENAI_OUTPUT_PER_MILLION),
      },
    },
    openAiApiKey,
    geminiApiKey,
  };
}

function buildSystemInstruction(payload) {
  if (payload.task === "title") {
    return [
      "Voce cria titulos curtos para conversas em portugues do Brasil.",
      "Responda apenas com o titulo, sem aspas, pontuacao final, prefixos ou explicacoes.",
      "O titulo deve ter no maximo 60 caracteres.",
      "Use a pergunta do usuario como base e mantenha o titulo especifico.",
      "",
      `Data de referencia: ${payload.generatedAt}`,
    ].join("\n");
  }

  return [
    "Voce e o Assistente Finly, um consultor financeiro pessoal em portugues do Brasil.",
    "Use apenas o contexto financeiro fornecido para analisar gastos, riscos e oportunidades.",
    "Nunca invente saldos, transacoes, contas, datas ou metas que nao estejam no contexto.",
    "Nao exponha credenciais, tokens, cookies, segredos nem chaves de API.",
    "Quando recomendar um plano, entregue passos concretos e objetivos.",
    "Se faltar dado, diga isso claramente e explique o que o usuario precisa registrar no sistema.",
    "Baseie sua analise nos numeros do usuario e mantenha a resposta concisa.",
    "",
    `Data de referencia da analise: ${payload.generatedAt}`,
    `Contexto financeiro atual: ${JSON.stringify(payload.context)}`,
  ].join("\n");
}

function mapOpenAiHistory(history) {
  return history.map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    content: message.content,
  }));
}

function mapGeminiHistory(history) {
  return history.map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.content }],
  }));
}

export function buildChatProviderRequest(provider, payload, config) {
  const systemInstruction = buildSystemInstruction(payload);

  if (provider === "gemini") {
    return {
      url: `${GEMINI_API_URL}/${encodeURIComponent(config.model || DEFAULT_GEMINI_MODEL)}:generateContent`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: {
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: mapGeminiHistory(payload.history),
        generationConfig: {
          responseMimeType: "text/plain",
          maxOutputTokens: config.maxResponseTokens,
          temperature: 0.4,
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
          role: "developer",
          content: systemInstruction,
        },
        ...mapOpenAiHistory(payload.history),
      ],
      max_completion_tokens: config.maxResponseTokens,
      temperature: 0.4,
    },
  };
}

async function executeProviderRequest({ url, headers, body }, timeoutMs) {
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
        throw new Error("O provider de chat retornou um corpo JSON invalido.");
      }
    }

    if (!response.ok) {
      throw new Error(parsedBody?.error?.message ?? parsedBody?.message ?? "O provider de chat falhou.");
    }

    return parsedBody;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("A resposta da IA expirou antes da conclusao.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractChatResponse(provider, responseBody) {
  if (provider === "gemini") {
    const finishReason = String(responseBody?.candidates?.[0]?.finishReason ?? "").trim();
    const text = (responseBody?.candidates?.[0]?.content?.parts ?? [])
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("O Gemini nao retornou texto para o chat.");
    }

    return {
      text,
      truncated: finishReason === "MAX_TOKENS",
      usage: {
        inputTokens: normalizeInteger(responseBody?.usageMetadata?.promptTokenCount),
        outputTokens: normalizeInteger(responseBody?.usageMetadata?.candidatesTokenCount),
        totalTokens: normalizeInteger(responseBody?.usageMetadata?.totalTokenCount),
        requestCount: 1,
      },
    };
  }

  const message = responseBody?.choices?.[0]?.message;
  const refusal = typeof message?.refusal === "string" ? message.refusal.trim() : "";

  if (refusal) {
    throw new Error("A OpenAI recusou a solicitacao do chat.");
  }

  if (typeof message?.content === "string" && message.content.trim()) {
    return {
      text: message.content.trim(),
      truncated: responseBody?.choices?.[0]?.finish_reason === "length",
      usage: {
        inputTokens: normalizeInteger(responseBody?.usage?.prompt_tokens),
        outputTokens: normalizeInteger(responseBody?.usage?.completion_tokens),
        totalTokens: normalizeInteger(responseBody?.usage?.total_tokens),
        requestCount: 1,
      },
    };
  }

  const partsText = Array.isArray(message?.content)
    ? message.content
        .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim()
    : "";

  if (!partsText) {
    throw new Error("A OpenAI nao retornou texto para o chat.");
  }

  return {
    text: partsText || message.content.trim(),
    truncated: responseBody?.choices?.[0]?.finish_reason === "length",
    usage: {
      inputTokens: normalizeInteger(responseBody?.usage?.prompt_tokens),
      outputTokens: normalizeInteger(responseBody?.usage?.completion_tokens),
      totalTokens: normalizeInteger(responseBody?.usage?.total_tokens),
      requestCount: 1,
    },
  };
}

export async function requestDirectChatReply(payload) {
  const config = getDirectChatProviderConfig();
  const request = buildChatProviderRequest(config.provider, payload, config);
  const responseBody = await executeProviderRequest(request, config.timeoutMs);
  const reply = extractChatResponse(config.provider, responseBody);

  return {
    content: reply.text,
    provider: config.provider,
    model: config.model || (config.provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
    usage: reply.usage,
    estimatedCostUsd: estimateUsageCost(reply.usage, config.pricing[config.provider]),
  };
}

export async function requestDirectChatReplyByProvider(payload, provider, config = getDirectChatProviderConfig()) {
  let accumulatedContent = "";
  let accumulatedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requestCount: 0,
  };
  let continuationCount = 0;
  let currentPayload = payload;

  while (continuationCount <= MAX_CONTINUATION_ATTEMPTS) {
    const request = buildChatProviderRequest(provider, currentPayload, config);
    const responseBody = await executeProviderRequest(request, config.timeoutMs);
    const reply = extractChatResponse(provider, responseBody);

    accumulatedContent = appendContinuation(accumulatedContent, reply.text);
    accumulatedUsage = mergeUsage(accumulatedUsage, reply.usage);

    if (!reply.truncated) {
      return {
        content: accumulatedContent,
        provider,
        model: config.model || (provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
        usage: accumulatedUsage,
        estimatedCostUsd: estimateUsageCost(accumulatedUsage, config.pricing[provider]),
      };
    }

    continuationCount += 1;
    currentPayload = {
      ...payload,
      history: [
        ...payload.history,
        {
          role: "assistant",
          content: accumulatedContent,
        },
        {
          role: "user",
          content: "Continue exatamente de onde parou, sem repetir o que ja foi dito, e conclua a resposta.",
        },
      ],
    };
  }

  return {
    content: accumulatedContent,
    provider,
    model: config.model || (provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL),
    usage: accumulatedUsage,
    estimatedCostUsd: estimateUsageCost(accumulatedUsage, config.pricing[provider]),
  };
}
