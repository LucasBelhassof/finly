import type { LucideIcon } from "lucide-react";

export type ChatRole = "assistant" | "user";

export interface ApiUser {
  id?: number | string;
  name?: string;
}

export interface ApiSummaryCard {
  label?: string;
  value?: number;
  formattedValue?: string;
  change?: string;
  positive?: boolean;
  description?: string;
}

export interface ApiTransactionCategory {
  id?: number | string;
  slug?: string;
  label?: string;
  icon?: string;
  color?: string;
}

export interface ApiTransaction {
  id?: number | string;
  description?: string;
  amount?: number;
  formattedAmount?: string;
  occurredOn?: string;
  relativeDate?: string;
  category?: ApiTransactionCategory;
}

export interface ApiCategory {
  id?: number | string;
  slug?: string;
  label?: string;
  icon?: string;
  color?: string;
  groupSlug?: string;
  groupLabel?: string;
  groupColor?: string;
}

export interface ApiSpendingItem {
  slug?: string;
  label?: string;
  color?: string;
  total?: number;
  formattedTotal?: string;
  percentage?: number;
}

export interface ApiInsight {
  id?: number | string;
  title?: string;
  description?: string;
  tag?: string;
  tone?: string;
  iconColor?: string;
  bgColor?: string;
  tagColor?: string;
}

export interface ApiBank {
  id?: number | string;
  slug?: string;
  name?: string;
  connected?: boolean;
  color?: string;
  currentBalance?: number;
  formattedBalance?: string;
}

export interface ApiChatMessage {
  id?: number | string;
  role?: string;
  content?: string;
  createdAt?: string;
}

export interface ApiDashboardResponse {
  user?: ApiUser;
  referenceMonth?: string | null;
  summaryCards?: ApiSummaryCard[];
  recentTransactions?: ApiTransaction[];
  spendingByCategory?: ApiSpendingItem[];
  insights?: ApiInsight[];
  banks?: ApiBank[];
  chatMessages?: ApiChatMessage[];
}

export interface ApiTransactionsResponse {
  transactions?: ApiTransaction[];
}

export interface ApiCategoriesResponse {
  categories?: ApiCategory[];
}

export interface ApiSpendingResponse {
  spending?: ApiSpendingItem[];
}

export interface ApiInsightsResponse {
  insights?: ApiInsight[];
}

export interface ApiBanksResponse {
  banks?: ApiBank[];
}

export interface ApiChatMessagesResponse {
  messages?: ApiChatMessage[];
}

export interface ApiChatReplyResponse {
  userMessage?: ApiChatMessage;
  assistantMessage?: ApiChatMessage;
}

export interface ApiImportPreviewItem {
  rowIndex?: number;
  description?: string;
  normalizedDescription?: string;
  amount?: string;
  normalizedAmount?: string;
  occurredOn?: string;
  normalizedOccurredOn?: string;
  type?: string;
  suggestedCategoryId?: number | string | null;
  suggestedCategoryLabel?: string | null;
  matchedRuleId?: string | null;
  possibleDuplicate?: boolean;
  duplicateReason?: string;
  canImport?: boolean;
  requiresCategorySelection?: boolean;
  requiresUserAction?: boolean;
  warnings?: string[];
  errors?: string[];
  sourceRow?: Record<string, string>;
}

export interface ApiImportPreviewResponse {
  previewToken?: string;
  expiresAt?: string;
  fileSummary?: {
    totalRows?: number;
    importableRows?: number;
    errorRows?: number;
    duplicateRows?: number;
    actionRequiredRows?: number;
  };
  items?: ApiImportPreviewItem[];
}

export interface ApiImportCommitResult {
  rowIndex?: number;
  status?: string;
  reason?: string;
  message?: string;
  transaction?: ApiTransaction;
}

export interface ApiImportCommitResponse {
  importedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  results?: ApiImportCommitResult[];
}

export interface ApiHealthResponse {
  status?: string;
  database?: string;
  serverTime?: string;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
}

export interface SummaryCard {
  label: string;
  value: number;
  formattedValue: string;
  change: string;
  positive: boolean;
  description: string;
  icon: LucideIcon;
}

export interface TransactionCategory {
  id: number | string;
  slug: string;
  label: string;
  iconName: string;
  icon: LucideIcon;
  color: string;
  groupSlug: string;
  groupLabel: string;
  groupColor: string;
}

export interface TransactionItem {
  id: number | string;
  description: string;
  amount: number;
  formattedAmount: string;
  occurredOn: string;
  relativeDate: string;
  category: TransactionCategory;
}

export interface CategoryItem {
  id: number | string;
  slug: string;
  label: string;
  iconName: string;
  icon: LucideIcon;
  color: string;
  groupSlug: string;
  groupLabel: string;
  groupColor: string;
}

export interface CreateCategoryInput {
  label: string;
  icon: string;
  color: string;
  groupLabel: string;
  groupColor: string;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  occurredOn: string;
  categoryId: number | string;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: number | string;
}

export interface ImportPreviewItem {
  rowIndex: number;
  description: string;
  normalizedDescription: string;
  amount: string;
  normalizedAmount: string;
  occurredOn: string;
  normalizedOccurredOn: string;
  type: "income" | "expense";
  suggestedCategoryId: number | string | null;
  suggestedCategoryLabel: string | null;
  matchedRuleId: string | null;
  possibleDuplicate: boolean;
  duplicateReason: string;
  canImport: boolean;
  requiresCategorySelection: boolean;
  requiresUserAction: boolean;
  warnings: string[];
  errors: string[];
  sourceRow?: Record<string, string>;
}

export interface ImportPreviewSummary {
  totalRows: number;
  importableRows: number;
  errorRows: number;
  duplicateRows: number;
  actionRequiredRows: number;
}

export interface ImportPreviewData {
  previewToken: string;
  expiresAt: string;
  fileSummary: ImportPreviewSummary;
  items: ImportPreviewItem[];
}

export interface ImportCommitItem {
  rowIndex: number;
  description: string;
  amount: string;
  occurredOn: string;
  type: "income" | "expense";
  categoryId: number | string;
  exclude: boolean;
  ignoreDuplicate: boolean;
}

export interface ImportCommitResult {
  rowIndex: number;
  status: "imported" | "skipped" | "failed";
  reason: string;
  message: string;
  transaction?: TransactionItem;
}

export interface ImportCommitData {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  results: ImportCommitResult[];
}

export interface SpendingItem {
  slug: string;
  label: string;
  color: string;
  total: number;
  formattedTotal: string;
  percentage: number;
}

export interface InsightItem {
  id: number | string;
  title: string;
  description: string;
  tag: string;
  tone: string;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  tagColor: string;
}

export interface BankItem {
  id: number | string;
  slug: string;
  name: string;
  connected: boolean;
  color: string;
  currentBalance: number;
  formattedBalance: string;
}

export interface ChatMessage {
  id: number | string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatReply {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface HealthStatus {
  status: string;
  database: string;
  serverTime: string;
}

export interface DashboardData {
  user: ApiUser;
  referenceMonth: string | null;
  summaryCards: SummaryCard[];
  recentTransactions: TransactionItem[];
  spendingByCategory: SpendingItem[];
  insights: InsightItem[];
  banks: BankItem[];
  chatMessages: ChatMessage[];
}
