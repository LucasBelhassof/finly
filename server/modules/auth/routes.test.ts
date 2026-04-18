import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../../shared/env.js";
import { isHttpError, toHttpError } from "../../shared/errors.js";
import { createAuthRouter } from "./routes.js";

const {
  forgotPasswordMock,
  getCurrentUserMock,
  insertAuditEventMock,
  loginMock,
  logoutMock,
  refreshSessionMock,
  resetPasswordMock,
  updateOnboardingProgressMock,
  verifyAccessTokenMock,
} = vi.hoisted(() => ({
  forgotPasswordMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  insertAuditEventMock: vi.fn(),
  loginMock: vi.fn(),
  logoutMock: vi.fn(),
  refreshSessionMock: vi.fn(),
  resetPasswordMock: vi.fn(),
  updateOnboardingProgressMock: vi.fn(),
  verifyAccessTokenMock: vi.fn(),
}));

vi.mock("./service.js", () => ({
  forgotPassword: forgotPasswordMock,
  getCurrentUser: getCurrentUserMock,
  getExpiredRefreshCookieOptions: () => ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/api/auth",
    expires: new Date(0),
    maxAge: 0,
  }),
  getRefreshCookieOptions: (rememberMe: boolean) => ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/api/auth",
    ...(rememberMe ? { maxAge: env.auth.rememberedRefreshTtlMs } : {}),
  }),
  login: loginMock,
  logout: logoutMock,
  refreshSession: refreshSessionMock,
  resetPassword: resetPasswordMock,
  updateOnboardingProgress: updateOnboardingProgressMock,
  verifyAccessToken: verifyAccessTokenMock,
}));

vi.mock("./repository.js", () => ({
  insertAuditEvent: insertAuditEventMock,
}));

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: "Joao",
    email: "joao@finance.test",
    hasCompletedOnboarding: true,
    onboardingProgress: {
      currentStep: 42,
      completedSteps: [
        "dashboard_summary",
        "dashboard_transactions",
        "dashboard_insights",
        "dashboard_accounts",
        "accounts_summary",
        "accounts_structure",
        "accounts_support",
        "transactions_filters",
        "transactions_summary",
        "transactions_table",
        "transactions_categories",
        "recurring_income_filters",
        "recurring_income_summary",
        "recurring_income_chart",
        "recurring_income_table",
        "installments_summary",
        "installments_filters",
        "installments_insights",
        "installments_table",
        "housing_filters",
        "housing_summary",
        "housing_trend",
        "housing_table",
        "expense_metrics_filters",
        "expense_metrics_summary",
        "expense_metrics_trend",
        "expense_metrics_ranking",
        "insights_summary",
        "insights_recommendations",
        "insights_spending",
        "notifications_filters",
        "notifications_inbox",
        "notifications_details",
        "notifications_form",
        "chat_conversation",
        "chat_suggestions",
        "profile_identity",
        "profile_account",
        "profile_shortcuts",
        "settings_account",
        "settings_security",
        "settings_contact",
        "settings_preferences",
      ],
      skippedSteps: [],
      dismissed: false,
    },
    role: "user",
    status: "active",
    isPremium: false,
    premiumSince: null,
    ...overrides,
  };
}

function createTestApp() {
  const app = express();

  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/auth", createAuthRouter());
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const normalizedError = isHttpError(error) ? error : toHttpError(error);

    response.status(normalizedError.status).json({
      error: normalizedError.code,
      message: normalizedError.message,
    });
  });

  return app;
}

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    loginMock.mockResolvedValue({
      user: buildUser(),
      accessToken: "access-token",
      expiresAt: "2026-04-12T12:00:00.000Z",
      refreshToken: "refresh-token",
      rememberMe: true,
    });

    refreshSessionMock.mockResolvedValue({
      user: buildUser(),
      accessToken: "new-access-token",
      expiresAt: "2026-04-12T12:15:00.000Z",
      refreshToken: "next-refresh-token",
      rememberMe: true,
    });

    forgotPasswordMock.mockResolvedValue({
      message: "If the email exists, a reset link has been generated.",
      debugResetUrl: "http://localhost:5173/reset-password?token=test-token",
    });

    resetPasswordMock.mockResolvedValue({
      message: "Password updated successfully. Active sessions have been revoked.",
    });

    verifyAccessTokenMock.mockResolvedValue({
      userId: 7,
      user: buildUser(),
    });

    getCurrentUserMock.mockResolvedValue(buildUser());
    updateOnboardingProgressMock.mockResolvedValue(buildUser());
  });

  it("logs in and sets the refresh cookie", async () => {
    const app = createTestApp();

    const response = await request(app).post("/api/auth/login").send({
      email: "joao@finance.test",
      password: "Password123!",
      rememberMe: true,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: buildUser(),
      accessToken: "access-token",
      expiresAt: "2026-04-12T12:00:00.000Z",
    });
    expect(response.headers["set-cookie"]?.[0]).toContain(`${env.auth.refreshCookieName}=refresh-token`);
  });

  it("rotates the refresh cookie on refresh", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `${env.auth.refreshCookieName}=refresh-token`);

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]?.[0]).toContain(`${env.auth.refreshCookieName}=next-refresh-token`);
  });

  it("does not rate limit successful refresh rotations", async () => {
    const app = createTestApp();

    for (let attempt = 0; attempt < 35; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", `${env.auth.refreshCookieName}=refresh-token`);

      expect(response.status).toBe(200);
    }

    expect(refreshSessionMock).toHaveBeenCalledTimes(35);
    expect(insertAuditEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "refresh_rate_limited",
      }),
    );
  });

  it("rejects /me without a bearer token", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "authorization_header_missing",
      message: "Authorization header is required.",
    });
  });

  it("returns the authenticated user on /me", async () => {
    const app = createTestApp();

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: buildUser(),
    });
  });

  it("updates onboarding progress for the authenticated user", async () => {
    const app = createTestApp();

    const response = await request(app)
      .patch("/api/auth/onboarding")
      .set("Authorization", "Bearer access-token")
      .send({
        currentStep: 1,
        completedSteps: ["dashboard_summary"],
        skippedSteps: [],
        dismissed: false,
      });

    expect(response.status).toBe(200);
    expect(updateOnboardingProgressMock).toHaveBeenCalledWith(7, {
      currentStep: 1,
      completedSteps: ["dashboard_summary"],
      skippedSteps: [],
      dismissed: false,
    });
    expect(response.body).toEqual({
      user: buildUser(),
    });
  });

  it("clears the refresh cookie on logout", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `${env.auth.refreshCookieName}=refresh-token`);

    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]?.[0]).toContain(`${env.auth.refreshCookieName}=`);
    expect(response.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
  });
});
