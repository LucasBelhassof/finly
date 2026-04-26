import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const revisePlanDraftFromChat = vi.fn();
const noop = vi.fn();

vi.mock("./database.js", () => ({
  applyPlanRecommendation: noop,
  commitTransactionImport: noop,
  createBankConnection: noop,
  createCategory: noop,
  createChatConversation: noop,
  createChatReply: noop,
  createHousing: noop,
  createInvestment: noop,
  createPlan: noop,
  createTransaction: noop,
  deleteBankConnection: noop,
  deleteCategory: noop,
  deleteChatConversation: noop,
  deleteHousing: noop,
  deleteInvestment: noop,
  deletePlan: noop,
  deleteTransaction: noop,
  evaluatePlanWithAi: noop,
  generatePlanChatSummary: noop,
  generatePlanDraftFromChat: noop,
  getDashboardData: noop,
  getInstallmentsOverview: noop,
  getPlanChatSummary: noop,
  getPlanDetail: noop,
  getTransactionImportAiSuggestions: noop,
  linkChatToPlan: noop,
  listBanks: noop,
  listCategories: noop,
  listChatConversations: noop,
  listChatMessages: noop,
  listHousing: noop,
  listInvestments: noop,
  listInsights: noop,
  listLatestChatMessages: noop,
  listPlanRecommendations: noop,
  listPlans: noop,
  listSpendingByCategory: noop,
  listTransactions: noop,
  pingDatabase: noop,
  previewTransactionImport: noop,
  revisePlanDraftFromChat,
  searchChatConversations: noop,
  suggestPlanLinkForChat: noop,
  unlinkChatFromPlan: noop,
  updateBankConnection: noop,
  updateCategory: noop,
  updateChatConversation: noop,
  updateHousing: noop,
  updateInvestment: noop,
  updatePlan: noop,
  updateTransaction: noop,
}));

vi.mock("./modules/auth/routes.js", () => ({
  createAuthRouter: () => express.Router(),
  requireAccessToken: (request: express.Request) => {
    request.auth = {
      userId: 42,
      user: {
        id: 42,
        name: "Lucas",
        email: "lucas@example.com",
        emailVerified: true,
        hasCompletedOnboarding: true,
        onboardingProgress: {},
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

vi.mock("./modules/admin/routes.js", () => ({
  createAdminRouter: () => express.Router(),
}));

vi.mock("./modules/notifications/routes.js", () => ({
  createNotificationsRouter: () => express.Router(),
}));

describe("plans AI routes", () => {
  it("validates revise-draft payload", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    expect((await request(app).post("/api/plans/ai/revise-draft").send({})).status).toBe(400);
    expect((await request(app).post("/api/plans/ai/revise-draft").send({ chatId: "chat-1" })).status).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/plans/ai/revise-draft")
          .send({ chatId: "chat-1", draft: { title: "Plano" }, correction: "" })
      ).status,
    ).toBe(400);
  });

  it("returns a revised draft without using the chat message endpoint", async () => {
    revisePlanDraftFromChat.mockResolvedValue({
      title: "Plano revisado",
      description: "",
      goal: { type: "items", source: "ai" },
      items: [],
    });

    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app)
      .post("/api/plans/ai/revise-draft")
      .send({
        chatId: "chat-1",
        draft: { title: "Plano", items: [] },
        correction: "ajuste o foco",
      });

    expect(response.status).toBe(200);
    expect(response.body.draft.title).toBe("Plano revisado");
    expect(revisePlanDraftFromChat).toHaveBeenCalledWith(42, "chat-1", { title: "Plano", items: [] }, "ajuste o foco");
    expect(noop).not.toHaveBeenCalledWith(expect.objectContaining({ content: "ajuste o foco" }));
  });
});
