import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { resolveInsightIcon, resolveLucideIcon } from "@/lib/icons";
import type {
  ApiBank,
  ApiBanksResponse,
  ApiCategoriesResponse,
  ApiCategory,
  ApiChatMessage,
  ApiChatMessagesResponse,
  ApiChatReplyResponse,
  ApiDashboardResponse,
  ApiErrorResponse,
  ApiHealthResponse,
  ApiImportCommitResponse,
  ApiImportAiSuggestionsResponse,
  ApiImportAiSuggestionItem,
  ApiImportPreviewItem,
  ApiImportPreviewResponse,
  ApiInsight,
  ApiInsightsResponse,
  ApiSpendingItem,
  ApiSpendingResponse,
  ApiSummaryCard,
  ApiTransaction,
  ApiTransactionAccount,
  ApiTransactionsResponse,
  BankItem,
  CategoryItem,
  ChatMessage,
  ChatReply,
  ChatRole,
  CreateCategoryInput,
  CreateTransactionInput,
  DashboardData,
  HealthStatus,
  ImportCommitData,
  ImportCommitItem,
  ImportAiSuggestionsData,
  ImportAiSuggestionItem,
  ImportPreviewData,
  ImportPreviewItem,
  InsightItem,
  SpendingItem,
  SummaryCard,
  TransactionAccount,
  TransactionItem,
  UpdateTransactionInput,
} from "@/types/api";

const DEFAULT_API_URL = "http://localhost:3001";
const apiBaseUrl = (import.meta.env.VITE_API_URL?.trim() || DEFAULT_API_URL).replace(/\/$/, "");

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

async function request<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (init?.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(
      safeString(body?.message, safeString(body?.error, "Nao foi possivel concluir a requisicao.")),
      response.status,
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
    description: safeString(card.description, "vs mes anterior"),
    icon: resolveSummaryCardIcon(label),
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
  };
}

export function mapTransaction(transaction: ApiTransaction): TransactionItem {
  const amount = safeNumber(transaction.amount);
  const category = transaction.category ?? {};
  const account = transaction.account ?? {};

  return {
    id: transaction.id ?? `${safeString(transaction.description, "transaction")}-${safeString(transaction.occurredOn, "0")}`,
    description: safeString(transaction.description, "Transacao"),
    amount,
    formattedAmount: safeString(
      transaction.formattedAmount,
      `${amount < 0 ? "- " : "+ "}${formatCurrency(Math.abs(amount))}`,
    ),
    occurredOn: safeString(transaction.occurredOn),
    relativeDate: safeString(transaction.relativeDate, safeString(transaction.occurredOn, "--")),
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

  return {
    id: insight.id ?? safeString(insight.title, "insight"),
    title: safeString(insight.title, "Insight indisponivel"),
    description: safeString(insight.description, "Nao ha detalhes adicionais para este insight."),
    tag: safeString(insight.tag, "IA"),
    tone,
    icon: resolveInsightIcon(tone),
    iconColor: colors.iconColor,
    bgColor: colors.bgColor,
    tagColor: colors.tagColor,
  };
}

export function mapBank(bank: ApiBank): BankItem {
  const currentBalance = safeNumber(bank.currentBalance);

  return {
    id: bank.id ?? safeString(bank.slug, safeString(bank.name, "bank")),
    slug: safeString(bank.slug, "bank"),
    name: safeString(bank.name, "Banco"),
    accountType: bank.accountType === "credit_card" || bank.accountType === "cash" ? bank.accountType : "bank_account",
    connected: Boolean(bank.connected),
    color: safeString(bank.color, "bg-secondary"),
    currentBalance,
    formattedBalance: safeString(bank.formattedBalance, formatCurrency(currentBalance)),
  };
}

export function mapChatMessage(message: ApiChatMessage): ChatMessage {
  return {
    id: message.id ?? `${normalizeChatRole(message.role)}-${safeString(message.createdAt, "0")}`,
    role: normalizeChatRole(message.role),
    content: safeString(message.content, "Sem conteudo"),
    createdAt: safeString(message.createdAt, new Date(0).toISOString()),
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

export function mapChatMessagesResponse(response: ApiChatMessagesResponse) {
  return (response.messages ?? []).map(mapChatMessage);
}

export function mapChatReplyResponse(response: ApiChatReplyResponse): ChatReply {
  return {
    userMessage: mapChatMessage(response.userMessage ?? { role: "user" }),
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
    amount: safeString(item.amount, "0.00"),
    normalizedAmount: safeString(item.normalizedAmount, safeString(item.amount, "0.00")),
    occurredOn: safeString(item.occurredOn),
    normalizedOccurredOn: safeString(item.normalizedOccurredOn, safeString(item.occurredOn)),
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
      name: safeString(response.user?.name, "Joao"),
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

export async function getDashboard() {
  const response = await request<ApiDashboardResponse>("/api/dashboard");
  return mapDashboardResponse(response);
}

export async function getHealth() {
  const response = await request<ApiHealthResponse>("/api/health");
  return mapHealthResponse(response);
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

export async function postCategory(input: CreateCategoryInput) {
  const response = await request<ApiCategory>("/api/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return mapCategory(response);
}

export async function postTransaction(input: CreateTransactionInput) {
  const response = await request<ApiTransaction>("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      description: input.description,
      amount: input.amount,
      occurredOn: input.occurredOn,
      bankConnectionId: input.bankConnectionId,
      categoryId: input.categoryId,
    }),
  });

  return mapTransaction(response);
}

export async function patchTransaction(input: UpdateTransactionInput) {
  const response = await request<ApiTransaction>(`/api/transactions/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      description: input.description,
      amount: input.amount,
      occurredOn: input.occurredOn,
      bankConnectionId: input.bankConnectionId,
      categoryId: input.categoryId,
    }),
  });

  return mapTransaction(response);
}

export async function deleteTransaction(id: number | string) {
  await request<null>(`/api/transactions/${id}`, {
    method: "DELETE",
  });
}

export async function previewTransactionImport(
  file: File,
  importSource: "bank_statement" | "credit_card_statement",
  bankConnectionId: number | string,
) {
  const body = new FormData();
  body.set("file", file);

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
