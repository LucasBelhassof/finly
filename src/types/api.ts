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
  accountType?: string;
  parentBankConnectionId?: number | string | null;
  parentAccountName?: string | null;
  statementCloseDay?: number | null;
  statementDueDay?: number | null;
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

export interface ApiInstallmentOverviewFilters {
  cardId?: number | string;
  categoryId?: number | string;
  status?: string;
  installmentAmountMin?: number | null;
  installmentAmountMax?: number | null;
  purchaseStart?: string | null;
  purchaseEnd?: string | null;
  sortBy?: string;
  sortOrder?: string;
}

export interface ApiInstallmentOverviewItem {
  transaction_id?: number | string;
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
  remaining_installments?: number;
  remaining_balance?: number;
  next_due_date?: string | null;
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

export interface ApiChatReplyResponse {
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
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: number | string;
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
}

export interface CreateBankConnectionInput {
  name: string;
  accountType: "bank_account" | "credit_card" | "cash";
  currentBalance: number;
  color: string;
  connected?: boolean;
  parentBankConnectionId?: number | string | null;
  statementCloseDay?: number | null;
  statementDueDay?: number | null;
}

export interface UpdateBankConnectionInput extends CreateBankConnectionInput {
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

export type InstallmentStatus = "active" | "paid" | "overdue";
export type InstallmentSortBy = "smart" | "installment_amount" | "remaining_balance" | "next_due_date" | "purchase_date";
export type InstallmentSortOrder = "asc" | "desc";

export interface InstallmentsOverviewFilters {
  cardId: string;
  categoryId: string;
  status: "all" | InstallmentStatus;
  installmentAmountMin: number | null;
  installmentAmountMax: number | null;
  purchaseStart: string | null;
  purchaseEnd: string | null;
  sortBy: InstallmentSortBy;
  sortOrder: InstallmentSortOrder;
}

export interface InstallmentOverviewItem {
  transactionId: number | string;
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
  remainingInstallments: number;
  remainingBalance: number;
  nextDueDate: string | null;
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
