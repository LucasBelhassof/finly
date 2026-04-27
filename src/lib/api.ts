import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { resolveInsightIcon, resolveLucideIcon } from "@/lib/icons";
import { appRoutes } from "@/lib/routes";
import type {
  ApiBank,
  ApiBanksResponse,
  ApiCategoriesResponse,
  ApiCategory,
  ApiChatConversation,
  ApiChatConversationResponse,
  ApiChatConversationsResponse,
  ApiChatMessage,
  ApiChatMessagesResponse,
  ApiChatReplyResponse,
  ApiChatSearchResponse,
  ApiChatSearchResult,
  ApiAdminActivityResponse,
  ApiAdminFinancialMetricsResponse,
  ApiAdminNotificationsResponse,
  ApiAdminOverviewResponse,
  ApiAdminSubscriptionMetricsResponse,
  ApiAdminNotificationTargetsResponse,
  ApiAdminUsersResponse,
  ApiDashboardResponse,
  AdminActivityData,
  AdminFinancialMetricsData,
  AdminNotificationsData,
  AdminNotificationTargetsData,
  AdminOverviewData,
  AdminSubscriptionMetricsData,
  AdminUsersData,
  ApiErrorResponse,
  ApiHealthResponse,
  ApiHousingItem,
  ApiHousingResponse,
  ApiInvestmentItem,
  ApiInvestmentsResponse,
  ApiImportCommitResponse,
  ApiImportAiSuggestionsResponse,
  ApiImportAiSuggestionItem,
  ApiImportPreviewItem,
  ApiImportPreviewResponse,
  ApiInsight,
  ApiInstallmentsOverviewResponse,
  ApiInsightsResponse,
  ApiNotificationsResponse,
  ApiPlan,
  ApiPlanDraftResponse,
  ApiPlanDraftSessionResponse,
  ApiPlanGoal,
  ApiPlanItem,
  ApiPlanLinkSuggestionResponse,
  ApiPlanRecommendationsResponse,
  ApiPlanChatSummaryResponse,
  ApiPlanProgress,
  ApiPlanResponse,
  ApiPlansResponse,
  ApiSpendingItem,
  ApiSpendingResponse,
  ApiSummaryCard,
  ApiTransaction,
  ApiTransactionAccount,
  ApiTransactionsResponse,
  BankItem,
  CreateAdminNotificationInput,
  CategoryItem,
  ChatConversation,
  ChatMessage,
  ChatReply,
  ChatRole,
  ChatSearchResult,
  CreateBankConnectionInput,
  CreateCategoryInput,
  CreateHousingInput,
  CreateInvestmentInput,
  CreatePlanInput,
  CreateSelfNotificationInput,
  CreateTransactionInput,
  DeleteTransactionInput,
  DashboardData,
  DashboardFilters,
  HealthStatus,
  HousingExpenseType,
  HousingItem,
  ImportCommitData,
  ImportCommitItem,
  ImportAiSuggestionsData,
  ImportAiSuggestionItem,
  ImportPreviewData,
  ImportPreviewItem,
  InsightItem,
  InstallmentsOverview,
  InstallmentsOverviewFilters,
  InvestmentItem,
  SpendingItem,
  SummaryCard,
  TransactionAccount,
  TransactionItem,
  NotificationsData,
  NotificationItem,
  NotificationsFilters,
  Plan,
  PlanChatSummary,
  PlanDraft,
  PlanDraftSession,
  PlanGoal,
  PlanItem,
  PlanRecommendation,
  PlanProgress,
  PlanLinkSuggestion,
  RevisePlanDraftInput,
  RevisePlanDraftSessionInput,
  UpdateCategoryInput,
  UpdateHousingInput,
  UpdateInvestmentInput,
  UpdatePlanInput,
  UpdateTransactionInput,
  UpdateBankConnectionInput,
} from "@/types/api";

const DEFAULT_API_URL = "";
export const apiBaseUrl = (import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL).replace(/\/$/, "");

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ApiAuthConfig = {
  getAccessToken: () => string | null;
  onAuthFailure: () => void | Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
};

const defaultApiAuthConfig: ApiAuthConfig = {
  getAccessToken: () => null,
  onAuthFailure: () => undefined,
  refreshAccessToken: async () => null,
};

let apiAuthConfig: ApiAuthConfig = defaultApiAuthConfig;

export function configureApiAuth(config: ApiAuthConfig) {
  apiAuthConfig = config;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeIdentifier(value: unknown, fallback: number | string = ""): number | string {
  return (typeof value === "number" && Number.isFinite(value)) || typeof value === "string" ? value : fallback;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function buildPath(path: string, params?: Record<string, string | number | undefined>) {
  if (!params) {
    return path;
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

async function parseResponseBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiErrorResponse;
  } catch {
    return { message: text } satisfies ApiErrorResponse;
  }
}

type RequestOptions = {
  allowRefreshRetry?: boolean;
  skipAuthHandling?: boolean;
};

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}) {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (init?.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuthHandling) {
    const accessToken = apiAuthConfig.getAccessToken();

    if (accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !options.skipAuthHandling && options.allowRefreshRetry !== false) {
    const refreshedAccessToken = await apiAuthConfig.refreshAccessToken();

    if (refreshedAccessToken) {
      return request<T>(path, init, {
        ...options,
        allowRefreshRetry: false,
      });
    }

    await apiAuthConfig.onAuthFailure();
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(
      safeString(body?.message, safeString(body?.error, "Não foi possível concluir a requisição.")),
      response.status,
      body?.error,
      body?.details,
    );
  }

  return body as T;
}

function resolveSummaryCardIcon(label: string) {
  if (label.toLowerCase().includes("receita")) {
    return TrendingUp;
  }

  if (label.toLowerCase().includes("despesa")) {
    return TrendingDown;
  }

  return Wallet;
}

function normalizeChatRole(role?: string): ChatRole {
  return role === "user" ? "user" : "assistant";
}

function normalizeImportType(type?: string): "income" | "expense" {
  return type === "income" ? "income" : "expense";
}

function normalizeHousingExpenseType(type?: string): HousingExpenseType {
  switch (type) {
    case "home_financing":
    case "electricity":
    case "water":
    case "condo":
    case "vehicle_financing":
    case "other":
      return type;
    case "rent":
    default:
      return "rent";
  }
}

function normalizeInsightColors(insight: ApiInsight) {
  switch (insight.tone) {
    case "warning":
      return {
        iconColor: safeString(insight.iconColor, "text-warning"),
        bgColor: safeString(insight.bgColor, "bg-warning/10"),
        tagColor: safeString(insight.tagColor, "bg-warning/15 text-warning"),
      };
    case "success":
      return {
        iconColor: safeString(insight.iconColor, "text-income"),
        bgColor: safeString(insight.bgColor, "bg-income/10"),
        tagColor: safeString(insight.tagColor, "bg-income/15 text-income"),
      };
    case "info":
      return {
        iconColor: safeString(insight.iconColor, "text-info"),
        bgColor: safeString(insight.bgColor, "bg-info/10"),
        tagColor: safeString(insight.tagColor, "bg-info/15 text-info"),
      };
    default:
      return {
        iconColor: safeString(insight.iconColor, "text-primary"),
        bgColor: safeString(insight.bgColor, "bg-primary/10"),
        tagColor: safeString(insight.tagColor, "bg-primary/15 text-primary"),
      };
  }
}

export function mapSummaryCard(card: ApiSummaryCard): SummaryCard {
  const label = safeString(card.label, "Resumo");
  const value = safeNumber(card.value);

  return {
    label,
    value,
    formattedValue: safeString(card.formattedValue, formatCurrency(value)),
    change: safeString(card.change, "0,0%"),
    positive: typeof card.positive === "boolean" ? card.positive : value >= 0,
    description: safeString(card.description, "vs mês anterior"),
    icon: resolveSummaryCardIcon(label),
  };
}

function mapAdminOverviewResponse(response: ApiAdminOverviewResponse): AdminOverviewData {
  return {
    totals: {
      totalUsers: safeNumber(response.totals?.totalUsers),
      activeUsers: safeNumber(response.totals?.activeUsers),
      premiumUsers: safeNumber(response.totals?.premiumUsers),
      freeUsers: safeNumber(response.totals?.freeUsers),
      usersOnlineNow: safeNumber(response.totals?.usersOnlineNow),
      activeSessions: safeNumber(response.totals?.activeSessions),
      totalTransactions: safeNumber(response.totals?.totalTransactions),
      aggregateBalance: safeNumber(response.totals?.aggregateBalance),
    },
    period: {
      startDate: safeString(response.period?.startDate),
      endDate: safeString(response.period?.endDate),
    },
    signups: (response.signups ?? []).map((item) => ({
      date: safeString(item.date),
      total: safeNumber(item.total),
    })),
  };
}

function mapAdminFinancialMetricsResponse(response: ApiAdminFinancialMetricsResponse): AdminFinancialMetricsData {
  return {
    period: {
      startDate: safeString(response.period?.startDate),
      endDate: safeString(response.period?.endDate),
    },
    summary: {
      totalIncome: safeNumber(response.summary?.totalIncome),
      totalExpenses: safeNumber(response.summary?.totalExpenses),
      aggregateBalance: safeNumber(response.summary?.aggregateBalance),
      averageTicketPerUser: safeNumber(response.summary?.averageTicketPerUser),
      transactionCount: safeNumber(response.summary?.transactionCount),
    },
    monthlySeries: (response.monthlySeries ?? []).map((item) => ({
      month: safeString(item.month),
      income: safeNumber(item.income),
      expenses: safeNumber(item.expenses),
      volume: safeNumber(item.volume),
      transactions: safeNumber(item.transactions),
    })),
    topUsers: (response.topUsers ?? []).map((item) => ({
      id: item.id ?? "",
      name: safeString(item.name, "Usuário"),
      email: safeString(item.email),
      transactionCount: safeNumber(item.transactionCount),
      transactedVolume: safeNumber(item.transactedVolume),
    })),
  };
}

function mapAdminSubscriptionMetricsResponse(response: ApiAdminSubscriptionMetricsResponse): AdminSubscriptionMetricsData {
  return {
    period: {
      startDate: safeString(response.period?.startDate),
      endDate: safeString(response.period?.endDate),
    },
    summary: {
      totalUsers: safeNumber(response.summary?.totalUsers),
      premiumUsers: safeNumber(response.summary?.premiumUsers),
      freeUsers: safeNumber(response.summary?.freeUsers),
      conversionRate: safeNumber(response.summary?.conversionRate),
      estimatedSubscriptionRevenue: safeNumber(response.summary?.estimatedSubscriptionRevenue),
      estimatedMrr: safeNumber(response.summary?.estimatedMrr),
    },
    evolution: (response.evolution ?? []).map((item) => ({
      month: safeString(item.month),
      premiumActivations: safeNumber(item.premiumActivations),
    })),
  };
}

function mapAdminActivityResponse(response: ApiAdminActivityResponse): AdminActivityData {
  return {
    events: (response.events ?? []).map((item) => ({
      id: item.id ?? "",
      eventType: safeString(item.eventType),
      success: Boolean(item.success),
      createdAt: safeString(item.createdAt),
      email: item.email ? safeString(item.email) : null,
      user: item.user
        ? {
            id: item.user.id ?? "",
                name: safeString(item.user.name, "Usuário"),
            role: item.user.role === "admin" ? "admin" : "user",
          }
        : null,
    })),
  };
}

function mapAdminUsersResponse(response: ApiAdminUsersResponse): AdminUsersData {
  return {
    page: safeNumber(response.page, 1),
    pageSize: safeNumber(response.pageSize, 20),
    total: safeNumber(response.total),
    users: (response.users ?? []).map((item) => ({
      id: item.id ?? "",
      name: safeString(item.name, "Usuário"),
      email: safeString(item.email),
      role: item.role === "admin" ? "admin" : "user",
      status: item.status === "inactive" || item.status === "suspended" ? item.status : "active",
      isPremium: Boolean(item.isPremium),
      createdAt: safeString(item.createdAt),
      premiumSince: item.premiumSince ? safeString(item.premiumSince) : null,
      lastSessionAt: item.lastSessionAt ? safeString(item.lastSessionAt) : null,
      transactionCount: safeNumber(item.transactionCount),
      netTotal: safeNumber(item.netTotal),
    })),
  };
}

function mapNotificationsResponse(response: ApiNotificationsResponse): NotificationsData {
  return {
    unreadCount: safeNumber(response.unreadCount),
    notifications: (response.notifications ?? []).map((item) => {
      const notification = item as Record<string, unknown>;

      return {
        recipientId: safeIdentifier(notification.recipientId),
        notificationId: safeIdentifier(notification.notificationId),
        title: safeString(notification.title, "Notificação"),
        message: safeString(notification.message),
        category:
          notification.category === "invoice_due" ||
          notification.category === "financing_due" ||
          notification.category === "installment_due" ||
          notification.category === "housing_due" ||
          notification.category === "custom"
            ? notification.category
            : "general",
        source:
          notification.source === "admin_all" || notification.source === "admin_selected"
            ? notification.source
            : "user_self",
        triggerAt: notification.triggerAt ? safeString(notification.triggerAt) : null,
        createdAt: safeString(notification.createdAt),
        isRead: Boolean(notification.isRead),
        readAt: notification.readAt ? safeString(notification.readAt) : null,
        actionHref: notification.actionHref ? safeString(notification.actionHref) : null,
        createdBy:
          typeof notification.createdBy === "object" && notification.createdBy !== null
            ? {
                id: safeIdentifier((notification.createdBy as Record<string, unknown>).id),
                name: safeString((notification.createdBy as Record<string, unknown>).name, "Sistema"),
              }
            : null,
      } satisfies NotificationItem;
    }),
  };
}

function mapAdminNotificationTargetsResponse(response: ApiAdminNotificationTargetsResponse): AdminNotificationTargetsData {
  return {
    users: (response.users ?? []).map((user) => ({
      id: user.id ?? "",
      name: safeString(user.name, "Usuário"),
      email: safeString(user.email),
      status: user.status === "inactive" || user.status === "suspended" ? user.status : "active",
      isPremium: Boolean(user.isPremium),
    })),
  };
}

function mapAdminNotificationsResponse(response: ApiAdminNotificationsResponse): AdminNotificationsData {
  return {
    notifications: (response.notifications ?? []).map((item) => ({
      id: item.id ?? "",
      title: safeString(item.title, "Notificação"),
      message: safeString(item.message),
      category:
        item.category === "invoice_due" ||
        item.category === "financing_due" ||
        item.category === "installment_due" ||
        item.category === "housing_due" ||
        item.category === "custom"
          ? item.category
          : "general",
      source: item.source === "admin_selected" ? "admin_selected" : "admin_all",
      audience:
        item.audience === "premium" || item.audience === "non_premium" || item.audience === "selected"
          ? item.audience
          : "all",
      triggerAt: item.triggerAt ? safeString(item.triggerAt) : null,
      createdAt: safeString(item.createdAt),
      recipientsCount: safeNumber(item.recipientsCount),
      readCount: safeNumber(item.readCount),
    })),
  };
}

export function mapCategory(category: ApiCategory): CategoryItem {
  return {
    id: category.id ?? safeString(category.slug, "category"),
    slug: safeString(category.slug, "category"),
    label: safeString(category.label, "Sem categoria"),
    transactionType: category.transactionType === "income" ? "income" : "expense",
    iconName: safeString(category.icon),
    icon: resolveLucideIcon(category.icon),
    color: safeString(category.color, "text-muted-foreground"),
    groupSlug: safeString(category.groupSlug, "outros"),
    groupLabel: safeString(category.groupLabel, "Outros"),
    groupColor: safeString(category.groupColor, "bg-muted-foreground"),
    isSystem: Boolean(category.isSystem),
  };
}

export function mapTransaction(transaction: ApiTransaction): TransactionItem {
  const amount = safeNumber(transaction.amount);
  const category = transaction.category ?? {};
  const account = transaction.account ?? {};

  return {
    id: transaction.id ?? `${safeString(transaction.description, "transaction")}-${safeString(transaction.occurredOn, "0")}`,
    description: safeString(transaction.description, "Transação"),
    amount,
    formattedAmount: safeString(
      transaction.formattedAmount,
      `${amount < 0 ? "- " : "+ "}${formatCurrency(Math.abs(amount))}`,
    ),
    occurredOn: safeString(transaction.occurredOn),
    relativeDate: safeString(transaction.relativeDate, safeString(transaction.occurredOn, "--")),
    isRecurring: Boolean(transaction.isRecurring),
    isRecurringProjection: Boolean(transaction.isRecurringProjection),
    sourceTransactionId:
      transaction.sourceTransactionId ??
      transaction.id ??
      `${safeString(transaction.description, "transaction")}-${safeString(transaction.occurredOn, "0")}`,
    housingId: transaction.housingId ?? null,
    isInstallment: Boolean(transaction.isInstallment),
    installmentPurchaseId: transaction.installmentPurchaseId ?? null,
    installmentNumber: typeof transaction.installmentNumber === "number" ? transaction.installmentNumber : null,
    installmentCount: typeof transaction.installmentCount === "number" ? transaction.installmentCount : null,
    purchaseOccurredOn: safeString(transaction.purchaseOccurredOn, "") || null,
    category: {
      id: category.id ?? safeString(category.slug, "outros"),
      slug: safeString(category.slug, "outros"),
      label: safeString(category.label, "Sem categoria"),
      iconName: safeString(category.icon),
      icon: resolveLucideIcon(category.icon),
      color: safeString(category.color, "text-muted-foreground"),
      groupSlug: safeString((category as ApiCategory).groupSlug, "outros"),
      groupLabel: safeString((category as ApiCategory).groupLabel, "Outros"),
      groupColor: safeString((category as ApiCategory).groupColor, "bg-muted-foreground"),
    },
    account: {
      id: account.id ?? safeString(account.slug, "account"),
      slug: safeString(account.slug, "account"),
      name: safeString(account.name, "Conta"),
      accountType:
        account.accountType === "credit_card" || account.accountType === "cash" ? account.accountType : "bank_account",
      color: safeString(account.color, "bg-secondary"),
    },
  };
}

export function mapSpendingItem(item: ApiSpendingItem): SpendingItem {
  const total = safeNumber(item.total);

  return {
    slug: safeString(item.slug, "outros"),
    label: safeString(item.label, "Outros"),
    color: safeString(item.color, "bg-muted-foreground"),
    total,
    formattedTotal: safeString(item.formattedTotal, formatCurrency(total)),
    percentage: Math.max(0, Math.min(100, Math.round(safeNumber(item.percentage)))),
  };
}

export function mapInsight(insight: ApiInsight): InsightItem {
  const colors = normalizeInsightColors(insight);
  const tone = safeString(insight.tone, "primary");
  const priority = insight.priority === "high" || insight.priority === "medium" || insight.priority === "low" ? insight.priority : "low";
  const insightType = safeString(insight.insightType, "general");
  const action = insight.action;
  const actionHref =
    action?.kind === "review_installments"
      ? appRoutes.expenseManagementInstallments
      : action?.kind === "review_accounts"
        ? appRoutes.accounts
        : action?.kind === "review_transactions"
          ? appRoutes.transactions
          : null;

  return {
    id: insight.id ?? safeString(insight.title, "insight"),
    title: safeString(insight.title, "Insight indisponível"),
    description: safeString(insight.description, "Não há detalhes adicionais para este insight."),
    tag: safeString(insight.tag, "IA"),
    tone,
    priority,
    priorityLabel: priority === "high" ? "Alta" : priority === "medium" ? "Média" : "Baixa",
    toneLabel: tone === "warning" ? "Atencao" : tone === "info" ? "Analise" : tone === "success" ? "Oportunidade" : "Leitura",
    insightType,
    metadata: typeof insight.metadata === "object" && insight.metadata !== null ? insight.metadata : {},
    action:
      action && safeString(action.label)
        ? {
            kind: safeString(action.kind, "review_transactions"),
            label: safeString(action.label),
            href: actionHref,
          }
        : null,
    icon: resolveInsightIcon(tone, insightType),
    iconColor: colors.iconColor,
    bgColor: colors.bgColor,
    tagColor: colors.tagColor,
  };
}

export function mapBank(bank: ApiBank): BankItem {
  const currentBalance = safeNumber(bank.currentBalance);
  const creditLimit =
    typeof bank.creditLimit === "number" ? bank.creditLimit : bank.creditLimit === null ? null : null;

  return {
    id: bank.id ?? safeString(bank.slug, safeString(bank.name, "bank")),
    slug: safeString(bank.slug, "bank"),
    name: safeString(bank.name, "Banco"),
    accountType: bank.accountType === "credit_card" || bank.accountType === "cash" ? bank.accountType : "bank_account",
    parentBankConnectionId: bank.parentBankConnectionId ?? null,
    parentAccountName: bank.parentAccountName ?? null,
    statementCloseDay: typeof bank.statementCloseDay === "number" ? bank.statementCloseDay : null,
    statementDueDay: typeof bank.statementDueDay === "number" ? bank.statementDueDay : null,
    connected: Boolean(bank.connected),
    color: safeString(bank.color, "bg-secondary"),
    currentBalance,
    formattedBalance: safeString(bank.formattedBalance, formatCurrency(currentBalance)),
    creditLimit,
    formattedCreditLimit: creditLimit === null ? null : safeString(bank.formattedCreditLimit, formatCurrency(creditLimit)),
  };
}

export function mapHousingItem(item: ApiHousingItem): HousingItem {
  const amount = safeNumber(item.amount);
  const bank = item.bank ?? {};
  const category = item.category ?? {};

  return {
    id: item.id ?? safeString(item.description, "housing"),
    description: safeString(item.description, "Despesa de habitação"),
    expenseType: normalizeHousingExpenseType(item.expenseType),
    amount,
    formattedAmount: safeString(item.formattedAmount, formatCurrency(amount)),
    dueDay: safeNumber(item.dueDay, 1),
    startDate: safeString(item.startDate),
    installmentCount: typeof item.installmentCount === "number" ? item.installmentCount : null,
    notes: safeString(item.notes),
    status: item.status === "inactive" ? "inactive" : "active",
    bank: {
      id: bank.id ?? "bank",
      slug: safeString(bank.slug, "bank"),
      name: safeString(bank.name, "Conta"),
      accountType: bank.accountType === "credit_card" || bank.accountType === "cash" ? bank.accountType : "bank_account",
      color: safeString(bank.color, "bg-secondary"),
    },
    category: {
      id: category.id ?? "category",
      slug: safeString(category.slug, "moradia"),
      label: safeString(category.label, "Moradia"),
      iconName: safeString(category.icon),
      icon: resolveLucideIcon(category.icon),
      color: safeString(category.color, "text-primary"),
      groupSlug: safeString((category as ApiCategory).groupSlug, "moradia"),
      groupLabel: safeString((category as ApiCategory).groupLabel, "Moradia"),
      groupColor: safeString((category as ApiCategory).groupColor, "bg-primary"),
    },
    installmentPurchaseId: item.installmentPurchaseId ?? null,
    transactionIds: item.transactionIds ?? [],
    transactions: (item.transactions ?? []).map((transaction) => ({
      id: transaction.id ?? "transaction",
      occurredOn: safeString(transaction.occurredOn),
      amount: safeNumber(transaction.amount),
      installmentNumber: typeof transaction.installmentNumber === "number" ? transaction.installmentNumber : null,
    })),
  };
}

export function mapChatMessage(message: ApiChatMessage): ChatMessage {
  const mapped = {
    id: message.id ?? `${normalizeChatRole(message.role)}-${safeString(message.createdAt, "0")}`,
    role: normalizeChatRole(message.role),
    content: safeString(message.content, "Sem conteúdo"),
    provider: safeString(message.provider, "") || null,
    model: safeString(message.model, "") || null,
    inputTokens: typeof message.inputTokens === "number" ? message.inputTokens : null,
    outputTokens: typeof message.outputTokens === "number" ? message.outputTokens : null,
    totalTokens: typeof message.totalTokens === "number" ? message.totalTokens : null,
    requestCount: typeof message.requestCount === "number" ? message.requestCount : null,
    estimatedCostUsd: typeof message.estimatedCostUsd === "number" ? message.estimatedCostUsd : null,
    createdAt: safeString(message.createdAt, new Date(0).toISOString()),
    planDraftAction: message.planDraftAction?.draftId
      ? {
          draftId: safeString(message.planDraftAction.draftId),
          status: normalizePlanDraftStatus(message.planDraftAction.status),
          label: safeString(message.planDraftAction.label, "Revisar plano"),
        }
      : null,
  };

  if (message.chatId !== undefined) {
    return {
      ...mapped,
      chatId: message.chatId,
    };
  }

  return mapped;
}

export function mapChatConversation(chat: ApiChatConversation): ChatConversation {
  return {
    id: safeString(chat.id, ""),
    title: safeString(chat.title, "Novo chat"),
    pinned: Boolean(chat.pinned),
    planId: safeString(chat.planId, "") || null,
    planTitle: safeString(chat.planTitle, "") || null,
    createdAt: safeString(chat.createdAt, new Date(0).toISOString()),
    updatedAt: safeString(chat.updatedAt, new Date(0).toISOString()),
  };
}

function normalizePlanItemStatus(status?: string) {
  return status === "done" ? "done" : "todo";
}

function normalizePlanPriority(priority?: string) {
  return priority === "high" || priority === "low" ? priority : "medium";
}

function normalizePlanAssessmentStatus(status?: string) {
  if (status === "completed" || status === "at_risk" || status === "attention") {
    return status;
  }

  return "on_track";
}

function normalizePlanDraftStatus(status?: string) {
  return status === "confirmed" || status === "dismissed" ? status : "pending";
}

function normalizePlanGoalType(type?: string) {
  return type === "transaction_sum" ? "transaction_sum" : "items";
}

function normalizePlanGoalSource(source?: string) {
  return source === "ai" ? "ai" : "manual";
}

function normalizePlanTransactionType(transactionType?: string) {
  return transactionType === "income" ? "income" : "expense";
}

function normalizePlanGoalTargetModel(targetModel?: string) {
  return targetModel === "investment_box" ? "investment_box" : "category";
}

function clampPercentage(value: unknown) {
  const numberValue = safeNumber(value);
  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function mapPlanGoal(goal: ApiPlanGoal = {}): PlanGoal {
  const type = normalizePlanGoalType(goal.type);
  const investmentBoxes = [
    ...(goal.investmentBoxes ?? []),
    ...(goal.investmentBox ? [goal.investmentBox] : []),
  ].map(mapInvestmentItem);
  const investmentBoxIds = Array.from(
    new Set([
      ...(goal.investmentBoxIds ?? []),
      ...(goal.investmentBoxId === undefined || goal.investmentBoxId === null || goal.investmentBoxId === ""
        ? []
        : [goal.investmentBoxId]),
      ...investmentBoxes.map((investment) => investment.id),
    ].map(String)),
  );
  const investmentBox = investmentBoxes[0] ?? null;

  return {
    type,
    source: normalizePlanGoalSource(goal.source),
    targetAmount: type === "transaction_sum" ? safeNumber(goal.targetAmount) : null,
    transactionType: normalizePlanTransactionType(goal.transactionType),
    targetModel: type === "transaction_sum" ? normalizePlanGoalTargetModel(goal.targetModel) : "category",
    categoryIds: (goal.categoryIds ?? []).filter((categoryId) => categoryId !== undefined && categoryId !== null && categoryId !== ""),
    investmentBoxId: investmentBoxIds[0] ?? null,
    investmentBox,
    investmentBoxIds,
    investmentBoxes,
    startDate: safeString(goal.startDate, "") || null,
    endDate: safeString(goal.endDate, "") || null,
  };
}

export function mapInvestmentItem(item: ApiInvestmentItem): InvestmentItem {
  const bank = item.bank ?? null;

  return {
    id: item.id ?? "investment",
    name: safeString(item.name, "Caixinha"),
    description: safeString(item.description, ""),
    contributionMode: item.contributionMode === "income_percentage" ? "income_percentage" : "fixed_amount",
    fixedAmount: item.fixedAmount === null || item.fixedAmount === undefined ? null : safeNumber(item.fixedAmount),
    incomePercentage:
      item.incomePercentage === null || item.incomePercentage === undefined ? null : safeNumber(item.incomePercentage),
    currentAmount: safeNumber(item.currentAmount),
    formattedCurrentAmount: safeString(item.formattedCurrentAmount, formatCurrency(item.currentAmount ?? 0)),
    targetAmount: item.targetAmount === null || item.targetAmount === undefined ? null : safeNumber(item.targetAmount),
    formattedTargetAmount: safeString(item.formattedTargetAmount, "") || null,
    status: item.status === "paused" || item.status === "archived" ? item.status : "active",
    color: safeString(item.color, "") || null,
    notes: safeString(item.notes, ""),
    bank: bank
      ? {
          id: bank.id ?? "bank",
          slug: safeString(bank.slug, "bank"),
          name: safeString(bank.name, "Conta"),
          accountType: bank.accountType === "credit_card" || bank.accountType === "cash" ? bank.accountType : "bank_account",
          color: safeString(bank.color, "bg-secondary"),
        }
      : null,
    createdAt: safeString(item.createdAt, new Date(0).toISOString()),
    updatedAt: safeString(item.updatedAt, new Date(0).toISOString()),
  };
}

function mapPlanProgress(progress: ApiPlanProgress = {}, goal: PlanGoal, items: PlanItem[]): PlanProgress {
  if (progress.type) {
    return {
      type: normalizePlanGoalType(progress.type),
      percentage: clampPercentage(progress.percentage),
      currentValue: progress.currentValue === null || progress.currentValue === undefined ? null : safeNumber(progress.currentValue),
      targetValue: progress.targetValue === null || progress.targetValue === undefined ? null : safeNumber(progress.targetValue),
      formattedCurrentValue: safeString(progress.formattedCurrentValue, "") || null,
      formattedTargetValue: safeString(progress.formattedTargetValue, "") || null,
      completedItems: progress.completedItems === null || progress.completedItems === undefined ? null : safeNumber(progress.completedItems),
      totalItems: progress.totalItems === null || progress.totalItems === undefined ? null : safeNumber(progress.totalItems),
    };
  }

  const completedItems = items.filter((item) => item.status === "done").length;
  const totalItems = items.length;

  if (goal.type === "transaction_sum") {
    return {
      type: "transaction_sum",
      percentage: 0,
      currentValue: 0,
      targetValue: goal.targetAmount,
      formattedCurrentValue: formatCurrency(0),
      formattedTargetValue: goal.targetAmount !== null ? formatCurrency(goal.targetAmount) : null,
      completedItems: null,
      totalItems: null,
    };
  }

  return {
    type: "items",
    percentage: totalItems > 0 ? clampPercentage((completedItems / totalItems) * 100) : 0,
    currentValue: null,
    targetValue: null,
    formattedCurrentValue: null,
    formattedTargetValue: null,
    completedItems,
    totalItems,
  };
}

export function mapPlanItem(item: ApiPlanItem): PlanItem {
  return {
    id: item.id ?? `item-${safeString(item.title, "plan")}`,
    title: safeString(item.title, "Item do planejamento"),
    description: safeString(item.description, ""),
    status: normalizePlanItemStatus(item.status),
    priority: normalizePlanPriority(item.priority),
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
  };
}

export function mapPlanRecommendation(recommendation: Record<string, unknown>): PlanRecommendation {
  const recommendationId =
    typeof recommendation.id === "string" || typeof recommendation.id === "number" ? recommendation.id : "";

  return {
    id: recommendationId,
    status:
      recommendation.status === "applied" || recommendation.status === "dismissed" ? recommendation.status : "pending",
    title: safeString(recommendation.title, "Sugestao de replanejamento"),
    rationale: safeString(recommendation.rationale, ""),
    proposedPlan:
      typeof recommendation.proposedPlan === "object" && recommendation.proposedPlan !== null
        ? (recommendation.proposedPlan as Record<string, unknown>)
        : {},
    createdAt: safeString(recommendation.createdAt, new Date(0).toISOString()),
    appliedAt: recommendation.appliedAt ? safeString(recommendation.appliedAt) : null,
  };
}

export function mapPlan(plan: ApiPlan): Plan {
  const goal = mapPlanGoal(plan.goal);
  const items = (plan.items ?? []).map(mapPlanItem).sort((left, right) => left.sortOrder - right.sortOrder);
  const assessment = plan.aiAssessment ?? null;

  return {
    id: safeString(plan.id, ""),
    title: safeString(plan.title, "Planejamento"),
    description: safeString(plan.description, ""),
    source: plan.source === "ai" ? "ai" : "manual",
    goal,
    progress: mapPlanProgress(plan.progress, goal, items),
    createdAt: safeString(plan.createdAt, new Date(0).toISOString()),
    updatedAt: safeString(plan.updatedAt, new Date(0).toISOString()),
    items,
    chats: (plan.chats ?? []).map(mapChatConversation).filter((chat) => chat.id),
    aiAssessment: assessment
      ? {
          id: assessment.id ?? "",
          status: normalizePlanAssessmentStatus(assessment.status),
          riskSummary: safeString(assessment.riskSummary, ""),
          suggestedPriority: normalizePlanPriority(assessment.suggestedPriority),
          adjustmentRecommendation: safeString(assessment.adjustmentRecommendation, ""),
          assessedAt: safeString(assessment.assessedAt, new Date(0).toISOString()),
        }
      : null,
    pendingRecommendations: (plan.pendingRecommendations ?? []).map((item) => mapPlanRecommendation(item as Record<string, unknown>)),
  };
}

export function mapChatSearchResult(result: ApiChatSearchResult): ChatSearchResult {
  return {
    chatId: safeString(result.chatId, ""),
    title: safeString(result.title, "Novo chat"),
    matchedText: safeString(result.matchedText, ""),
    matchedAt: safeString(result.matchedAt, new Date(0).toISOString()),
    matchType: result.matchType === "message" ? "message" : "title",
  };
}

export function mapTransactionsResponse(response: ApiTransactionsResponse) {
  return (response.transactions ?? []).map(mapTransaction);
}

export function mapCategoriesResponse(response: ApiCategoriesResponse) {
  return (response.categories ?? []).map(mapCategory);
}

export function mapSpendingResponse(response: ApiSpendingResponse) {
  return (response.spending ?? []).map(mapSpendingItem);
}

export function mapInsightsResponse(response: ApiInsightsResponse) {
  return (response.insights ?? []).map(mapInsight);
}

export function mapBanksResponse(response: ApiBanksResponse) {
  return (response.banks ?? []).map(mapBank);
}

export function mapHousingResponse(response: ApiHousingResponse) {
  return (response.housing ?? []).map(mapHousingItem);
}

export function mapInvestmentsResponse(response: ApiInvestmentsResponse) {
  return (response.investments ?? []).map(mapInvestmentItem);
}

export function mapInstallmentsOverviewResponse(response: ApiInstallmentsOverviewResponse): InstallmentsOverview {
  const appliedFilters = response.applied_filters ?? {};
  const concentration = response.alerts?.concentration ?? {};
  const charts = response.charts ?? {};
  const filterOptions = response.filter_options ?? {};

  return {
    appliedFilters: {
      cardId: appliedFilters.cardId !== undefined && appliedFilters.cardId !== null ? String(appliedFilters.cardId) : "all",
      categoryId:
        appliedFilters.categoryId !== undefined && appliedFilters.categoryId !== null ? String(appliedFilters.categoryId) : "all",
      status:
        appliedFilters.status === "active" || appliedFilters.status === "paid" || appliedFilters.status === "overdue"
          ? appliedFilters.status
          : "all",
      installmentAmountMin:
        typeof appliedFilters.installmentAmountMin === "number" ? appliedFilters.installmentAmountMin : null,
      installmentAmountMax:
        typeof appliedFilters.installmentAmountMax === "number" ? appliedFilters.installmentAmountMax : null,
      installmentCountMode:
        appliedFilters.installmentCountMode === "installment_count" || appliedFilters.installmentCountMode === "remaining_installments"
          ? appliedFilters.installmentCountMode
          : "all",
      installmentCountValue:
        typeof appliedFilters.installmentCountValue === "number" ? appliedFilters.installmentCountValue : null,
      purchaseStart: safeString(appliedFilters.purchaseStart, "") || null,
      purchaseEnd: safeString(appliedFilters.purchaseEnd, "") || null,
      sortBy:
        appliedFilters.sortBy === "installment_amount" ||
        appliedFilters.sortBy === "remaining_balance" ||
        appliedFilters.sortBy === "next_due_date" ||
        appliedFilters.sortBy === "purchase_date"
          ? appliedFilters.sortBy
          : "smart",
      sortOrder: appliedFilters.sortOrder === "asc" ? "asc" : "desc",
    },
    activeInstallmentsCount: safeNumber(response.active_installments_count),
    monthlyCommitment: safeNumber(response.monthly_commitment),
    remainingBalanceTotal: safeNumber(response.remaining_balance_total),
    originalAmountTotal: safeNumber(response.original_amount_total),
    payoffProjectionMonth: safeString(response.payoff_projection_month, "") || null,
    alerts: {
      concentration: {
        thresholdRatio: safeNumber(concentration.threshold_ratio, 0.5),
        triggered: Boolean(concentration.triggered),
        cardId: concentration.card_id ?? null,
        cardName: safeString(concentration.card_name, "") || null,
        shareRatio: safeNumber(concentration.share_ratio),
        monthlyAmount: safeNumber(concentration.monthly_amount),
      },
    },
    charts: {
      next3MonthsProjection: (charts.next_3_months_projection ?? []).map((item) => ({
        month: safeString(item.month, "--"),
        amount: safeNumber(item.amount),
      })),
      monthlyCommitmentEvolution: (charts.monthly_commitment_evolution ?? []).map((item) => ({
        month: safeString(item.month, "--"),
        amount: safeNumber(item.amount),
      })),
      cardDistribution: (charts.card_distribution ?? []).map((item) => ({
        cardId: item.card_id ?? "card",
        cardName: safeString(item.card_name, "Cartão"),
        amount: safeNumber(item.amount),
        shareRatio: safeNumber(item.share_ratio),
      })),
      topCategories: (charts.top_categories ?? []).map((item) => ({
        categoryId: item.category_id ?? "category",
        category: safeString(item.category, "Categoria"),
        amount: safeNumber(item.amount),
      })),
    },
    filterOptions: {
      cards: (filterOptions.cards ?? []).map((item) => ({
        id: item.id ?? "card",
        name: safeString(item.name, "Cartão"),
      })),
      categories: (filterOptions.categories ?? []).map((item) => ({
        id: item.id ?? "category",
        label: safeString(item.label, "Categoria"),
      })),
      statuses: (filterOptions.statuses ?? [])
        .filter((value): value is "active" | "paid" | "overdue" => value === "active" || value === "paid" || value === "overdue"),
      installmentCountValues: (filterOptions.installment_count_values ?? []).filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      ),
      remainingInstallmentValues: (filterOptions.remaining_installment_values ?? []).filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      ),
      installmentAmountRange: {
        min: safeNumber(filterOptions.installment_amount_range?.min),
        max: safeNumber(filterOptions.installment_amount_range?.max),
      },
    },
    items: (response.items ?? []).map((item) => ({
      transactionId: item.transaction_id ?? "transaction",
      installmentTransactionId: item.installment_transaction_id ?? null,
      installmentPurchaseId: item.installment_purchase_id ?? "installment",
      description: safeString(item.description, "Parcelamento"),
      category: safeString(item.category, "Sem categoria"),
      categoryId: item.category_id ?? "category",
      cardId: item.card_id ?? "card",
      cardName: safeString(item.card_name, "Cartão"),
      purchaseDate: safeString(item.purchase_date),
      totalAmount: safeNumber(item.total_amount),
      installmentAmount: safeNumber(item.installment_amount),
      installmentCount: safeNumber(item.installment_count),
      currentInstallment: safeNumber(item.current_installment),
      displayInstallmentNumber: safeNumber(item.display_installment_number, safeNumber(item.current_installment)),
      remainingInstallments: safeNumber(item.remaining_installments),
      remainingBalance: safeNumber(item.remaining_balance),
      nextDueDate: safeString(item.next_due_date, "") || null,
      installmentDueDate: safeString(item.installment_due_date, "") || null,
      installmentMonth: safeString(item.installment_month, "") || null,
      status: item.status === "paid" || item.status === "overdue" ? item.status : "active",
    })),
  };
}

export function mapChatMessagesResponse(response: ApiChatMessagesResponse) {
  return (response.messages ?? []).map(mapChatMessage);
}

export function mapChatConversationsResponse(response: ApiChatConversationsResponse) {
  return (response.chats ?? []).map(mapChatConversation).filter((chat) => chat.id);
}

export function mapChatConversationResponse(response: ApiChatConversationResponse) {
  return mapChatConversation(response.chat ?? {});
}

export function mapChatSearchResponse(response: ApiChatSearchResponse) {
  return (response.results ?? []).map(mapChatSearchResult).filter((result) => result.chatId);
}

export function mapPlansResponse(response: ApiPlansResponse) {
  return (response.plans ?? []).map(mapPlan).filter((plan) => plan.id);
}

export function mapPlanResponse(response: ApiPlanResponse) {
  return mapPlan(response.plan ?? {});
}

export function mapPlanDraftResponse(response: ApiPlanDraftResponse): PlanDraft {
  const items = (response.draft?.items ?? []).map(mapPlanItem);
  const goal = mapPlanGoal(response.draft?.goal ?? { source: "ai" });

  return {
    title: safeString(response.draft?.title, "Planejamento"),
    description: safeString(response.draft?.description, ""),
    goal,
    items,
    clarifications: (response.draft?.clarifications ?? [])
      .map((clarification) => ({
        id: safeString(clarification.id, safeString(clarification.field, "clarification")),
        field: safeString(clarification.field, ""),
        question: safeString(clarification.question, ""),
        required: clarification.required !== false,
      }))
      .filter((clarification) => clarification.id && clarification.question),
  };
}

export function mapPlanDraftSessionResponse(response: ApiPlanDraftSessionResponse): PlanDraftSession {
  const draftSession = response.draftSession ?? {};
  const revisionMessages = (draftSession.revisionMessages ?? [])
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" as const : "user" as const,
      content: safeString(message.content, ""),
    }))
    .filter((message) => message.content);

  return {
    id: safeString(draftSession.id, ""),
    chatId: safeString(draftSession.chatId, ""),
    assistantMessageId: draftSession.assistantMessageId ?? null,
    draft: mapPlanDraftResponse({ draft: draftSession.draft }),
    revisionMessages,
    status: normalizePlanDraftStatus(draftSession.status),
    createdAt: safeString(draftSession.createdAt, new Date(0).toISOString()),
    updatedAt: safeString(draftSession.updatedAt, new Date(0).toISOString()),
    resolvedAt: draftSession.resolvedAt ? safeString(draftSession.resolvedAt) : null,
  };
}

export function mapPlanLinkSuggestionResponse(response: ApiPlanLinkSuggestionResponse): PlanLinkSuggestion {
  const suggestion = response.suggestion ?? {};
  return {
    action: suggestion.action === "link" ? "link" : "create",
    planId: safeString(suggestion.planId, "") || null,
    rationale: safeString(suggestion.rationale, ""),
  };
}

export function mapPlanRecommendationsResponse(response: ApiPlanRecommendationsResponse): PlanRecommendation[] {
  return (response.recommendations ?? []).map((item) => mapPlanRecommendation(item as Record<string, unknown>));
}

export function mapPlanChatSummaryResponse(response: ApiPlanChatSummaryResponse): PlanChatSummary {
  const summary = response.summary ?? {};

  return {
    id: summary.id ?? null,
    chatId: safeString(summary.chatId, ""),
    summary: safeString(summary.summary, ""),
    messageCount: safeNumber(summary.messageCount),
    lastMessageId:
      summary.lastMessageId === null || summary.lastMessageId === undefined ? null : safeNumber(summary.lastMessageId),
    generatedAt: summary.generatedAt ? safeString(summary.generatedAt) : null,
    updatedAt: summary.updatedAt ? safeString(summary.updatedAt) : null,
    stale: Boolean(summary.stale),
  };
}

export function mapChatReplyResponse(response: ApiChatReplyResponse): ChatReply {
  const userMessages = Array.isArray(response.userMessages) && response.userMessages.length
    ? response.userMessages.map(mapChatMessage)
    : [mapChatMessage(response.userMessage ?? { role: "user" })];

  return {
    chat: response.chat ? mapChatConversation(response.chat) : null,
    userMessage: userMessages[0],
    userMessages,
    assistantMessage: mapChatMessage(response.assistantMessage ?? { role: "assistant" }),
  };
}

function mapImportPreviewItem(item: ApiImportPreviewItem): ImportPreviewItem {
  const aiStatus =
    item.aiStatus === "suggested" ||
    item.aiStatus === "no_match" ||
    item.aiStatus === "error" ||
    item.aiStatus === "invalid" ||
    item.aiStatus === "idle"
      ? item.aiStatus
      : "idle";

  return {
    rowIndex: safeNumber(item.rowIndex),
    description: safeString(item.description),
    normalizedDescription: safeString(item.normalizedDescription),
    purchaseDescriptionBase: safeString(item.purchaseDescriptionBase, "") || null,
    normalizedPurchaseDescriptionBase: safeString(item.normalizedPurchaseDescriptionBase, "") || null,
    amount: safeString(item.amount, "0.00"),
    normalizedAmount: safeString(item.normalizedAmount, safeString(item.amount, "0.00")),
    occurredOn: safeString(item.occurredOn),
    normalizedOccurredOn: safeString(item.normalizedOccurredOn, safeString(item.occurredOn)),
    purchaseOccurredOn: safeString(item.purchaseOccurredOn, "") || null,
    isInstallment: Boolean(item.isInstallment),
    installmentIndex: typeof item.installmentIndex === "number" ? item.installmentIndex : null,
    installmentCount: typeof item.installmentCount === "number" ? item.installmentCount : null,
    generatedInstallmentCount: typeof item.generatedInstallmentCount === "number" ? item.generatedInstallmentCount : null,
    type: normalizeImportType(item.type),
    suggestedCategoryId: item.suggestedCategoryId ?? null,
    suggestedCategoryLabel: item.suggestedCategoryLabel ?? null,
    suggestionSource:
      item.suggestionSource === "rule" ||
      item.suggestionSource === "history" ||
      item.suggestionSource === "recurring_rule" ||
      item.suggestionSource === "ai"
        ? item.suggestionSource
        : null,
    importSource: item.importSource === "credit_card_statement" ? "credit_card_statement" : "bank_statement",
    bankConnectionId: item.bankConnectionId ?? "",
    bankConnectionName: safeString(item.bankConnectionName, "Conta"),
    matchedRuleId: item.matchedRuleId ?? null,
    aiSuggestedType: item.aiSuggestedType === "income" || item.aiSuggestedType === "expense" ? item.aiSuggestedType : null,
    aiSuggestedCategoryId: item.aiSuggestedCategoryId ?? null,
    aiSuggestedCategoryLabel: item.aiSuggestedCategoryLabel ?? null,
    aiConfidence: typeof item.aiConfidence === "number" ? item.aiConfidence : null,
    aiReason: safeString(item.aiReason),
    aiStatus,
    possibleDuplicate: Boolean(item.possibleDuplicate),
    duplicateReason: safeString(item.duplicateReason),
    canImport: Boolean(item.canImport),
    requiresCategorySelection: Boolean(item.requiresCategorySelection),
    requiresUserAction: Boolean(item.requiresUserAction),
    defaultExclude: Boolean(item.defaultExclude),
    warnings: Array.isArray(item.warnings) ? item.warnings.map((value) => safeString(value)).filter(Boolean) : [],
    errors: Array.isArray(item.errors) ? item.errors.map((value) => safeString(value)).filter(Boolean) : [],
    sourceRow: item.sourceRow,
  };
}

function mapImportAiSuggestionItem(item: ApiImportAiSuggestionItem): ImportAiSuggestionItem {
    return {
      rowIndex: safeNumber(item.rowIndex),
      aiSuggestedType: item.aiSuggestedType === "income" || item.aiSuggestedType === "expense" ? item.aiSuggestedType : null,
      aiSuggestedCategoryId: item.aiSuggestedCategoryId ?? null,
    aiSuggestedCategoryLabel: item.aiSuggestedCategoryLabel ?? null,
    aiConfidence: typeof item.aiConfidence === "number" ? item.aiConfidence : null,
    aiReason: safeString(item.aiReason),
    aiStatus:
      item.aiStatus === "suggested" ||
      item.aiStatus === "no_match" ||
      item.aiStatus === "error" ||
      item.aiStatus === "invalid" ||
      item.aiStatus === "idle"
        ? item.aiStatus
        : "idle",
    suggestionSource: item.suggestionSource === "ai" ? "ai" : null,
  };
}

export function mapImportPreviewResponse(response: ApiImportPreviewResponse): ImportPreviewData {
  return {
    previewToken: safeString(response.previewToken),
    expiresAt: safeString(response.expiresAt),
    importSource: response.importSource === "credit_card_statement" ? "credit_card_statement" : "bank_statement",
    bankConnectionId: response.bankConnectionId ?? "",
    bankConnectionName: safeString(response.bankConnectionName, "Conta"),
    fileMetadata: {
      originalFilename: response.fileMetadata?.originalFilename ? safeString(response.fileMetadata.originalFilename) : null,
      issuerName: response.fileMetadata?.issuerName ? safeString(response.fileMetadata.issuerName) : null,
      statementDueDate: response.fileMetadata?.statementDueDate ? safeString(response.fileMetadata.statementDueDate) : null,
      statementReferenceMonth: response.fileMetadata?.statementReferenceMonth
        ? safeString(response.fileMetadata.statementReferenceMonth)
        : null,
    },
    fileSummary: {
      totalRows: safeNumber(response.fileSummary?.totalRows),
      importableRows: safeNumber(response.fileSummary?.importableRows),
      errorRows: safeNumber(response.fileSummary?.errorRows),
      duplicateRows: safeNumber(response.fileSummary?.duplicateRows),
      actionRequiredRows: safeNumber(response.fileSummary?.actionRequiredRows),
    },
    items: (response.items ?? []).map(mapImportPreviewItem),
  };
}

export function mapImportCommitResponse(response: ApiImportCommitResponse): ImportCommitData {
  return {
    importedCount: safeNumber(response.importedCount),
    skippedCount: safeNumber(response.skippedCount),
    failedCount: safeNumber(response.failedCount),
    results: (response.results ?? []).map((item) => ({
      rowIndex: safeNumber(item.rowIndex),
      status: item.status === "imported" || item.status === "failed" ? item.status : "skipped",
      reason: safeString(item.reason),
      message: safeString(item.message),
      transaction: item.transaction ? mapTransaction(item.transaction) : undefined,
    })),
  };
}

export function mapImportAiSuggestionsResponse(response: ApiImportAiSuggestionsResponse): ImportAiSuggestionsData {
  return {
    previewToken: safeString(response.previewToken),
    status: response.status === "disabled" ? "disabled" : "completed",
    autoApplyThreshold:
      typeof response.autoApplyThreshold === "number" && response.autoApplyThreshold >= 0 && response.autoApplyThreshold <= 1
        ? response.autoApplyThreshold
        : 0.8,
    summary: {
      requestedRows: safeNumber(response.summary?.requestedRows),
      suggestedRows: safeNumber(response.summary?.suggestedRows),
      noMatchRows: safeNumber(response.summary?.noMatchRows),
      failedRows: safeNumber(response.summary?.failedRows),
    },
    items: (response.items ?? []).map(mapImportAiSuggestionItem),
  };
}

export function mapDashboardResponse(response: ApiDashboardResponse): DashboardData {
  return {
    user: {
      id: response.user?.id ?? "default-user",
      name: safeString(response.user?.name, "Usuário"),
      email: safeString(response.user?.email, "usuario@email.com"),
    },
    referenceMonth: response.referenceMonth ?? null,
    summaryCards: (response.summaryCards ?? []).map(mapSummaryCard),
    recentTransactions: (response.recentTransactions ?? []).map(mapTransaction),
    spendingByCategory: (response.spendingByCategory ?? []).map(mapSpendingItem),
    insights: (response.insights ?? []).map(mapInsight),
    banks: (response.banks ?? []).map(mapBank),
    chatMessages: (response.chatMessages ?? []).map(mapChatMessage),
  };
}

export function mapHealthResponse(response: ApiHealthResponse): HealthStatus {
  return {
    status: safeString(response.status, "unknown"),
    database: safeString(response.database, "unknown"),
    serverTime: safeString(response.serverTime, ""),
  };
}

export async function getDashboard(filters: DashboardFilters = {}) {
  const response = await request<ApiDashboardResponse>(
    buildPath("/api/dashboard", {
      startDate: filters.startDate ?? undefined,
      endDate: filters.endDate ?? undefined,
    }),
  );
  return mapDashboardResponse(response);
}

export async function getAdminOverview(startDate?: string, endDate?: string) {
  const response = await request<ApiAdminOverviewResponse>(
    buildPath("/api/admin/overview", {
      startDate,
      endDate,
    }),
  );

  return mapAdminOverviewResponse(response);
}

export async function getAdminUsers(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  premium?: string;
  recentActivity?: string;
} = {}) {
  const response = await request<ApiAdminUsersResponse>(
    buildPath("/api/admin/users", {
      page: params.page,
      pageSize: params.pageSize,
      status: params.status,
      premium: params.premium,
      recentActivity: params.recentActivity,
    }),
  );

  return mapAdminUsersResponse(response);
}

export async function getAdminFinancialMetrics(startDate?: string, endDate?: string) {
  const response = await request<ApiAdminFinancialMetricsResponse>(
    buildPath("/api/admin/financial-metrics", {
      startDate,
      endDate,
    }),
  );

  return mapAdminFinancialMetricsResponse(response);
}

export async function getAdminSubscriptionMetrics(startDate?: string, endDate?: string) {
  const response = await request<ApiAdminSubscriptionMetricsResponse>(
    buildPath("/api/admin/subscription-metrics", {
      startDate,
      endDate,
    }),
  );

  return mapAdminSubscriptionMetricsResponse(response);
}

export async function getAdminActivity(limit?: number) {
  const response = await request<ApiAdminActivityResponse>(
    buildPath("/api/admin/activity", {
      limit,
    }),
  );

  return mapAdminActivityResponse(response);
}

export async function getAdminNotificationTargets() {
  const response = await request<ApiAdminNotificationTargetsResponse>("/api/admin/notification-targets");
  return mapAdminNotificationTargetsResponse(response);
}

export async function getAdminNotifications(limit = 50) {
  const response = await request<ApiAdminNotificationsResponse>(
    buildPath("/api/admin/notifications", {
      limit,
    }),
  );

  return mapAdminNotificationsResponse(response);
}

export async function postAdminNotification(input: CreateAdminNotificationInput) {
  return request<{ notificationId: number; recipientsCount: number }>("/api/admin/notifications", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      message: input.message,
      category: input.category,
      triggerAt: input.triggerAt ?? null,
      target: {
        mode: input.target.mode,
        audience: input.target.audience ?? "all",
        userIds: input.target.userIds ?? [],
      },
    }),
  });
}

export async function getNotifications(filters: NotificationsFilters = {}) {
  const response = await request<ApiNotificationsResponse>(
    buildPath("/api/notifications", {
      limit: filters.limit ?? 30,
      status: filters.status === "all" ? undefined : filters.status,
      unreadOnly: filters.status === "unread" ? "true" : undefined,
      source: filters.source === "all" ? undefined : filters.source,
      startDate: filters.startDate ?? undefined,
      endDate: filters.endDate ?? undefined,
    }),
  );

  return mapNotificationsResponse(response);
}

export async function postSelfNotification(input: CreateSelfNotificationInput) {
  return request<{ notificationId: number }>("/api/notifications/self", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      message: input.message,
      category: input.category,
      triggerAt: input.triggerAt ?? null,
    }),
  });
}

export async function patchNotificationRead(recipientId: number | string) {
  await request<null>(`/api/notifications/${recipientId}/read`, {
    method: "PATCH",
  });
}

export async function patchNotificationUnread(recipientId: number | string) {
  await request<null>(`/api/notifications/${recipientId}/unread`, {
    method: "PATCH",
  });
}

export async function deleteNotification(recipientId: number | string) {
  await request<null>(`/api/notifications/${recipientId}`, {
    method: "DELETE",
  });
}

export async function patchReadAllNotifications() {
  return request<{ updatedCount: number }>("/api/notifications/read-all", {
    method: "PATCH",
  });
}

export async function getHealth() {
  const response = await request<ApiHealthResponse>("/api/health");
  return mapHealthResponse(response);
}

export async function getInstallmentsOverview(filters: Partial<InstallmentsOverviewFilters> = {}) {
  const response = await request<ApiInstallmentsOverviewResponse>(
    buildPath("/api/installments/overview", {
      cardId: filters.cardId,
      categoryId: filters.categoryId,
      status: filters.status,
      installmentAmountMin: filters.installmentAmountMin ?? undefined,
      installmentAmountMax: filters.installmentAmountMax ?? undefined,
      installmentCountMode: filters.installmentCountMode === "all" ? undefined : filters.installmentCountMode,
      installmentCountValue: filters.installmentCountValue ?? undefined,
      purchaseStart: filters.purchaseStart ?? undefined,
      purchaseEnd: filters.purchaseEnd ?? undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
  );

  return mapInstallmentsOverviewResponse(response);
}

export async function getTransactions(limit?: number) {
  const response = await request<ApiTransactionsResponse>(buildPath("/api/transactions", { limit }));
  return mapTransactionsResponse(response);
}

export async function getCategories() {
  const response = await request<ApiCategoriesResponse>("/api/categories");
  return mapCategoriesResponse(response);
}

export async function getSpending() {
  const response = await request<ApiSpendingResponse>("/api/spending");
  return mapSpendingResponse(response);
}

export async function getInsights() {
  const response = await request<ApiInsightsResponse>("/api/insights");
  return mapInsightsResponse(response);
}

export async function getBanks() {
  const response = await request<ApiBanksResponse>("/api/banks");
  return mapBanksResponse(response);
}

export async function getHousing() {
  const response = await request<ApiHousingResponse>("/api/housing");
  return mapHousingResponse(response);
}

export async function getInvestments() {
  const response = await request<ApiInvestmentsResponse>("/api/investments");
  return mapInvestmentsResponse(response);
}

function buildHousingBody(input: CreateHousingInput) {
  return {
    description: input.description,
    expenseType: input.expenseType,
    amount: input.amount,
    dueDay: input.dueDay,
    startDate: input.startDate,
    bankConnectionId: input.bankConnectionId,
    categoryId: input.categoryId,
    installmentCount: input.installmentCount,
    notes: input.notes,
    status: input.status,
  };
}

function buildInvestmentBody(input: CreateInvestmentInput) {
  return {
    name: input.name,
    description: input.description,
    contributionMode: input.contributionMode,
    fixedAmount: input.fixedAmount,
    incomePercentage: input.incomePercentage,
    currentAmount: input.currentAmount,
    targetAmount: input.targetAmount,
    status: input.status,
    color: input.color,
    notes: input.notes,
    bankConnectionId: input.bankConnectionId,
  };
}

export async function postHousing(input: CreateHousingInput) {
  const response = await request<ApiHousingItem>("/api/housing", {
    method: "POST",
    body: JSON.stringify(buildHousingBody(input)),
  });

  return mapHousingItem(response);
}

export async function postInvestment(input: CreateInvestmentInput) {
  const response = await request<ApiInvestmentItem>("/api/investments", {
    method: "POST",
    body: JSON.stringify(buildInvestmentBody(input)),
  });

  return mapInvestmentItem(response);
}

export async function patchHousing(input: UpdateHousingInput) {
  const response = await request<ApiHousingItem>(`/api/housing/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(buildHousingBody(input)),
  });

  return mapHousingItem(response);
}

export async function patchInvestment(input: UpdateInvestmentInput) {
  const response = await request<ApiInvestmentItem>(`/api/investments/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(buildInvestmentBody(input)),
  });

  return mapInvestmentItem(response);
}

export async function deleteHousing(id: number | string) {
  await request<null>(`/api/housing/${id}`, {
    method: "DELETE",
  });
}

export async function deleteInvestment(id: number | string) {
  await request<null>(`/api/investments/${id}`, {
    method: "DELETE",
  });
}

export async function postBank(input: CreateBankConnectionInput) {
  const response = await request<ApiBank>("/api/banks", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapBank(response);
}

export async function patchBank(input: UpdateBankConnectionInput) {
  const response = await request<ApiBank>(`/api/banks/${input.id}`, {
    method: "PATCH",
      body: JSON.stringify({
        name: input.name,
        accountType: input.accountType,
        currentBalance: input.currentBalance,
        creditLimit: input.creditLimit,
        color: input.color,
        connected: input.connected,
        parentBankConnectionId: input.parentBankConnectionId,
      statementCloseDay: input.statementCloseDay,
      statementDueDay: input.statementDueDay,
    }),
  });

  return mapBank(response);
}

export async function deleteBank(id: number | string) {
  await request<null>(`/api/banks/${id}`, {
    method: "DELETE",
  });
}

export async function getChatMessages(limit?: number) {
  const response = await request<ApiChatMessagesResponse>(buildPath("/api/chat/messages", { limit }));
  return mapChatMessagesResponse(response);
}

export async function postChatMessage(message: string) {
  const response = await request<ApiChatReplyResponse>("/api/chat/messages", {
    method: "POST",
    body: JSON.stringify({ message }),
  });

  return mapChatReplyResponse(response);
}

export async function getChatConversations() {
  const response = await request<ApiChatConversationsResponse>("/api/chats");
  return mapChatConversationsResponse(response);
}

export async function createChatConversation() {
  const response = await request<ApiChatConversationResponse>("/api/chats", {
    method: "POST",
  });

  return mapChatConversationResponse(response);
}

export async function deleteChatConversation(chatId: string) {
  await request<null>(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: "DELETE",
  });
}

export async function patchChatConversation(chatId: string, input: { title?: string; pinned?: boolean }) {
  const response = await request<ApiChatConversationResponse>(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return mapChatConversationResponse(response);
}

export async function searchChatConversations(query: string, limit = 12) {
  const response = await request<ApiChatSearchResponse>(buildPath("/api/chats/search", { q: query, limit }));
  return mapChatSearchResponse(response);
}

export async function getPlans() {
  const response = await request<ApiPlansResponse>("/api/plans");
  return mapPlansResponse(response);
}

export async function getPlan(planId: string) {
  const response = await request<ApiPlanResponse>(`/api/plans/${encodeURIComponent(planId)}`);
  return mapPlanResponse(response);
}

export async function evaluatePlan(planId: string) {
  const response = await request<ApiPlanResponse>(`/api/plans/${encodeURIComponent(planId)}/ai/evaluate`, {
    method: "POST",
  });
  return mapPlanResponse(response);
}

export async function getPlanRecommendations(planId: string) {
  const response = await request<ApiPlanRecommendationsResponse>(
    `/api/plans/${encodeURIComponent(planId)}/recommendations`,
  );
  return mapPlanRecommendationsResponse(response);
}

export async function applyPlanRecommendation(planId: string, recommendationId: number | string) {
  const response = await request<ApiPlanResponse>(
    `/api/plans/${encodeURIComponent(planId)}/recommendations/${encodeURIComponent(String(recommendationId))}/apply`,
    {
      method: "POST",
    },
  );
  return mapPlanResponse(response);
}

export async function postPlan(input: CreatePlanInput) {
  const response = await request<ApiPlanResponse>("/api/plans", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapPlanResponse(response);
}

export async function patchPlan(input: UpdatePlanInput) {
  const response = await request<ApiPlanResponse>(`/api/plans/${encodeURIComponent(input.planId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      goal: input.goal,
      items: input.items,
    }),
  });

  return mapPlanResponse(response);
}

export async function deletePlan(planId: string) {
  await request<null>(`/api/plans/${encodeURIComponent(planId)}`, {
    method: "DELETE",
  });
}

export async function linkChatToPlan(planId: string, chatId: string) {
  const response = await request<ApiPlanResponse>(
    `/api/plans/${encodeURIComponent(planId)}/chats/${encodeURIComponent(chatId)}`,
    {
      method: "POST",
    },
  );

  return mapPlanResponse(response);
}

export async function unlinkChatFromPlan(planId: string, chatId: string) {
  const response = await request<ApiPlanResponse>(
    `/api/plans/${encodeURIComponent(planId)}/chats/${encodeURIComponent(chatId)}`,
    {
      method: "DELETE",
    },
  );

  return mapPlanResponse(response);
}

export async function generatePlanDraft(chatId: string) {
  const response = await request<ApiPlanDraftResponse>("/api/plans/ai/draft", {
    method: "POST",
    body: JSON.stringify({ chatId }),
  });

  return mapPlanDraftResponse(response);
}

export async function createPlanDraftSession(chatId: string) {
  const response = await request<ApiPlanDraftSessionResponse>("/api/plans/ai/draft-session", {
    method: "POST",
    body: JSON.stringify({ chatId }),
  });

  return mapPlanDraftSessionResponse(response);
}

export async function getPlanDraftSession(draftId: string) {
  const response = await request<ApiPlanDraftSessionResponse>(`/api/plan-drafts/${encodeURIComponent(draftId)}`);
  return mapPlanDraftSessionResponse(response);
}

export async function patchPlanDraftSession(draftId: string, draft: PlanDraft) {
  const response = await request<ApiPlanDraftSessionResponse>(`/api/plan-drafts/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    body: JSON.stringify({ draft }),
  });

  return mapPlanDraftSessionResponse(response);
}

export async function revisePlanDraftSession(input: RevisePlanDraftSessionInput) {
  const response = await request<ApiPlanDraftSessionResponse>(
    `/api/plan-drafts/${encodeURIComponent(input.draftId)}/revise`,
    {
      method: "POST",
      body: JSON.stringify({ correction: input.correction }),
    },
  );

  return mapPlanDraftSessionResponse(response);
}

export async function confirmPlanDraftSession(draftId: string) {
  const response = await request<ApiPlanResponse>(`/api/plan-drafts/${encodeURIComponent(draftId)}/confirm`, {
    method: "POST",
  });

  return mapPlanResponse(response);
}

export async function dismissPlanDraftSession(draftId: string) {
  const response = await request<ApiPlanDraftSessionResponse>(`/api/plan-drafts/${encodeURIComponent(draftId)}/dismiss`, {
    method: "POST",
  });

  return mapPlanDraftSessionResponse(response);
}

export async function revisePlanDraft(input: RevisePlanDraftInput) {
  const response = await request<ApiPlanDraftResponse>("/api/plans/ai/revise-draft", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapPlanDraftResponse(response);
}

export async function suggestPlanLink(chatId: string) {
  const response = await request<ApiPlanLinkSuggestionResponse>("/api/plans/ai/suggest-link", {
    method: "POST",
    body: JSON.stringify({ chatId }),
  });

  return mapPlanLinkSuggestionResponse(response);
}

export async function getChatSummary(chatId: string) {
  const response = await request<ApiPlanChatSummaryResponse>(`/api/chats/${encodeURIComponent(chatId)}/summary`);
  return mapPlanChatSummaryResponse(response);
}

export async function postChatSummary(chatId: string) {
  const response = await request<ApiPlanChatSummaryResponse>(`/api/chats/${encodeURIComponent(chatId)}/summary`, {
    method: "POST",
  });
  return mapPlanChatSummaryResponse(response);
}

export async function getChatConversationMessages(chatId: string, limit?: number) {
  const response = await request<ApiChatMessagesResponse>(
    buildPath(`/api/chats/${encodeURIComponent(chatId)}/messages`, { limit }),
  );
  return mapChatMessagesResponse(response);
}

export async function postChatConversationMessage(chatId: string, message: string) {
  const response = await request<ApiChatReplyResponse>(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });

  return mapChatReplyResponse(response);
}

export async function postChatConversationMessages(chatId: string, messages: string[]) {
  const response = await request<ApiChatReplyResponse>(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ messages }),
  });

  return mapChatReplyResponse(response);
}

export async function postCategory(input: CreateCategoryInput) {
  const response = await request<ApiCategory>("/api/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapCategory(response);
}

export async function patchCategory(input: UpdateCategoryInput) {
  const response = await request<ApiCategory>(`/api/categories/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      label: input.label,
      transactionType: input.transactionType,
      icon: input.icon,
      color: input.color,
      groupLabel: input.groupLabel,
      groupColor: input.groupColor,
    }),
  });

  return mapCategory(response);
}

export async function deleteCategory(id: number | string) {
  await request<null>(`/api/categories/${id}`, {
    method: "DELETE",
  });
}

export async function postTransaction(input: CreateTransactionInput) {
  const body = {
    description: input.description,
    amount: input.amount,
    occurredOn: input.occurredOn,
    bankConnectionId: input.bankConnectionId,
    isRecurring: Boolean(input.isRecurring),
    ...(input.categoryId !== undefined && input.categoryId !== null && input.categoryId !== "" ? { categoryId: input.categoryId } : {}),
  };

  const response = await request<ApiTransaction>("/api/transactions", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return mapTransaction(response);
}

export async function patchTransaction(input: UpdateTransactionInput) {
  const body = {
    description: input.description,
    amount: input.amount,
    occurredOn: input.occurredOn,
    bankConnectionId: input.bankConnectionId,
    isRecurring: Boolean(input.isRecurring),
    ...(input.categoryId !== undefined && input.categoryId !== null && input.categoryId !== "" ? { categoryId: input.categoryId } : {}),
  };

  const response = await request<ApiTransaction>(`/api/transactions/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return mapTransaction(response);
}

export async function deleteTransaction(input: DeleteTransactionInput) {
  await request<null>(`/api/transactions/${input.id}`, {
    method: "DELETE",
    body: JSON.stringify({
      ...(input.occurredOn ? { occurredOn: input.occurredOn } : {}),
    }),
  });
}

export async function previewTransactionImport(
  file: File,
  importSource: "bank_statement" | "credit_card_statement",
  bankConnectionId: number | string,
  options: { filePassword?: string } = {},
) {
  const body = new FormData();
  body.set("file", file);

  if (options.filePassword?.trim()) {
    body.set("filePassword", options.filePassword.trim());
  }

  const response = await request<ApiImportPreviewResponse>(
    buildPath("/api/transactions/import/preview", { importSource, bankConnectionId }),
    {
      method: "POST",
      body,
    },
  );

  return mapImportPreviewResponse(response);
}

export async function commitTransactionImport(previewToken: string, items: ImportCommitItem[]) {
  const response = await request<ApiImportCommitResponse>("/api/transactions/import/commit", {
    method: "POST",
    body: JSON.stringify({
      previewToken,
      items,
    }),
  });

  return mapImportCommitResponse(response);
}

export async function getImportAiSuggestions(previewToken: string, rowIndexes?: number[]) {
  const response = await request<ApiImportAiSuggestionsResponse>("/api/transactions/import/ai-suggestions", {
    method: "POST",
    body: JSON.stringify({
      previewToken,
      rowIndexes,
    }),
  });

  return mapImportAiSuggestionsResponse(response);
}
