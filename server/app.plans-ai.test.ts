import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { RequestAuthContext } from "./modules/auth/types.js";

const revisePlanDraftFromChat = vi.fn();
const createOrGetPlanAiDraftSession = vi.fn();
const getPlanAiDraft = vi.fn();
const updatePlanAiDraft = vi.fn();
const revisePlanAiDraft = vi.fn();
const confirmPlanAiDraft = vi.fn();
const dismissPlanAiDraft = vi.fn();
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
  createOrGetPlanAiDraftSession,
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
  getPlanAiDraft,
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
  confirmPlanAiDraft,
  dismissPlanAiDraft,
  revisePlanAiDraft,
  revisePlanDraftFromChat,
  searchChatConversations: noop,
  suggestPlanLinkForChat: noop,
  unlinkChatFromPlan: noop,
  updateBankConnection: noop,
  updateCategory: noop,
  updateChatConversation: noop,
  updateHousing: noop,
  updateInvestment: noop,
  updatePlanAiDraft,
  updatePlan: noop,
  updateTransaction: noop,
}));

vi.mock("./modules/auth/routes.js", () => ({
  createAuthRouter: () => express.Router(),
  requireAccessToken: (request: express.Request) => {
    (request as express.Request & { auth?: RequestAuthContext }).auth = {
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
        isPremium: true,
        premiumSince: "2026-05-01T00:00:00.000Z",
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
  it("creates or returns a persistent draft session for a chat", async () => {
    createOrGetPlanAiDraftSession.mockResolvedValue({
      id: "draft-1",
      chatId: "chat-1",
      assistantMessageId: 7,
      draft: { title: "Plano", items: [] },
      revisionMessages: [],
      status: "pending",
      createdAt: "2026-04-26T10:00:00.000Z",
      updatedAt: "2026-04-26T10:00:00.000Z",
      resolvedAt: null,
    });

    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app).post("/api/plans/ai/draft-session").send({ chatId: "chat-1" });

    expect(response.status).toBe(201);
    expect(response.body.draftSession.id).toBe("draft-1");
    expect(response.body.draftSession.status).toBe("pending");
    expect(createOrGetPlanAiDraftSession).toHaveBeenCalledWith(42, "chat-1");
  });

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

  it("confirms a persistent draft into a plan", async () => {
    confirmPlanAiDraft.mockResolvedValue({
      id: "plan-1",
      title: "Plano confirmado",
      description: "",
      source: "ai",
      goal: { type: "items", source: "ai" },
      items: [],
      chats: [{ id: "chat-1", title: "Chat", pinned: false, planId: "plan-1", planTitle: "Plano confirmado" }],
    });

    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app).post("/api/plan-drafts/draft-1/confirm").send();

    expect(response.status).toBe(201);
    expect(response.body.plan.id).toBe("plan-1");
    expect(confirmPlanAiDraft).toHaveBeenCalledWith(42, "draft-1");
  });
});
