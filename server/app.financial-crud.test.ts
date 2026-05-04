import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestAuthContext } from "./modules/auth/types.js";

const createBankConnectionMock = vi.fn();
const createCategoryMock = vi.fn();
const createTransactionMock = vi.fn();
const noop = vi.fn();

vi.mock("./database.js", () => ({
  applyPlanRecommendation: noop,
  commitTransactionImport: noop,
  createBankConnection: createBankConnectionMock,
  createCategory: createCategoryMock,
  createChatConversation: noop,
  createChatReply: noop,
  createHousing: noop,
  createInvestment: noop,
  createOrGetPlanAiDraftSession: noop,
  createPlan: noop,
  createTransaction: createTransactionMock,
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
  listCategories: noop,
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

vi.mock("./modules/invoices/routes.js", () => ({
  createInvoicesRouter: () => express.Router(),
}));

describe("financial CRUD routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBankConnectionMock.mockResolvedValue({ id: 100, name: "Conta Principal" });
    createCategoryMock.mockResolvedValue({ id: 55, label: "Viagens" });
    createTransactionMock.mockResolvedValue({ id: 900, description: "Hotel" });
  });

  it("creates bank connections, custom categories and transactions scoped to the authenticated user", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    expect(
      (
        await request(app).post("/api/banks").send({
          name: "Conta Principal",
          accountType: "checking",
        })
      ).status,
    ).toBe(201);

    const categoryResponse = await request(app).post("/api/categories").send({
      label: "Viagens",
      transactionType: "expense",
      icon: "Plane",
      color: "#38bdf8",
      groupLabel: "Lazer",
      groupColor: "#38bdf8",
    });

    expect(categoryResponse.status).toBe(201);

    expect(
      (
        await request(app).post("/api/transactions").send({
          description: "Hotel",
          amount: -450,
          occurredOn: "2026-05-04",
          bankConnectionId: 100,
          categoryId: 55,
        })
      ).status,
    ).toBe(201);

    expect(createBankConnectionMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        name: "Conta Principal",
        accountType: "checking",
      }),
    );
    expect(createCategoryMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        label: "Viagens",
      }),
    );
    expect(createTransactionMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        description: "Hotel",
        categoryId: 55,
        bankConnectionId: 100,
      }),
    );
  });
});
