export interface TransactionExportRow {
  date: string;
  description: string;
  amount: string;
  type: string;
  category: string;
  account: string | null;
  createdAt: string;
}

export interface ProfileExport {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  isPremium: boolean;
  premiumSince: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
}

export interface FullAccountExport {
  exportedAt: string;
  formatVersion: "1";
  profile: ProfileExport;
  bankConnections: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  housing: Record<string, unknown>[];
  installmentPurchases: Record<string, unknown>[];
  monthlySummaries: Record<string, unknown>[];
  insights: Record<string, unknown>[];
  investments: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  chatConversations: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  aiUsageEvents: Record<string, unknown>[];
}

export interface DeleteAccountInput {
  currentPassword: string;
}

export interface UserForPasswordVerification {
  id: number;
  email: string | null;
  passwordHash: string | null;
}
