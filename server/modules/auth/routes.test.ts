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
  verifyAccessTokenMock,
} = vi.hoisted(() => ({
  forgotPasswordMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  insertAuditEventMock: vi.fn(),
  loginMock: vi.fn(),
  logoutMock: vi.fn(),
  refreshSessionMock: vi.fn(),
  resetPasswordMock: vi.fn(),
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
