import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "./shared/env.js";

const pingDatabaseMock = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => vi.fn());

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
  listInsights: noop,
  listInvestments: noop,
  listLatestChatMessages: noop,
  listPlanRecommendations: noop,
  listPlans: noop,
  listSpendingByCategory: noop,
  listTransactions: noop,
  pingDatabase: pingDatabaseMock,
  previewTransactionImport: noop,
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
  updateTransaction: noop,
}));

vi.mock("./modules/auth/routes.js", () => ({
  createAuthRouter: () => express.Router(),
  requireAccessToken: vi.fn(),
}));

vi.mock("./modules/admin/routes.js", () => ({
  createAdminRouter: () => express.Router(),
}));

vi.mock("./modules/notifications/routes.js", () => ({
  createNotificationsRouter: () => express.Router(),
}));

describe("app health route", () => {
  function expectSecurityHeaders(headers: Record<string, string | string[] | undefined>) {
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  }

  beforeEach(() => {
    vi.clearAllMocks();
    pingDatabaseMock.mockResolvedValue({
      server_time: "2026-04-26T15:00:00.000Z",
    });
  });

  it("returns the lightweight liveness status without authentication", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app).get("/api/health").set("Origin", env.appOrigin);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.serverTime).toBe("string");
    expect(response.headers["x-request-id"]).toBeTruthy();
    expectSecurityHeaders(response.headers);
    expect(response.headers["access-control-allow-origin"]).toBe(env.appOrigin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(pingDatabaseMock).not.toHaveBeenCalled();
  });

  it("returns database readiness status without authentication", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();

    const response = await request(app).get("/api/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ready",
      database: "connected",
      serverTime: "2026-04-26T15:00:00.000Z",
    });
    expect(response.headers["x-request-id"]).toBeTruthy();
    expectSecurityHeaders(response.headers);
    expect(pingDatabaseMock).toHaveBeenCalledTimes(1);
  });
});
