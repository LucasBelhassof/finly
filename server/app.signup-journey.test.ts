import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CATEGORY_DEFINITIONS } from "./default-categories.js";
import type { RequestAuthContext } from "./modules/auth/types.js";

// ---------------------------------------------------------------------------
// Stateful in-memory store shared across mocks within a test run
// ---------------------------------------------------------------------------

let userIdCounter = 0;
const tokenToUserId = new Map<string, number>();
const userCategories = new Map<
  number,
  Array<{
    id: number;
    slug: string;
    label: string;
    transactionType: string;
    icon: string;
    color: string;
    groupSlug: string;
    groupLabel: string;
    groupColor: string;
    isSystem: boolean;
  }>
>();
const userBanks = new Map<number, Array<{ id: number; name: string; accountType: string }>>();
const userTransactions = new Map<
  number,
  Array<{ id: number; description: string; amount: number; categoryId: number; bankConnectionId: number }>
>();

let categoryIdCounter = 0;
let bankIdCounter = 0;
let transactionIdCounter = 0;

function resetStore() {
  userIdCounter = 0;
  tokenToUserId.clear();
  userCategories.clear();
  userBanks.clear();
  userTransactions.clear();
  categoryIdCounter = 0;
  bankIdCounter = 0;
  transactionIdCounter = 0;
}

function seedDefaultCategories(userId: number) {
  const cats = DEFAULT_CATEGORY_DEFINITIONS.map((def) => ({
    id: ++categoryIdCounter,
    slug: def.slug,
    label: def.label,
    transactionType: def.transactionType,
    icon: def.icon,
    color: def.color,
    groupSlug: def.groupSlug,
    groupLabel: def.groupLabel,
    groupColor: def.groupColor,
    isSystem: true,
  }));
  userCategories.set(userId, cats);
}

// ---------------------------------------------------------------------------
// Mock: auth routes — provides a working /signup and token-aware requireAccessToken
// ---------------------------------------------------------------------------

vi.mock("./modules/auth/routes.js", () => ({
  createAuthRouter: () => {
    const router = express.Router();

    router.post("/signup", (req, res) => {
      const { name, email, password } = req.body ?? {};
      if (!name || !email || !password) {
        res.status(400).json({ error: "missing_fields" });
        return;
      }
      const userId = ++userIdCounter;
      const accessToken = `fake-jwt-${userId}`;
      tokenToUserId.set(accessToken, userId);
      seedDefaultCategories(userId);
      res.status(201).json({
        user: { id: userId, name, email, emailVerified: false },
        accessToken,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    });

    return router;
  },

  requireAccessToken: (req: express.Request) => {
    const authHeader = req.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const userId = tokenToUserId.get(token);
    if (!userId) {
      (req as express.Request & { auth?: RequestAuthContext }).auth = undefined;
      return;
    }
    (req as express.Request & { auth?: RequestAuthContext }).auth = {
      userId,
      user: {
        id: userId,
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
        hasCompletedOnboarding: false,
        onboardingProgress: { currentStep: 0, completedSteps: [], skippedSteps: [], dismissed: false },
        role: "user",
        status: "active",
        isPremium: false,
        premiumSince: null,
        phone: null,
        addressStreet: null,
        addressNumber: null,
        addressComplement: null,
        addressNeighborhood: null,
        addressCity: null,
        addressState: null,
        addressPostalCode: null,
        addressCountry: null,
      },
    };
  },
}));

// ---------------------------------------------------------------------------
// Mock: database — stateful in-memory implementations for journey functions
// ---------------------------------------------------------------------------

const noop = vi.fn();

vi.mock("./database.js", () => ({
  applyPlanRecommendation: noop,
  commitTransactionImport: noop,
  createBankConnection: vi.fn(async (userId: number, input: Record<string, unknown>) => {
    const bank = {
      id: ++bankIdCounter,
      name: String(input.name ?? ""),
      accountType: String(input.accountType ?? "checking"),
    };
    const existing = userBanks.get(userId) ?? [];
    userBanks.set(userId, [...existing, bank]);
    return bank;
  }),
  createCategory: vi.fn(async (userId: number, input: Record<string, unknown>) => {
    const category = {
      id: ++categoryIdCounter,
      slug: String(input.label ?? "")
        .toLowerCase()
        .replace(/\s+/g, "-"),
      label: String(input.label ?? ""),
      transactionType: String(input.transactionType ?? "expense"),
      icon: String(input.icon ?? ""),
      color: String(input.color ?? ""),
      groupSlug: String(input.groupLabel ?? "")
        .toLowerCase()
        .replace(/\s+/g, "-"),
      groupLabel: String(input.groupLabel ?? ""),
      groupColor: String(input.groupColor ?? ""),
      isSystem: false,
    };
    const existing = userCategories.get(userId) ?? [];
    userCategories.set(userId, [...existing, category]);
    return category;
  }),
  createChatConversation: noop,
  createChatReply: noop,
  createHousing: noop,
  createInvestment: noop,
  createOrGetPlanAiDraftSession: noop,
  createPlan: noop,
  createTransaction: vi.fn(async (userId: number, input: Record<string, unknown>) => {
    const categoryId = Number(input.categoryId);
    const bankConnectionId = Number(input.bankConnectionId);
    const amount = Number(input.amount);

    const cats = userCategories.get(userId) ?? [];
    const category = cats.find((c) => c.id === categoryId);

    if (!category) {
      const err = Object.assign(new Error("Categoria nao encontrada."), { status: 404, code: "category_not_found" });
      throw err;
    }

    const banks = userBanks.get(userId) ?? [];
    const bank = banks.find((b) => b.id === bankConnectionId);

    if (!bank) {
      const err = Object.assign(new Error("Conta nao encontrada."), { status: 404, code: "bank_connection_not_found" });
      throw err;
    }

    const transaction = {
      id: ++transactionIdCounter,
      description: String(input.description ?? ""),
      amount,
      occurredOn: String(input.occurredOn ?? ""),
      category: { id: category.id, label: category.label },
      account: { id: bank.id, name: bank.name },
    };

    const existing = userTransactions.get(userId) ?? [];
    userTransactions.set(userId, [...existing, transaction]);
    return transaction;
  }),
  deleteBankConnection: noop,
  deleteCategory: noop,
  deleteChatConversation: noop,
  deleteHousing: noop,
  deleteInvestment: noop,
  deletePlan: noop,
  deleteTransaction: noop,
  dismissPlanAiDraft: noop,
  evaluatePlanWithAi: noop,
  confirmPlanAiDraft: noop,
  generatePlanChatSummary: noop,
  generatePlanDraftFromChat: noop,
  getDashboardData: noop,
  getInstallmentsOverview: noop,
  getPlanAiDraft: noop,
  getPlanChatSummary: noop,
  getPlanDetail: noop,
  getTransactionImportAiSuggestions: noop,
  linkChatToPlan: noop,
  listBanks: noop,
  listCategories: vi.fn(async (userId: number) => {
    return userCategories.get(userId) ?? [];
  }),
  listChatConversations: noop,
  listChatMessages: noop,
  listHousing: noop,
  listInsights: noop,
  listInvestments: noop,
  listLatestChatMessages: noop,
  listPlanRecommendations: noop,
  listPlans: noop,
  listSpendingByCategory: noop,
  listTransactions: noop,
  pingDatabase: noop,
  previewTransactionImport: noop,
  revisePlanAiDraft: noop,
  revisePlanDraftFromChat: noop,
  searchChatConversations: noop,
  suggestPlanLinkForChat: noop,
  unlinkChatFromPlan: noop,
  updateBankConnection: noop,
  updateCategory: noop,
  updateChatConversation: noop,
  updateHousing: noop,
  updateInvestment: noop,
  updatePlan: noop,
  updatePlanAiDraft: noop,
  updateTransaction: noop,
}));

vi.mock("./modules/admin/routes.js", () => ({
  createAdminRouter: () => express.Router(),
}));

vi.mock("./modules/notifications/routes.js", () => ({
  createNotificationsRouter: () => express.Router(),
}));

vi.mock("./modules/invoices/routes.js", () => ({
  createInvoicesRouter: () => express.Router(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("signup full journey", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("covers the complete journey: signup → default categories → bank → custom category → transaction", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    // 1. Signup
    const signupResponse = await request(app).post("/api/auth/signup").send({
      name: "MVP User",
      email: "mvp-user@example.com",
      password: "SenhaForte123!",
      rememberMe: false,
    });
    expect(signupResponse.status).toBe(201);
    const { accessToken } = signupResponse.body;
    expect(typeof accessToken).toBe("string");

    const auth = { Authorization: `Bearer ${accessToken}` };

    // 2. Default categories were seeded on signup
    const categoriesResponse = await request(app).get("/api/categories").set(auth);
    expect(categoriesResponse.status).toBe(200);

    const categories: Array<{ transactionType: string }> = categoriesResponse.body.categories;
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.some((c) => c.transactionType === "expense")).toBe(true);
    expect(categories.some((c) => c.transactionType === "income")).toBe(true);

    // 3. Create bank account
    const bankResponse = await request(app).post("/api/banks").set(auth).send({
      name: "Conta MVP",
      accountType: "checking",
    });
    expect(bankResponse.status).toBe(201);
    const bankId: number = bankResponse.body.id;
    expect(typeof bankId).toBe("number");

    // 4. Create custom category
    const categoryResponse = await request(app).post("/api/categories").set(auth).send({
      label: "Viagens MVP",
      transactionType: "expense",
      icon: "Plane",
      color: "#38bdf8",
      groupLabel: "Lazer",
      groupColor: "#38bdf8",
    });
    expect(categoryResponse.status).toBe(201);
    const customCategory = categoryResponse.body;
    expect(typeof customCategory.id).toBe("number");
    expect(customCategory.isSystem).toBe(false);
    const customCategoryId: number = customCategory.id;

    // 5. Create transaction using bank + custom category
    const transactionResponse = await request(app).post("/api/transactions").set(auth).send({
      description: "Hotel MVP",
      amount: -450,
      occurredOn: "2026-05-04",
      bankConnectionId: bankId,
      categoryId: customCategoryId,
    });
    expect(transactionResponse.status).toBe(201);
    const transaction = transactionResponse.body;
    expect(transaction.category.id).toBe(customCategoryId);
    expect(transaction.account.id).toBe(bankId);
    expect(transaction.amount).toBe(-450);
  });

  it("returns 404 when transaction uses a non-existent categoryId", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    // Signup first to get a valid token and bank
    const signupResponse = await request(app).post("/api/auth/signup").send({
      name: "MVP User",
      email: "mvp-user@example.com",
      password: "SenhaForte123!",
      rememberMe: false,
    });
    expect(signupResponse.status).toBe(201);
    const { accessToken } = signupResponse.body;

    const auth = { Authorization: `Bearer ${accessToken}` };

    const bankResponse = await request(app).post("/api/banks").set(auth).send({
      name: "Conta MVP",
      accountType: "checking",
    });
    expect(bankResponse.status).toBe(201);
    const bankId: number = bankResponse.body.id;

    // Attempt transaction with non-existent categoryId
    const transactionResponse = await request(app).post("/api/transactions").set(auth).send({
      description: "Hotel MVP",
      amount: -450,
      occurredOn: "2026-05-04",
      bankConnectionId: bankId,
      categoryId: 9999,
    });
    expect(transactionResponse.status).toBe(404);
  });
});
