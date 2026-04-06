import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { resolveInsightIcon, resolveLucideIcon } from "@/lib/icons";
import type {
  ApiBank,
  ApiBanksResponse,
  ApiChatMessage,
  ApiChatMessagesResponse,
  ApiChatReplyResponse,
  ApiDashboardResponse,
  ApiErrorResponse,
  ApiInsight,
  ApiInsightsResponse,
  ApiSpendingItem,
  ApiSpendingResponse,
  ApiSummaryCard,
  ApiTransaction,
  ApiTransactionsResponse,
  BankItem,
  ChatMessage,
  ChatReply,
  ChatRole,
  DashboardData,
  InsightItem,
  SpendingItem,
  SummaryCard,
  TransactionItem,
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

  if (init?.body && !headers.has("Content-Type")) {
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

export function mapTransaction(transaction: ApiTransaction): TransactionItem {
  const amount = safeNumber(transaction.amount);
  const category = transaction.category ?? {};

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
      slug: safeString(category.slug, "outros"),
      label: safeString(category.label, "Sem categoria"),
      iconName: safeString(category.icon),
      icon: resolveLucideIcon(category.icon),
      color: safeString(category.color, "text-muted-foreground"),
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

export async function getDashboard() {
  const response = await request<ApiDashboardResponse>("/api/dashboard");
  return mapDashboardResponse(response);
}

export async function getTransactions(limit?: number) {
  const response = await request<ApiTransactionsResponse>(buildPath("/api/transactions", { limit }));
  return mapTransactionsResponse(response);
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
