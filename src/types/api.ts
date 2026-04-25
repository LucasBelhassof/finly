import type { LucideIcon } from "lucide-react";

export type ChatRole = "assistant" | "user";

export interface ApiUser {
  id?: number | string;
  name?: string;
  email?: string;
  role?: "user" | "admin";
  status?: "active" | "inactive" | "suspended";
  isPremium?: boolean;
  premiumSince?: string | null;
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

export interface ApiTransactionAccount {
  id?: number | string;
  slug?: string;
  name?: string;
  accountType?: string;
  color?: string;
}

export interface ApiTransaction {
  id?: number | string;
  description?: string;
  amount?: number;
  formattedAmount?: string;
  occurredOn?: string;
  relativeDate?: string;
  isRecurring?: boolean;
  isRecurringProjection?: boolean;
  sourceTransactionId?: number | string;
  housingId?: number | string | null;
  isInstallment?: boolean;
  installmentPurchaseId?: number | string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  purchaseOccurredOn?: string | null;
  category?: ApiTransactionCategory;
  account?: ApiTransactionAccount;
}

export interface ApiCategory {
  id?: number | string;
  slug?: string;
  label?: string;
  transactionType?: string;
  icon?: string;
  color?: string;
  groupSlug?: string;
  groupLabel?: string;
  groupColor?: string;
  isSystem?: boolean;
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
  priority?: string;
  insightType?: string;
  metadata?: Record<string, unknown>;
  action?: {
    kind?: string;
    label?: string;
  } | null;
  iconColor?: string;
  bgColor?: string;
  tagColor?: string;
}

export interface ApiBank {
  id?: number | string;
  slug?: string;
  name?: string;
  accountType?: string;
  parentBankConnectionId?: number | string | null;
  parentAccountName?: string | null;
  statementCloseDay?: number | null;
  statementDueDay?: number | null;
  connected?: boolean;
  color?: string;
  currentBalance?: number;
  formattedBalance?: string;
  creditLimit?: number | null;
  formattedCreditLimit?: string | null;
}

export interface ApiChatMessage {
  id?: number | string;
  chatId?: number | string | null;
  role?: string;
  content?: string;
  provider?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  requestCount?: number | null;
  estimatedCostUsd?: number | null;
  createdAt?: string;
}

export interface ApiChatConversation {
  id?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface DashboardFilters {
  startDate?: string | null;
  endDate?: string | null;
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

export type HousingExpenseType = "rent" | "home_financing" | "electricity" | "water" | "condo" | "vehicle_financing" | "other";

export interface ApiHousingTransaction {
  id?: number | string;
  occurredOn?: string;
  amount?: number;
  installmentNumber?: number | null;
}

export interface ApiHousingItem {
  id?: number | string;
  description?: string;
  expenseType?: string;
  amount?: number;
  formattedAmount?: string;
  dueDay?: number;
  startDate?: string;
  installmentCount?: number | null;
  notes?: string;
  status?: string;
  bank?: ApiTransactionAccount;
  category?: ApiTransactionCategory;
  installmentPurchaseId?: number | string | null;
  transactionIds?: Array<number | string>;
  transactions?: ApiHousingTransaction[];
}

export interface ApiHousingResponse {
  housing?: ApiHousingItem[];
}

export interface ApiInstallmentOverviewFilters {
  cardId?: number | string;
  categoryId?: number | string;
  status?: string;
  installmentAmountMin?: number | null;
  installmentAmountMax?: number | null;
  installmentCountMode?: string;
  installmentCountValue?: number | null;
  purchaseStart?: string | null;
  purchaseEnd?: string | null;
  sortBy?: string;
  sortOrder?: string;
}

export interface ApiInstallmentOverviewItem {
  transaction_id?: number | string;
  installment_transaction_id?: number | string | null;
  installment_purchase_id?: number | string;
  description?: string;
  category?: string;
  category_id?: number | string;
  card_id?: number | string;
  card_name?: string;
  purchase_date?: string;
  total_amount?: number;
  installment_amount?: number;
  installment_count?: number;
  current_installment?: number;
  display_installment_number?: number;
  remaining_installments?: number;
  remaining_balance?: number;
  next_due_date?: string | null;
  installment_due_date?: string | null;
  installment_month?: string | null;
  status?: string;
}

export interface ApiInstallmentsOverviewResponse {
  applied_filters?: ApiInstallmentOverviewFilters;
  active_installments_count?: number;
  monthly_commitment?: number;
  remaining_balance_total?: number;
  original_amount_total?: number;
  payoff_projection_month?: string | null;
  alerts?: {
    concentration?: {
      threshold_ratio?: number;
      triggered?: boolean;
      card_id?: number | string | null;
      card_name?: string | null;
      share_ratio?: number;
      monthly_amount?: number;
    };
  };
  charts?: {
    next_3_months_projection?: Array<{ month?: string; amount?: number }>;
    monthly_commitment_evolution?: Array<{ month?: string; amount?: number }>;
    card_distribution?: Array<{ card_id?: number | string; card_name?: string; amount?: number; share_ratio?: number }>;
    top_categories?: Array<{ category_id?: number | string; category?: string; amount?: number }>;
  };
  filter_options?: {
    cards?: Array<{ id?: number | string; name?: string }>;
    categories?: Array<{ id?: number | string; label?: string }>;
    statuses?: string[];
    installment_count_values?: number[];
    remaining_installment_values?: number[];
    installment_amount_range?: {
      min?: number;
      max?: number;
    };
  };
  items?: ApiInstallmentOverviewItem[];
}

export interface ApiChatMessagesResponse {
  messages?: ApiChatMessage[];
}

export interface ApiChatConversationsResponse {
  chats?: ApiChatConversation[];
}

export interface ApiChatConversationResponse {
  chat?: ApiChatConversation;
}

export interface ApiChatReplyResponse {
  chat?: ApiChatConversation;
  userMessage?: ApiChatMessage;
  assistantMessage?: ApiChatMessage;
}

export interface ApiImportPreviewItem {
  rowIndex?: number;
  description?: string;
  normalizedDescription?: string;
  purchaseDescriptionBase?: string | null;
  normalizedPurchaseDescriptionBase?: string | null;
  amount?: string;
  normalizedAmount?: string;
  occurredOn?: string;
  normalizedOccurredOn?: string;
  purchaseOccurredOn?: string | null;
  isInstallment?: boolean;
  installmentIndex?: number | null;
  installmentCount?: number | null;
  generatedInstallmentCount?: number | null;
  type?: string;
  bankConnectionId?: number | string | null;
  bankConnectionName?: string | null;
  suggestedCategoryId?: number | string | null;
  suggestedCategoryLabel?: string | null;
  suggestionSource?: string | null;
  importSource?: string | null;
  matchedRuleId?: string | null;
  aiSuggestedType?: string | null;
  aiSuggestedCategoryId?: number | string | null;
  aiSuggestedCategoryLabel?: string | null;
  aiConfidence?: number | null;
  aiReason?: string | null;
  aiStatus?: string | null;
  possibleDuplicate?: boolean;
  duplicateReason?: string;
  canImport?: boolean;
  requiresCategorySelection?: boolean;
  requiresUserAction?: boolean;
  defaultExclude?: boolean;
  warnings?: string[];
  errors?: string[];
  sourceRow?: Record<string, string>;
}

export interface ApiImportAiSuggestionItem {
  rowIndex?: number;
  aiSuggestedType?: string | null;
  aiSuggestedCategoryId?: number | string | null;
  aiSuggestedCategoryLabel?: string | null;
  aiConfidence?: number | null;
  aiReason?: string | null;
  aiStatus?: string | null;
  suggestionSource?: string | null;
}

export interface ApiImportAiSuggestionsResponse {
  previewToken?: string;
  status?: string;
  autoApplyThreshold?: number;
  summary?: {
    requestedRows?: number;
    suggestedRows?: number;
    noMatchRows?: number;
    failedRows?: number;
  };
  items?: ApiImportAiSuggestionItem[];
}

export interface ApiImportPreviewResponse {
  previewToken?: string;
  expiresAt?: string;
  importSource?: string;
  bankConnectionId?: number | string | null;
  bankConnectionName?: string | null;
  fileMetadata?: {
    originalFilename?: string | null;
    issuerName?: string | null;
    statementDueDate?: string | null;
    statementReferenceMonth?: string | null;
  };
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
  details?: unknown;
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
  isRecurring?: boolean;
  isRecurringProjection?: boolean;
  sourceTransactionId?: number | string;
  housingId: number | string | null;
  isInstallment: boolean;
  installmentPurchaseId: number | string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  purchaseOccurredOn: string | null;
  category: TransactionCategory;
  account: TransactionAccount;
}

export interface CategoryItem {
  id: number | string;
  slug: string;
  label: string;
  transactionType: "income" | "expense";
  iconName: string;
  icon: LucideIcon;
  color: string;
  groupSlug: string;
  groupLabel: string;
  groupColor: string;
  isSystem?: boolean;
}

export interface CreateCategoryInput {
  label: string;
  transactionType: "income" | "expense";
  icon: string;
  color: string;
  groupLabel: string;
  groupColor: string;
}

export interface UpdateCategoryInput extends CreateCategoryInput {
  id: number | string;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  occurredOn: string;
  categoryId?: number | string;
  bankConnectionId: number | string;
  isRecurring?: boolean;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: number | string;
}

export interface DeleteTransactionInput {
  id: number | string;
  occurredOn?: string;
}

export interface ImportPreviewItem {
  rowIndex: number;
  description: string;
  normalizedDescription: string;
  purchaseDescriptionBase: string | null;
  normalizedPurchaseDescriptionBase: string | null;
  amount: string;
  normalizedAmount: string;
  occurredOn: string;
  normalizedOccurredOn: string;
  purchaseOccurredOn: string | null;
  isInstallment: boolean;
  installmentIndex: number | null;
  installmentCount: number | null;
  generatedInstallmentCount: number | null;
  type: "income" | "expense";
  suggestedCategoryId: number | string | null;
  suggestedCategoryLabel: string | null;
  suggestionSource: "rule" | "history" | "recurring_rule" | "ai" | null;
  importSource: "bank_statement" | "credit_card_statement";
  bankConnectionId: number | string;
  bankConnectionName: string;
  matchedRuleId: string | null;
  aiSuggestedType: "income" | "expense" | null;
  aiSuggestedCategoryId: number | string | null;
  aiSuggestedCategoryLabel: string | null;
  aiConfidence: number | null;
  aiReason: string | null;
  aiStatus: "idle" | "suggested" | "no_match" | "error" | "invalid";
  possibleDuplicate: boolean;
  duplicateReason: string;
  canImport: boolean;
  requiresCategorySelection: boolean;
  requiresUserAction: boolean;
  defaultExclude: boolean;
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
  importSource: "bank_statement" | "credit_card_statement";
  bankConnectionId: number | string;
  bankConnectionName: string;
  fileMetadata: {
    originalFilename: string | null;
    issuerName: string | null;
    statementDueDate: string | null;
    statementReferenceMonth: string | null;
  };
  fileSummary: ImportPreviewSummary;
  items: ImportPreviewItem[];
}

export interface ImportAiSuggestionItem {
  rowIndex: number;
  aiSuggestedType: "income" | "expense" | null;
  aiSuggestedCategoryId: number | string | null;
  aiSuggestedCategoryLabel: string | null;
  aiConfidence: number | null;
  aiReason: string | null;
  aiStatus: "idle" | "suggested" | "no_match" | "error" | "invalid";
  suggestionSource: "ai" | null;
}

export interface ImportAiSuggestionsData {
  previewToken: string;
  status: "completed" | "disabled";
  autoApplyThreshold: number;
  summary: {
    requestedRows: number;
    suggestedRows: number;
    noMatchRows: number;
    failedRows: number;
  };
  items: ImportAiSuggestionItem[];
}

export interface ImportCommitItem {
  rowIndex: number;
  description: string;
  amount: string;
  occurredOn: string;
  type: "income" | "expense";
  categoryId?: number | string;
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
  priority: "high" | "medium" | "low";
  priorityLabel: string;
  toneLabel: string;
  insightType: string;
  metadata: Record<string, unknown>;
  action: {
    kind: string;
    label: string;
    href: string | null;
  } | null;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  tagColor: string;
}

export interface BankItem {
  id: number | string;
  slug: string;
  name: string;
  accountType: "bank_account" | "credit_card" | "cash";
  parentBankConnectionId: number | string | null;
  parentAccountName: string | null;
  statementCloseDay: number | null;
  statementDueDay: number | null;
  connected: boolean;
  color: string;
  currentBalance: number;
  formattedBalance: string;
  creditLimit: number | null;
  formattedCreditLimit: string | null;
}

export interface CreateBankConnectionInput {
  name: string;
  accountType: "bank_account" | "credit_card" | "cash";
  currentBalance: number;
  creditLimit?: number | null;
  color: string;
  connected?: boolean;
  parentBankConnectionId?: number | string | null;
  statementCloseDay?: number | null;
  statementDueDay?: number | null;
}

export interface UpdateBankConnectionInput extends CreateBankConnectionInput {
  id: number | string;
}

export interface HousingTransaction {
  id: number | string;
  occurredOn: string;
  amount: number;
  installmentNumber: number | null;
}

export interface HousingItem {
  id: number | string;
  description: string;
  expenseType: HousingExpenseType;
  amount: number;
  formattedAmount: string;
  dueDay: number;
  startDate: string;
  installmentCount: number | null;
  notes: string;
  status: "active" | "inactive";
  bank: TransactionAccount;
  category: TransactionCategory;
  installmentPurchaseId: number | string | null;
  transactionIds: Array<number | string>;
  transactions: HousingTransaction[];
}

export interface CreateHousingInput {
  description: string;
  expenseType: HousingExpenseType;
  amount: number;
  dueDay: number;
  startDate: string;
  bankConnectionId: number | string;
  categoryId?: number | string;
  installmentCount?: number | null;
  notes?: string;
  status?: "active" | "inactive";
}

export interface UpdateHousingInput extends CreateHousingInput {
  id: number | string;
}

export interface TransactionAccount {
  id: number | string;
  slug: string;
  name: string;
  accountType: "bank_account" | "credit_card" | "cash";
  color: string;
}

export interface ChatMessage {
  id: number | string;
  chatId?: number | string | null;
  role: ChatRole;
  content: string;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  requestCount: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatReply {
  chat?: ChatConversation | null;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface HealthStatus {
  status: string;
  database: string;
  serverTime: string;
}

export type InstallmentStatus = "active" | "paid" | "overdue";
export type InstallmentSortBy = "smart" | "installment_amount" | "remaining_balance" | "next_due_date" | "purchase_date";
export type InstallmentSortOrder = "asc" | "desc";
export type InstallmentCountMode = "all" | "installment_count" | "remaining_installments";

export interface InstallmentsOverviewFilters {
  cardId: string;
  categoryId: string;
  status: "all" | InstallmentStatus;
  installmentAmountMin: number | null;
  installmentAmountMax: number | null;
  installmentCountMode: InstallmentCountMode;
  installmentCountValue: number | null;
  purchaseStart: string | null;
  purchaseEnd: string | null;
  sortBy: InstallmentSortBy;
  sortOrder: InstallmentSortOrder;
}

export interface InstallmentOverviewItem {
  transactionId: number | string;
  installmentTransactionId: number | string | null;
  installmentPurchaseId: number | string;
  description: string;
  category: string;
  categoryId: number | string;
  cardId: number | string;
  cardName: string;
  purchaseDate: string;
  totalAmount: number;
  installmentAmount: number;
  installmentCount: number;
  currentInstallment: number;
  displayInstallmentNumber: number;
  remainingInstallments: number;
  remainingBalance: number;
  nextDueDate: string | null;
  installmentDueDate: string | null;
  installmentMonth: string | null;
  status: InstallmentStatus;
}

export interface InstallmentsOverview {
  appliedFilters: InstallmentsOverviewFilters;
  activeInstallmentsCount: number;
  monthlyCommitment: number;
  remainingBalanceTotal: number;
  originalAmountTotal: number;
  payoffProjectionMonth: string | null;
  alerts: {
    concentration: {
      thresholdRatio: number;
      triggered: boolean;
      cardId: number | string | null;
      cardName: string | null;
      shareRatio: number;
      monthlyAmount: number;
    };
  };
  charts: {
    next3MonthsProjection: Array<{ month: string; amount: number }>;
    monthlyCommitmentEvolution: Array<{ month: string; amount: number }>;
    cardDistribution: Array<{ cardId: number | string; cardName: string; amount: number; shareRatio: number }>;
    topCategories: Array<{ categoryId: number | string; category: string; amount: number }>;
  };
  filterOptions: {
    cards: Array<{ id: number | string; name: string }>;
    categories: Array<{ id: number | string; label: string }>;
    statuses: InstallmentStatus[];
    installmentCountValues: number[];
    remainingInstallmentValues: number[];
    installmentAmountRange: {
      min: number;
      max: number;
    };
  };
  items: InstallmentOverviewItem[];
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

export interface ApiAdminOverviewResponse {
  totals?: {
    totalUsers?: number;
    activeUsers?: number;
    premiumUsers?: number;
    freeUsers?: number;
    usersOnlineNow?: number;
    activeSessions?: number;
    totalTransactions?: number;
    aggregateBalance?: number;
  };
  period?: {
    startDate?: string;
    endDate?: string;
  };
  signups?: Array<{
    date?: string;
    total?: number;
  }>;
}

export interface ApiAdminFinancialMetricsResponse {
  period?: {
    startDate?: string;
    endDate?: string;
  };
  summary?: {
    totalIncome?: number;
    totalExpenses?: number;
    aggregateBalance?: number;
    averageTicketPerUser?: number;
    transactionCount?: number;
  };
  monthlySeries?: Array<{
    month?: string;
    income?: number;
    expenses?: number;
    volume?: number;
    transactions?: number;
  }>;
  topUsers?: Array<{
    id?: number | string;
    name?: string;
    email?: string;
    transactionCount?: number;
    transactedVolume?: number;
  }>;
}

export interface ApiAdminSubscriptionMetricsResponse {
  period?: {
    startDate?: string;
    endDate?: string;
  };
  summary?: {
    totalUsers?: number;
    premiumUsers?: number;
    freeUsers?: number;
    conversionRate?: number;
    estimatedSubscriptionRevenue?: number;
    estimatedMrr?: number;
  };
  evolution?: Array<{
    month?: string;
    premiumActivations?: number;
  }>;
}

export interface ApiAdminActivityResponse {
  events?: Array<{
    id?: number | string;
    eventType?: string;
    success?: boolean;
    createdAt?: string;
    email?: string | null;
    user?: {
      id?: number | string;
      name?: string;
      role?: "user" | "admin";
    } | null;
  }>;
}

export interface ApiAdminUsersResponse {
  page?: number;
  pageSize?: number;
  total?: number;
  users?: Array<{
    id?: number | string;
    name?: string;
    email?: string;
    role?: "user" | "admin";
    status?: "active" | "inactive" | "suspended";
    isPremium?: boolean;
    createdAt?: string;
    premiumSince?: string | null;
    lastSessionAt?: string | null;
    transactionCount?: number;
    netTotal?: number;
  }>;
}

export interface AdminOverviewData {
  totals: {
    totalUsers: number;
    activeUsers: number;
    premiumUsers: number;
    freeUsers: number;
    usersOnlineNow: number;
    activeSessions: number;
    totalTransactions: number;
    aggregateBalance: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  signups: Array<{
    date: string;
    total: number;
  }>;
}

export interface AdminFinancialMetricsData {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    aggregateBalance: number;
    averageTicketPerUser: number;
    transactionCount: number;
  };
  monthlySeries: Array<{
    month: string;
    income: number;
    expenses: number;
    volume: number;
    transactions: number;
  }>;
  topUsers: Array<{
    id: number | string;
    name: string;
    email: string;
    transactionCount: number;
    transactedVolume: number;
  }>;
}

export interface AdminSubscriptionMetricsData {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalUsers: number;
    premiumUsers: number;
    freeUsers: number;
    conversionRate: number;
    estimatedSubscriptionRevenue: number;
    estimatedMrr: number;
  };
  evolution: Array<{
    month: string;
    premiumActivations: number;
  }>;
}

export interface AdminActivityData {
  events: Array<{
    id: number | string;
    eventType: string;
    success: boolean;
    createdAt: string;
    email: string | null;
    user: {
      id: number | string;
      name: string;
      role: "user" | "admin";
    } | null;
  }>;
}

export interface AdminUsersData {
  page: number;
  pageSize: number;
  total: number;
  users: Array<{
    id: number | string;
    name: string;
    email: string;
    role: "user" | "admin";
    status: "active" | "inactive" | "suspended";
    isPremium: boolean;
    createdAt: string;
    premiumSince: string | null;
    lastSessionAt: string | null;
    transactionCount: number;
    netTotal: number;
  }>;
}

export type NotificationCategory =
  | "general"
  | "invoice_due"
  | "financing_due"
  | "installment_due"
  | "housing_due"
  | "custom";

export type NotificationStatusFilter = "all" | "read" | "unread";
export type NotificationSourceFilter = "all" | "system" | "user";

export interface ApiNotificationItem {
  recipientId?: number | string;
  notificationId?: number | string;
  title?: string;
  message?: string;
  category?: NotificationCategory;
  source?: "user_self" | "admin_all" | "admin_selected";
  triggerAt?: string | null;
  createdAt?: string;
  isRead?: boolean;
  readAt?: string | null;
  createdBy?: {
    id?: number | string;
    name?: string;
  } | null;
}

export interface ApiNotificationsResponse {
  unreadCount?: number;
  notifications?: ApiNotificationItem[];
}

export interface NotificationsFilters {
  limit?: number;
  status?: NotificationStatusFilter;
  source?: NotificationSourceFilter;
  startDate?: string | null;
  endDate?: string | null;
}

export interface NotificationItem {
  recipientId: number | string;
  notificationId: number | string;
  title: string;
  message: string;
  category: NotificationCategory;
  source: "user_self" | "admin_all" | "admin_selected";
  triggerAt: string | null;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  createdBy: {
    id: number | string;
    name: string;
  } | null;
}

export interface NotificationsData {
  unreadCount: number;
  notifications: NotificationItem[];
}

export interface CreateSelfNotificationInput {
  title: string;
  message: string;
  category: NotificationCategory;
  triggerAt?: string | null;
}

export interface ApiAdminNotificationTarget {
  id?: number | string;
  name?: string;
  email?: string;
  status?: "active" | "inactive" | "suspended";
  isPremium?: boolean;
}

export interface ApiAdminNotificationTargetsResponse {
  users?: ApiAdminNotificationTarget[];
}

export interface AdminNotificationTarget {
  id: number | string;
  name: string;
  email: string;
  status: "active" | "inactive" | "suspended";
  isPremium: boolean;
}

export interface AdminNotificationTargetsData {
  users: AdminNotificationTarget[];
}

export interface ApiAdminNotificationSummary {
  id?: number | string;
  title?: string;
  message?: string;
  category?: NotificationCategory;
  source?: "admin_all" | "admin_selected";
  audience?: "all" | "premium" | "non_premium" | "selected";
  triggerAt?: string | null;
  createdAt?: string;
  recipientsCount?: number;
  readCount?: number;
}

export interface ApiAdminNotificationsResponse {
  notifications?: ApiAdminNotificationSummary[];
}

export interface AdminNotificationSummary {
  id: number | string;
  title: string;
  message: string;
  category: NotificationCategory;
  source: "admin_all" | "admin_selected";
  audience: "all" | "premium" | "non_premium" | "selected";
  triggerAt: string | null;
  createdAt: string;
  recipientsCount: number;
  readCount: number;
}

export interface AdminNotificationsData {
  notifications: AdminNotificationSummary[];
}

export interface CreateAdminNotificationInput {
  title: string;
  message: string;
  category: NotificationCategory;
  triggerAt?: string | null;
  target: {
    mode: "all" | "selected";
    audience?: "all" | "premium" | "non_premium";
    userIds?: Array<number | string>;
  };
}
