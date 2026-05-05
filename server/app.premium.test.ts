import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestAuthContext } from "./modules/auth/types.js";

const createChatConversation = vi.fn();
const createChatReply = vi.fn();
const getTransactionImportAiSuggestions = vi.fn();
const getDashboardData = vi.fn();
const listCategories = vi.fn();
const createTransaction = vi.fn();
const listPlans = vi.fn();

const currentAuth = {
  isPremium: false,
};

const noop = vi.fn();

vi.mock("./database.js", () => ({
  applyPlanRecommendation: noop,
  commitTransactionImport: noop,
  confirmPlanAiDraft: noop,
  createBankConnection: noop,
  createCategory: noop,
  createChatConversation,
  createChatReply,
  createHousing: noop,
  createInvestment: noop,
  createOrGetPlanAiDraftSession: noop,
  createPlan: noop,
  createTransaction,
  deleteBankConnection: noop,
  deleteCategory: noop,
  deleteChatConversation: noop,
  deleteHousing: noop,
  deleteInvestment: noop,
  deletePlan: noop,
  deleteTransaction: noop,
  dismissPlanAiDraft: noop,
  evaluatePlanWithAi: noop,
  generatePlanChatSummary: noop,
  generatePlanDraftFromChat: noop,
  getDashboardData,
  getInstallmentsOverview: noop,
  getPlanAiDraft: noop,
  getPlanChatSummary: noop,
  getPlanDetail: noop,
  getTransactionImportAiSuggestions,
  linkChatToPlan: noop,
  listBanks: noop,
  listCategories,
  listChatConversations: noop,
  listChatMessages: noop,
  listHousing: noop,
  listInsights: noop,
  listInvestments: noop,
  listLatestChatMessages: noop,
  listPlanRecommendations: noop,
  listPlans,
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

vi.mock("./modules/auth/routes.js", () => ({
  createAuthRouter: () => express.Router(),
  requireAccessToken: (request: express.Request) => {
    const auth = {
      userId: 42,
      user: {
        id: 42,
        name: "Lucas",
        email: "lucas@example.com",
        emailVerified: true,
        hasCompletedOnboarding: true,
        onboardingProgress: {
          currentStep: 0,
          completedSteps: [],
          skippedSteps: [],
          dismissed: false,
        },
        role: "user",
        status: "active",
        isPremium: currentAuth.isPremium,
        premiumSince: currentAuth.isPremium ? "2026-05-01T00:00:00.000Z" : null,
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
    } satisfies RequestAuthContext;

    (request as express.Request & { auth?: RequestAuthContext }).auth = auth;
    return auth;
  },
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

describe("premium gates", () => {
  beforeEach(() => {
    currentAuth.isPremium = false;
    createChatConversation.mockReset();
    createChatReply.mockReset();
    getTransactionImportAiSuggestions.mockReset();
    getDashboardData.mockReset();
    listCategories.mockReset();
    createTransaction.mockReset();
    listPlans.mockReset();

    createChatConversation.mockResolvedValue({ id: "chat-1", title: "Novo chat", pinned: false });
    createChatReply.mockResolvedValue({
      userMessages: [],
      assistantMessage: {
        id: "assistant-1",
        chatId: "chat-1",
        role: "assistant",
        content: "Resposta",
        createdAt: "2026-05-04T12:00:00.000Z",
      },
      chat: {
        id: "chat-1",
        title: "Novo chat",
        pinned: false,
        createdAt: "2026-05-04T12:00:00.000Z",
        updatedAt: "2026-05-04T12:00:00.000Z",
      },
    });
    getTransactionImportAiSuggestions.mockResolvedValue({ suggestions: [], summary: {} });
    getDashboardData.mockResolvedValue({
      summaryCards: [],
      recentTransactions: [],
      accounts: [],
      insights: [{ id: 1, title: "Premium insight" }],
      chatMessages: [{ id: 1, content: "Premium chat" }],
    });
    listCategories.mockResolvedValue([{ id: 1, label: "Alimentação" }]);
    createTransaction.mockResolvedValue({ id: 10, description: "Mercado" });
    listPlans.mockResolvedValue([
      {
        id: "plan-1",
        title: "Plano",
        description: "",
        source: "manual",
        goal: { type: "items", source: "manual" },
        items: [],
        chats: [{ id: "chat-1", title: "Chat premium" }],
        aiAssessment: { status: "attention" },
      },
    ]);
  });

  it("returns 402 premium_required for free users on chat AI", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app).post("/api/chat/messages").send({ message: "Olá" });

    expect(response.status).toBe(402);
    expect(response.body.error).toBe("premium_required");
    expect(response.body.details).toEqual({ feature: "chat_ai" });
    expect(typeof response.body.requestId).toBe("string");
    expect(createChatConversation).not.toHaveBeenCalled();
  });

  it("allows premium users to call chat AI", async () => {
    currentAuth.isPremium = true;
    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app).post("/api/chat/messages").send({ message: "Olá" });

    expect(response.status).toBe(201);
    expect(createChatConversation).toHaveBeenCalledWith(42);
    expect(createChatReply).toHaveBeenCalled();
  });

  it("returns 402 premium_required for free users on import AI suggestions", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app)
      .post("/api/transactions/import/ai-suggestions")
      .send({ previewToken: "preview-1", rowIndexes: [1] });

    expect(response.status).toBe(402);
    expect(response.body.error).toBe("premium_required");
    expect(response.body.details).toEqual({ feature: "import_ai_suggestions" });
    expect(getTransactionImportAiSuggestions).not.toHaveBeenCalled();
  });

  it("allows premium users to call import AI suggestions", async () => {
    currentAuth.isPremium = true;
    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app)
      .post("/api/transactions/import/ai-suggestions")
      .send({ previewToken: "preview-1", rowIndexes: [1] });

    expect(response.status).toBe(201);
    expect(getTransactionImportAiSuggestions).toHaveBeenCalledWith(42, {
      previewToken: "preview-1",
      rowIndexes: [1],
    });
  });

  it("keeps basic free endpoints available and strips premium plan fields", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    const [dashboardResponse, transactionResponse, categoriesResponse, plansResponse] = await Promise.all([
      request(app).get("/api/dashboard"),
      request(app).post("/api/transactions").send({ description: "Mercado", amount: "10.00" }),
      request(app).get("/api/categories"),
      request(app).get("/api/plans"),
    ]);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.insights).toEqual([]);
    expect(dashboardResponse.body.chatMessages).toEqual([]);

    expect(transactionResponse.status).toBe(201);
    expect(categoriesResponse.status).toBe(200);

    expect(plansResponse.status).toBe(200);
    expect(plansResponse.body.plans[0].aiAssessment).toBeNull();
    expect(plansResponse.body.plans[0].chats).toEqual([]);
  });
});
