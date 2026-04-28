import { getDirectChatProviderConfig, requestDirectChatReplyByProvider } from "./chat-ai-provider-direct.js";

function getProviderModel(provider, config, reply) {
  if (reply?.model) {
    return reply.model;
  }

  if (config?.model) {
    return config.model;
  }

  return provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini";
}

async function emitUsageEvent(handler, event) {
  if (typeof handler !== "function") {
    return;
  }

  try {
    await handler(event);
  } catch {
    // Telemetry must not break the primary IA flow.
  }
}

async function requestProviderWithUsage(payload, provider, config, usageContext) {
  try {
    const reply = await requestDirectChatReplyByProvider(payload, provider, config);
    await emitUsageEvent(payload.onUsageEvent, {
      ...usageContext,
      success: true,
      provider,
      model: getProviderModel(provider, config, reply),
      inputTokens: reply.usage?.inputTokens ?? null,
      outputTokens: reply.usage?.outputTokens ?? null,
      totalTokens: reply.usage?.totalTokens ?? null,
      requestCount: reply.usage?.requestCount ?? null,
      estimatedCostUsd: reply.estimatedCostUsd ?? null,
      errorCode: null,
      errorMessage: null,
    });
    return reply;
  } catch (error) {
    await emitUsageEvent(payload.onUsageEvent, {
      ...usageContext,
      success: false,
      provider,
      model: getProviderModel(provider, config),
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      requestCount: 1,
      estimatedCostUsd: null,
      errorCode: "provider_request_failed",
      errorMessage: error instanceof Error ? error.message : "Erro ao consultar provider de IA.",
    });
    throw error;
  }
}

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
        return await requestProviderWithUsage(payload, "gemini", config, {
          surface: "chat",
          operation: "reply",
        });
      } catch (error) {
        if (canUseOpenAi) {
          return requestProviderWithUsage(payload, "openai", config, {
            surface: "chat",
            operation: "reply",
          });
        }

        throw error;
      }
    }

    if (canUseOpenAi) {
      return requestProviderWithUsage(payload, "openai", config, {
        surface: "chat",
        operation: "reply",
      });
    }

    throw new Error("Configure GEMINI_API_KEY ou OPENAI_API_KEY para usar o chat com IA.");
  }

  if (canUseOpenAi) {
    return requestProviderWithUsage(payload, "openai", config, {
      surface: "chat",
      operation: "reply",
    });
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
  const usageContext = {
    surface: payload.surface ?? "chat",
    operation: payload.operation ?? "generic",
  };

  if (config.provider === "gemini") {
    if (canUseGemini) {
      try {
        return await requestProviderWithUsage(payload, "gemini", config, usageContext);
      } catch (error) {
        if (!canUseOpenAi) {
          throw error;
        }

        return requestProviderWithUsage(payload, "openai", config, usageContext);
      }
    }

    if (canUseOpenAi) {
      return requestProviderWithUsage(payload, "openai", config, usageContext);
    }

    throw new Error("Configure GEMINI_API_KEY ou OPENAI_API_KEY para usar o chat com IA.");
  }

  if (canUseOpenAi) {
    return requestProviderWithUsage(payload, "openai", config, usageContext);
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
    surface: "chat",
    operation: "title",
    onUsageEvent: payload.onUsageEvent,
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
        reply = await requestProviderWithUsage(titlePayload, "gemini", config, {
          surface: "chat",
          operation: "title",
        });
      } catch (error) {
        if (!canUseOpenAi) {
          throw error;
        }

        reply = await requestProviderWithUsage(titlePayload, "openai", config, {
          surface: "chat",
          operation: "title",
        });
      }
    } else if (canUseOpenAi) {
      reply = await requestProviderWithUsage(titlePayload, "openai", config, {
        surface: "chat",
        operation: "title",
      });
    } else {
      throw new Error("Configure GEMINI_API_KEY ou OPENAI_API_KEY para usar o chat com IA.");
    }
  } else if (canUseOpenAi) {
    reply = await requestProviderWithUsage(titlePayload, "openai", config, {
      surface: "chat",
      operation: "title",
    });
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
    priority: item?.priority === "high" || item?.priority === "low" ? item.priority : "medium",
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

function normalizePlanGoalInvestmentIds(value, fallbackValue = null) {
  const rawIds = [
    ...(Array.isArray(value) ? value : []),
    ...(fallbackValue === undefined || fallbackValue === null || fallbackValue === "" ? [] : [fallbackValue]),
  ];

  const ids = rawIds
    .map((investmentId) => Number(investmentId))
    .filter((investmentId) => Number.isInteger(investmentId) && investmentId > 0);

  return Array.from(new Set(ids));
}

function normalizePlanGoalTargetModel(value) {
  return value === "investment_box" ? "investment_box" : "category";
}

function normalizeInvestmentBox(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const name = String(value?.name ?? "").replace(/\s+/g, " ").trim();
  const contributionMode = value?.contributionMode === "income_percentage" || value?.contribution_mode === "income_percentage"
    ? "income_percentage"
    : "fixed_amount";
  const fixedAmountRaw = value?.fixedAmount ?? value?.fixed_amount;
  const incomePercentageRaw = value?.incomePercentage ?? value?.income_percentage;
  const currentAmountRaw = value?.currentAmount ?? value?.current_amount;
  const targetAmountRaw = value?.targetAmount ?? value?.target_amount;
  const fixedAmount = fixedAmountRaw === undefined || fixedAmountRaw === null || fixedAmountRaw === "" ? null : Number(fixedAmountRaw);
  const incomePercentage =
    incomePercentageRaw === undefined || incomePercentageRaw === null || incomePercentageRaw === ""
      ? null
      : Number(incomePercentageRaw);
  const currentAmount = currentAmountRaw === undefined || currentAmountRaw === null || currentAmountRaw === "" ? 0 : Number(currentAmountRaw);
  const targetAmount = targetAmountRaw === undefined || targetAmountRaw === null || targetAmountRaw === "" ? null : Number(targetAmountRaw);

  if (!name) {
    return null;
  }

  if (contributionMode === "fixed_amount" && (!Number.isFinite(fixedAmount) || fixedAmount < 0)) {
    return null;
  }

  if (contributionMode === "income_percentage" && (!Number.isFinite(incomePercentage) || incomePercentage < 0 || incomePercentage > 100)) {
    return null;
  }

  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return null;
  }

  if (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount < 0)) {
    return null;
  }

  return {
    name,
    description: String(value?.description ?? "").trim(),
    contributionMode,
    fixedAmount: contributionMode === "fixed_amount" ? Number(fixedAmount.toFixed(2)) : null,
    incomePercentage: contributionMode === "income_percentage" ? Number(incomePercentage.toFixed(2)) : null,
    currentAmount: Number(currentAmount.toFixed(2)),
    targetAmount: targetAmount === null ? null : Number(targetAmount.toFixed(2)),
    status: value?.status === "paused" || value?.status === "archived" ? value.status : "active",
    color: String(value?.color ?? "").trim() || null,
    notes: String(value?.notes ?? "").trim(),
  };
}

function normalizePlanGoal(value, fallback) {
  if (value?.type !== "transaction_sum") {
    return fallback;
  }

  const targetAmount = Number(value?.targetAmount ?? value?.target_amount);
  const startDate = normalizePlanGoalDate(value?.startDate ?? value?.start_date);
  const endDate = normalizePlanGoalDate(value?.endDate ?? value?.end_date);
  const targetModel = normalizePlanGoalTargetModel(value?.targetModel ?? value?.target_model);

  if (startDate && endDate && startDate > endDate) {
    return fallback;
  }

  const investmentBoxIdValue = value?.investmentBoxId ?? value?.investment_box_id;
  const investmentBoxIds = normalizePlanGoalInvestmentIds(value?.investmentBoxIds ?? value?.investment_box_ids, investmentBoxIdValue);
  const investmentBoxes = [
    ...(Array.isArray(value?.investmentBoxes) ? value.investmentBoxes : []),
    ...(Array.isArray(value?.investment_boxes) ? value.investment_boxes : []),
    value?.investmentBox ?? value?.investment_box,
  ]
    .filter(Boolean)
    .map(normalizeInvestmentBox)
    .filter(Boolean);

  return {
    type: "transaction_sum",
    source: "ai",
    targetAmount: Number.isFinite(targetAmount) && targetAmount > 0 ? Number(targetAmount.toFixed(2)) : null,
    transactionType: value?.transactionType === "income" || value?.transaction_type === "income" ? "income" : "expense",
    targetModel,
    categoryIds: targetModel === "category" ? normalizePlanGoalCategoryIds(value?.categoryIds ?? value?.category_ids) : [],
    investmentBoxId: targetModel === "investment_box" ? investmentBoxIds[0] ?? null : null,
    investmentBox: targetModel === "investment_box" ? investmentBoxes[0] ?? null : null,
    investmentBoxIds: targetModel === "investment_box" ? investmentBoxIds : [],
    investmentBoxes: targetModel === "investment_box" ? investmentBoxes : [],
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
      targetModel: "category",
      categoryIds: [],
      investmentBoxId: null,
      investmentBox: null,
      investmentBoxIds: [],
      investmentBoxes: [],
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
    clarifications: [],
  };
}

function normalizePlanDraftClarifications(value = []) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((clarification, index) => ({
      id: String(clarification?.id ?? clarification?.field ?? `clarification-${index}`).replace(/\s+/g, "-").slice(0, 80),
      field: String(clarification?.field ?? "").trim().slice(0, 80),
      question: String(clarification?.question ?? "").trim().slice(0, 240),
      required: clarification?.required !== false,
    }))
    .filter((clarification) => clarification.id && clarification.question);
}

function buildRequiredPlanDraftClarifications(draft) {
  if (draft.goal.type !== "transaction_sum") {
    return [];
  }

  const clarifications = [];

  if (!draft.goal.targetAmount || draft.goal.targetAmount <= 0) {
    clarifications.push({
      id: "target-amount",
      field: "goal.targetAmount",
      question: "Qual e o valor alvo deste planejamento?",
      required: true,
    });
  }

  if (draft.goal.targetModel === "category") {
    if (!draft.goal.startDate) {
      clarifications.push({
        id: "start-date",
        field: "goal.startDate",
        question: "Qual e a data de inicio para acompanhar estas transacoes?",
        required: true,
      });
    }

    if (!draft.goal.endDate) {
      clarifications.push({
        id: "end-date",
        field: "goal.endDate",
        question: "Qual e a data final para acompanhar esta meta de transacoes?",
        required: true,
      });
    }
  }

  if (draft.goal.targetModel === "investment_box" && !draft.goal.investmentBoxIds.length && !draft.goal.investmentBoxes.length) {
    clarifications.push({
      id: "investment-box-reference",
      field: "goal.investmentBoxIds",
      question: "Voce quer usar uma caixinha existente ou criar uma nova caixinha para este planejamento?",
      required: true,
    });
  }

  return clarifications;
}

function normalizePlanDraft(value, fallback) {
  const title = normalizeGeneratedTitle(value?.title, fallback.title);
  const items = Array.isArray(value?.items)
    ? value.items.map(normalizePlanItem).filter(Boolean).slice(0, 10)
    : [];
  const goal = normalizePlanGoal(value?.goal, fallback.goal);

  return {
    title,
    description: String(value?.description ?? fallback.description).trim() || fallback.description,
    goal,
    items: items.length ? items : fallback.items,
    clarifications: [
      ...normalizePlanDraftClarifications(value?.clarifications),
      ...buildRequiredPlanDraftClarifications({ goal }),
    ].filter((clarification, index, list) => list.findIndex((item) => item.id === clarification.id) === index),
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
      surface: "plans",
      operation: "draft",
      onUsageEvent: payload.onUsageEvent,
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

export async function revisePlanDraft(payload) {
  const fallback = normalizePlanDraft(payload.draft, buildFallbackPlanDraft(payload.chat));
  const correction = String(payload.correction ?? "").trim();
  const config = getChatAiConfig();

  if (!correction) {
    throw new Error("correction is required");
  }

  if (!config.enabled) {
    return fallback;
  }

  const reply = await requestConfiguredChatPayload(
    {
      surface: "plans",
      operation: "draft_revision",
      onUsageEvent: payload.onUsageEvent,
      task: "plan_draft_revision",
      generatedAt: payload.generatedAt,
      history: [
        {
          role: "user",
          content: JSON.stringify({
            chat: payload.chat,
            context: payload.context,
            draft: fallback,
            correction,
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
      surface: "plans",
      operation: "link_suggestion",
      onUsageEvent: payload.onUsageEvent,
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

function normalizePlanAssessmentStatus(value, progress) {
  if (value === "completed" || progress?.percentage >= 100) {
    return "completed";
  }

  if (value === "at_risk") {
    return "at_risk";
  }

  if (value === "attention") {
    return "attention";
  }

  return "on_track";
}

function normalizePriority(value, fallback = "medium") {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return fallback === "high" || fallback === "low" ? fallback : "medium";
}

function buildFallbackPlanAssessment(plan) {
  const progress = plan?.progress ?? {};
  const percentage = Number(progress.percentage ?? 0);
  const isTransactionGoal = plan?.goal?.type === "transaction_sum";
  const targetValue = Number(progress.targetValue ?? plan?.goal?.targetAmount ?? 0);
  const currentValue = Number(progress.currentValue ?? 0);
  const endDate = plan?.goal?.endDate ? new Date(`${plan.goal.endDate}T12:00:00Z`) : null;
  const today = new Date();
  const daysToEnd = endDate && !Number.isNaN(endDate.getTime()) ? Math.ceil((endDate.getTime() - today.getTime()) / 86400000) : null;

  let status = "on_track";
  let priority = "medium";
  let riskSummary = "O planejamento segue sem sinais criticos com os dados atuais.";
  let recommendation = "Continue acompanhando o progresso e revise novas transacoes vinculadas a meta.";

  if (percentage >= 100) {
    status = "completed";
    priority = "low";
    riskSummary = "A meta do planejamento foi concluida.";
    recommendation = "Revise o plano e marque proximas acoes ou encerre o acompanhamento.";
  } else if (isTransactionGoal && targetValue > 0 && currentValue > targetValue) {
    status = "at_risk";
    priority = "high";
    riskSummary = "A meta financeira ja ultrapassou o limite definido.";
    recommendation = "Replaneje o valor alvo, reduza novas despesas relacionadas ou ajuste o periodo.";
  } else if ((isTransactionGoal && percentage >= 80) || (daysToEnd !== null && daysToEnd < 0 && percentage < 100)) {
    status = "attention";
    priority = "high";
    riskSummary = daysToEnd !== null && daysToEnd < 0 ? "O periodo da meta terminou sem conclusao." : "A meta esta proxima do limite definido.";
    recommendation = "Revise as acoes pendentes e ajuste prioridade antes de novas movimentacoes.";
  }

  return {
    status,
    riskSummary,
    suggestedPriority: priority,
    adjustmentRecommendation: recommendation,
    recommendation:
      status === "on_track" || status === "completed"
        ? null
        : {
            title: status === "at_risk" ? "Replanejar meta em risco" : "Ajustar prioridades da meta",
            rationale: recommendation,
            proposedPlan: {
              goal: plan?.goal ?? null,
              items: (plan?.items ?? []).map((item, index) => ({
                title: item.title,
                description: item.description,
                status: item.status,
                priority: index === 0 ? "high" : normalizePriority(item.priority),
                sortOrder: item.sortOrder ?? index,
              })),
            },
          },
  };
}

function normalizePlanAssessment(value, fallback) {
  const status = value?.status ? normalizePlanAssessmentStatus(value.status, null) : fallback.status;
  const recommendation = value?.recommendation && typeof value.recommendation === "object" ? value.recommendation : fallback.recommendation;

  return {
    status,
    riskSummary: String(value?.riskSummary ?? value?.risk_summary ?? fallback.riskSummary).trim() || fallback.riskSummary,
    suggestedPriority: normalizePriority(value?.suggestedPriority ?? value?.suggested_priority, fallback.suggestedPriority),
    adjustmentRecommendation:
      String(value?.adjustmentRecommendation ?? value?.adjustment_recommendation ?? fallback.adjustmentRecommendation).trim() ||
      fallback.adjustmentRecommendation,
    recommendation: recommendation
      ? {
          title: String(recommendation.title ?? fallback.recommendation?.title ?? "Sugestao de replanejamento").trim(),
          rationale: String(recommendation.rationale ?? fallback.recommendation?.rationale ?? "").trim(),
          proposedPlan:
            typeof recommendation.proposedPlan === "object" && recommendation.proposedPlan !== null
              ? recommendation.proposedPlan
              : recommendation.proposed_plan && typeof recommendation.proposed_plan === "object"
                ? recommendation.proposed_plan
                : fallback.recommendation?.proposedPlan ?? {},
        }
      : null,
  };
}

export async function generatePlanAssessment(payload) {
  const fallback = buildFallbackPlanAssessment(payload.plan);
  const config = getChatAiConfig();

  if (!config.enabled) {
    return fallback;
  }

  const reply = await requestConfiguredChatPayload(
    {
      surface: "plans",
      operation: "assessment",
      onUsageEvent: payload.onUsageEvent,
      task: "plan_assessment",
      generatedAt: payload.generatedAt,
      history: [
        {
          role: "user",
          content: JSON.stringify({
            plan: payload.plan,
            context: payload.context,
            trigger: payload.trigger ?? null,
          }),
        },
      ],
    },
    config,
  );

  return normalizePlanAssessment(extractJsonObject(reply.content), fallback);
}

function buildFallbackChatSummary(chat) {
  const messages = chat?.messages ?? [];
  const firstUserMessage = messages.find((message) => message.role === "user")?.content;
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant")?.content;
  const base = firstUserMessage || chat?.title || "Conversa financeira";
  const next = lastAssistantMessage ? ` Ultima orientacao registrada: ${String(lastAssistantMessage).replace(/\s+/g, " ").trim()}` : "";

  return `${String(base).replace(/\s+/g, " ").trim().slice(0, 240)}.${next}`.slice(0, 900);
}

export async function generateChatSummary(payload) {
  const fallback = buildFallbackChatSummary(payload.chat);
  const config = getChatAiConfig();

  if (!config.enabled) {
    return {
      summary: fallback,
    };
  }

  const reply = await requestConfiguredChatPayload(
    {
      surface: "chat",
      operation: "summary",
      onUsageEvent: payload.onUsageEvent,
      task: "chat_summary",
      generatedAt: payload.generatedAt,
      history: [
        {
          role: "user",
          content: JSON.stringify({
            chat: payload.chat,
          }),
        },
      ],
    },
    config,
  );

  return {
    summary: String(reply.content ?? "").replace(/\s+/g, " ").trim().slice(0, 1200) || fallback,
  };
}
