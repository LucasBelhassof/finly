import { getDirectChatProviderConfig, requestDirectChatReplyByProvider } from "./chat-ai-provider-direct.js";

function buildFallbackReply(message, context) {
  const text = String(message ?? "").toLowerCase();
  const balanceCard = context.summaryCards.find((card) => card.label === "Saldo Total");
  const expenseCard = context.summaryCards.find((card) => card.label === "Despesas");
  const topCategory = context.spendingByCategory[0];

  if (text.includes("delivery") || text.includes("ifood") || text.includes("alimenta")) {
    return [
      `Hoje a maior pressao parece estar em ${topCategory?.label ?? "Alimentacao"} (${topCategory?.percentage ?? 0}% do total mensal).`,
      `O saldo atual esta em ${balanceCard?.formattedValue ?? "R$ 0,00"} e as despesas do mes estao em ${expenseCard?.formattedValue ?? "R$ 0,00"}.`,
      "",
      "Plano rapido:",
      "1. Defina um teto semanal para delivery.",
      "2. Revise o gasto toda sexta-feira.",
      "3. Substitua parte dos pedidos por compras planejadas.",
    ].join("\n");
  }

  return [
    `Saldo atual: ${balanceCard?.formattedValue ?? "R$ 0,00"}.`,
    `Despesas do mes: ${expenseCard?.formattedValue ?? "R$ 0,00"}.`,
    `Categoria com maior peso: ${topCategory?.label ?? "Sem dados suficientes"}${topCategory ? ` (${topCategory.percentage}%).` : "."}`,
    "",
    "Posso montar um plano por categoria, revisar parcelamentos ou sugerir cortes de curto prazo.",
  ].join("\n");
}

export function getChatAiConfig() {
  return getDirectChatProviderConfig();
}

export async function generateChatReply(payload) {
  const config = getChatAiConfig();

  if (!config.enabled) {
    return {
      content: buildFallbackReply(payload.message, payload.context),
      provider: "local",
      model: "rule-based-fallback",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requestCount: 0,
      },
      estimatedCostUsd: 0,
    };
  }

  const canUseGemini = Boolean(config.geminiApiKey);
  const canUseOpenAi = Boolean(config.openAiApiKey);

  if (config.provider === "gemini") {
    if (canUseGemini) {
      try {
        return await requestDirectChatReplyByProvider(payload, "gemini", config);
      } catch (error) {
        if (canUseOpenAi) {
          return requestDirectChatReplyByProvider(payload, "openai", config);
        }

        throw error;
      }
    }

    if (canUseOpenAi) {
      return requestDirectChatReplyByProvider(payload, "openai", config);
    }

    throw new Error("Configure GEMINI_API_KEY ou OPENAI_API_KEY para usar o chat com IA.");
  }

  if (canUseOpenAi) {
    return requestDirectChatReplyByProvider(payload, "openai", config);
  }

  throw new Error("OPENAI_API_KEY is required when CHAT_AI_PROVIDER=openai.");
}

function normalizeGeneratedTitle(value, fallback) {
  const normalized = String(value ?? "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!,;:]+$/g, "");

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 60 ? `${normalized.slice(0, 57).trim()}...` : normalized;
}

function buildFallbackTitle(message) {
  const normalized = String(message ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!,;:]+$/g, "");

  if (!normalized) {
    return "Novo chat";
  }

  return normalized.length > 60 ? `${normalized.slice(0, 57).trim()}...` : normalized;
}

export async function generateChatTitle(payload) {
  const fallback = buildFallbackTitle(payload.message);
  const config = getChatAiConfig();

  if (!config.enabled) {
    return {
      content: fallback,
      provider: "local",
      model: "rule-based-fallback",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requestCount: 0,
      },
      estimatedCostUsd: 0,
    };
  }

  const titlePayload = {
    task: "title",
    message: payload.message,
    generatedAt: payload.generatedAt,
    history: [
      {
        role: "user",
        content: payload.message,
      },
    ],
  };

  const canUseGemini = Boolean(config.geminiApiKey);
  const canUseOpenAi = Boolean(config.openAiApiKey);
  let reply;

  if (config.provider === "gemini") {
    if (canUseGemini) {
      try {
        reply = await requestDirectChatReplyByProvider(titlePayload, "gemini", config);
      } catch (error) {
        if (!canUseOpenAi) {
          throw error;
        }

        reply = await requestDirectChatReplyByProvider(titlePayload, "openai", config);
      }
    } else if (canUseOpenAi) {
      reply = await requestDirectChatReplyByProvider(titlePayload, "openai", config);
    } else {
      throw new Error("Configure GEMINI_API_KEY ou OPENAI_API_KEY para usar o chat com IA.");
    }
  } else if (canUseOpenAi) {
    reply = await requestDirectChatReplyByProvider(titlePayload, "openai", config);
  } else {
    throw new Error("OPENAI_API_KEY is required when CHAT_AI_PROVIDER=openai.");
  }

  return {
    ...reply,
    content: normalizeGeneratedTitle(reply.content, fallback),
  };
}
