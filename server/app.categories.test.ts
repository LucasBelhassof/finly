import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestAuthContext } from "./modules/auth/types.js";

const createCategoryMock = vi.fn();
const deleteCategoryMock = vi.fn();
const listCategoriesMock = vi.fn();
const updateCategoryMock = vi.fn();
const noop = vi.fn();

vi.mock("./database.js", () => ({
  applyPlanRecommendation: noop,
  commitTransactionImport: noop,
  createBankConnection: noop,
  createCategory: createCategoryMock,
  createChatConversation: noop,
  createChatReply: noop,
  createHousing: noop,
  createInvestment: noop,
  createOrGetPlanAiDraftSession: noop,
  createPlan: noop,
  createTransaction: noop,
  deleteBankConnection: noop,
  deleteCategory: deleteCategoryMock,
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
  listCategories: listCategoriesMock,
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
  updateCategory: updateCategoryMock,
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

describe("category routes user scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCategoriesMock.mockResolvedValue([{ id: 10, label: "Compras" }]);
    createCategoryMock.mockResolvedValue({ id: 11, label: "Viagens" });
    updateCategoryMock.mockResolvedValue({ id: 11, label: "Viagens" });
    deleteCategoryMock.mockResolvedValue(undefined);
  });

  it("passes the authenticated user id to every category route", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    expect((await request(app).get("/api/categories")).status).toBe(200);
    expect((await request(app).post("/api/categories").send({ label: "Viagens" })).status).toBe(201);
    expect((await request(app).patch("/api/categories/11").send({ label: "Viagens" })).status).toBe(200);
    expect((await request(app).delete("/api/categories/11")).status).toBe(204);

    expect(listCategoriesMock).toHaveBeenCalledWith(42);
    expect(createCategoryMock).toHaveBeenCalledWith(42, { label: "Viagens" });
    expect(updateCategoryMock).toHaveBeenCalledWith(42, 11, { label: "Viagens" });
    expect(deleteCategoryMock).toHaveBeenCalledWith(42, 11);
  });
});
