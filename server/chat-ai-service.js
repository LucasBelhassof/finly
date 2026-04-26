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

async function requestConfiguredChatPayload(payload, config = getChatAiConfig()) {
  const canUseGemini = Boolean(config.geminiApiKey);
  const canUseOpenAi = Boolean(config.openAiApiKey);

  if (config.provider === "gemini") {
    if (canUseGemini) {
      try {
        return await requestDirectChatReplyByProvider(payload, "gemini", config);
      } catch (error) {
        if (!canUseOpenAi) {
          throw error;
        }

        return requestDirectChatReplyByProvider(payload, "openai", config);
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

function extractJsonObject(text) {
  const raw = String(text ?? "").trim();
  const withoutFence = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("invalid plan JSON returned by AI");
  }

  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    throw new Error("invalid plan JSON returned by AI");
  }
}

function normalizePlanItem(item, index) {
  const title = String(item?.title ?? "").replace(/\s+/g, " ").trim();

  if (!title) {
    return null;
  }

  return {
    title: title.length > 120 ? `${title.slice(0, 117).trim()}...` : title,
    description: String(item?.description ?? "").trim(),
    status: item?.status === "done" ? "done" : "todo",
    sortOrder: index,
  };
}

function normalizePlanGoalDate(value) {
  const text = String(value ?? "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const parsed = new Date(`${text}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : text;
}

function normalizePlanGoalCategoryIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value
    .map((categoryId) => Number(categoryId))
    .filter((categoryId) => Number.isInteger(categoryId) && categoryId > 0);

  return Array.from(new Set(ids));
}

function normalizePlanGoal(value, fallback) {
  if (value?.type !== "transaction_sum") {
    return fallback;
  }

  const targetAmount = Number(value?.targetAmount ?? value?.target_amount);
  const startDate = normalizePlanGoalDate(value?.startDate ?? value?.start_date);
  const endDate = normalizePlanGoalDate(value?.endDate ?? value?.end_date);

  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || !startDate || !endDate || startDate > endDate) {
    return fallback;
  }

  return {
    type: "transaction_sum",
    source: "ai",
    targetAmount: Number(targetAmount.toFixed(2)),
    transactionType: value?.transactionType === "income" || value?.transaction_type === "income" ? "income" : "expense",
    categoryIds: normalizePlanGoalCategoryIds(value?.categoryIds ?? value?.category_ids),
    startDate,
    endDate,
  };
}

function buildFallbackPlanDraft(chat) {
  const titleBase = buildFallbackTitle(chat?.title || chat?.messages?.find((message) => message.role === "user")?.content || "Planejamento financeiro");

  return {
    title: titleBase,
    description: "Planejamento criado a partir da conversa selecionada.",
    goal: {
      type: "items",
      source: "ai",
      targetAmount: null,
      transactionType: "expense",
      categoryIds: [],
      startDate: null,
      endDate: null,
    },
    items: [
      {
        title: "Revisar os principais pontos da conversa",
        description: "Consolidar pedidos, prioridades e dados financeiros citados no chat.",
        status: "todo",
        sortOrder: 0,
      },
      {
        title: "Definir proximas acoes",
        description: "Transformar as recomendacoes em tarefas pequenas e acompanhaveis.",
        status: "todo",
        sortOrder: 1,
      },
      {
        title: "Acompanhar evolucao semanal",
        description: "Revisar o progresso e ajustar o plano conforme novos dados forem registrados.",
        status: "todo",
        sortOrder: 2,
      },
    ],
  };
}

function normalizePlanDraft(value, fallback) {
  const title = normalizeGeneratedTitle(value?.title, fallback.title);
  const items = Array.isArray(value?.items)
    ? value.items.map(normalizePlanItem).filter(Boolean).slice(0, 10)
    : [];

  return {
    title,
    description: String(value?.description ?? fallback.description).trim() || fallback.description,
    goal: normalizePlanGoal(value?.goal, fallback.goal),
    items: items.length ? items : fallback.items,
  };
}

export async function generatePlanDraft(payload) {
  const fallback = buildFallbackPlanDraft(payload.chat);
  const config = getChatAiConfig();

  if (!config.enabled) {
    return fallback;
  }

  const reply = await requestConfiguredChatPayload(
    {
      task: "plan_draft",
      generatedAt: payload.generatedAt,
      history: [
        {
          role: "user",
          content: JSON.stringify({
            chat: payload.chat,
            context: payload.context,
          }),
        },
      ],
    },
    config,
  );

  return normalizePlanDraft(extractJsonObject(reply.content), fallback);
}

function buildFallbackLinkSuggestion(chat, plans) {
  const haystack = [
    chat?.title,
    ...(chat?.messages ?? []).map((message) => message.content),
  ]
    .join(" ")
    .toLowerCase();

  const scoredPlans = plans
    .map((plan) => {
      const tokens = `${plan.title} ${plan.description}`
        .toLowerCase()
        .split(/[^a-z0-9\u00c0-\u00ff]+/i)
        .filter((token) => token.length >= 4);
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { plan, score };
    })
    .sort((left, right) => right.score - left.score);

  if (scoredPlans[0]?.score > 0) {
    return {
      action: "link",
      planId: scoredPlans[0].plan.id,
      rationale: "O chat parece tratar dos mesmos temas deste planejamento.",
    };
  }

  return {
    action: "create",
    planId: null,
    rationale: "Nenhum planejamento existente parece representar bem este chat.",
  };
}

function normalizePlanLinkSuggestion(value, plans, fallback) {
  const validPlanIds = new Set(plans.map((plan) => plan.id));
  const action = value?.action === "link" && validPlanIds.has(value?.planId) ? "link" : "create";

  return {
    action,
    planId: action === "link" ? value.planId : null,
    rationale: String(value?.rationale ?? fallback.rationale).trim() || fallback.rationale,
  };
}

export async function suggestPlanLink(payload) {
  const fallback = buildFallbackLinkSuggestion(payload.chat, payload.plans);
  const config = getChatAiConfig();

  if (!config.enabled) {
    return fallback;
  }

  const reply = await requestConfiguredChatPayload(
    {
      task: "plan_link_suggestion",
      generatedAt: payload.generatedAt,
      history: [
        {
          role: "user",
          content: JSON.stringify({
            chat: payload.chat,
            plans: payload.plans,
          }),
        },
      ],
    },
    config,
  );

  return normalizePlanLinkSuggestion(extractJsonObject(reply.content), payload.plans, fallback);
}
