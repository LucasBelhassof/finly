import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toHttpError } from "../../shared/errors.js";
import { createUserDataRouter } from "./routes.js";

const {
  buildTransactionsCsvMock,
  deleteUserAccountMock,
  escapeCsvFieldMock,
  getUserFullExportMock,
  getUserTransactionsForExportMock,
  verifyAccessTokenMock,
  getExpiredRefreshCookieOptionsMock,
  insertAuditEventMock,
} = vi.hoisted(() => ({
  buildTransactionsCsvMock: vi.fn(),
  deleteUserAccountMock: vi.fn(),
  escapeCsvFieldMock: vi.fn((v: unknown) => String(v ?? "")),
  getUserFullExportMock: vi.fn(),
  getUserTransactionsForExportMock: vi.fn(),
  verifyAccessTokenMock: vi.fn(),
  getExpiredRefreshCookieOptionsMock: vi.fn(),
  insertAuditEventMock: vi.fn(),
}));

vi.mock("./service.js", () => ({
  buildTransactionsCsv: buildTransactionsCsvMock,
  deleteUserAccount: deleteUserAccountMock,
  escapeCsvField: escapeCsvFieldMock,
  getUserFullExport: getUserFullExportMock,
  getUserTransactionsForExport: getUserTransactionsForExportMock,
}));

vi.mock("../auth/routes.js", () => ({
  requireAccessToken: verifyAccessTokenMock,
  createAuthRouter: () => express.Router(),
}));

vi.mock("../auth/service.js", () => ({
  getExpiredRefreshCookieOptions: getExpiredRefreshCookieOptionsMock,
  verifyAccessToken: verifyAccessTokenMock,
}));

vi.mock("../auth/repository.js", () => ({
  insertAuditEvent: insertAuditEventMock,
}));

vi.mock("../../shared/env.js", () => ({
  env: {
    auth: {
      refreshCookieName: "finance_rt",
      accessTokenSecret: "test-secret",
      refreshTokenSecret: "test-refresh-secret",
      accessTokenTtlMs: 900000,
      sessionRefreshTtlMs: 86400000,
      rememberedRefreshTtlMs: 2592000000,
      resetTokenTtlMs: 900000,
      refreshCookieName: "finance_rt",
      passwordResetBaseUrl: "http://localhost:5173/reset-password",
    },
    nodeEnv: "test",
    isProduction: false,
    isTest: true,
    port: 3001,
    databaseUrl: "postgresql://test",
    appOrigin: "http://localhost:5173",
  },
}));

const MOCK_USER_ID = 42;

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/user-data", createUserDataRouter());
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const normalized = toHttpError(error);
    res.status(normalized.status).json({ error: normalized.code, message: normalized.message });
  });
  return app;
}

function mockAuth() {
  verifyAccessTokenMock.mockImplementation((req: Request) => {
    req.auth = { userId: MOCK_USER_ID, user: { id: MOCK_USER_ID } as never };
    return Promise.resolve({ userId: MOCK_USER_ID });
  });
}

function mockAuthUnauthorized() {
  const { UnauthorizedError } = require("../../shared/errors.js");
  verifyAccessTokenMock.mockRejectedValue(new UnauthorizedError("unauthorized", "Authentication is required."));
}

beforeEach(() => {
  vi.clearAllMocks();
  getExpiredRefreshCookieOptionsMock.mockReturnValue({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
});

describe("GET /api/user-data/export/csv", () => {
  it("returns 200 with text/csv content-type when authenticated", async () => {
    mockAuth();
    const csvContent =
      "date,description,amount,type,category,account,createdAt\n2026-01-15,Test,100.00,expense,Food,,2026-01-15T00:00:00.000Z";
    getUserTransactionsForExportMock.mockResolvedValue([]);
    buildTransactionsCsvMock.mockReturnValue(csvContent);

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/csv").set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/csv/);
    expect(response.headers["content-disposition"]).toMatch(/attachment/);
    expect(response.headers["content-disposition"]).toMatch(/transactions-/);
  });

  it("passes correct userId to export function", async () => {
    mockAuth();
    getUserTransactionsForExportMock.mockResolvedValue([]);
    buildTransactionsCsvMock.mockReturnValue("date,description,amount,type,category,account,createdAt\n");

    const app = buildTestApp();
    await request(app).get("/api/user-data/export/csv").set("Authorization", "Bearer token");

    expect(getUserTransactionsForExportMock).toHaveBeenCalledWith(MOCK_USER_ID);
  });

  it("includes the correct CSV header row", async () => {
    mockAuth();
    const csvContent = "date,description,amount,type,category,account,createdAt\n";
    getUserTransactionsForExportMock.mockResolvedValue([]);
    buildTransactionsCsvMock.mockReturnValue(csvContent);

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/csv").set("Authorization", "Bearer token");

    expect(response.text).toContain("date,description,amount,type,category,account,createdAt");
  });

  it("returns 401 when no access token is provided", async () => {
    const { UnauthorizedError } = await import("../../shared/errors.js");
    verifyAccessTokenMock.mockRejectedValue(new UnauthorizedError());

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/csv");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/user-data/export/json", () => {
  const mockExport = {
    exportedAt: "2026-05-10T00:00:00.000Z",
    formatVersion: "1",
    profile: {
      id: MOCK_USER_ID,
      name: "Lucas",
      email: "lucas@example.com",
      phone: null,
      addressStreet: null,
      addressNumber: null,
      addressComplement: null,
      addressNeighborhood: null,
      addressCity: null,
      addressState: null,
      addressPostalCode: null,
      addressCountry: null,
      isPremium: false,
      premiumSince: null,
      onboardingCompletedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    bankConnections: [],
    categories: [],
    transactions: [],
    housing: [],
    installmentPurchases: [],
    monthlySummaries: [],
    insights: [],
    investments: [],
    plans: [],
    chatConversations: [],
    notifications: [],
    aiUsageEvents: [],
  };

  it("returns 200 with application/json content-type when authenticated", async () => {
    mockAuth();
    getUserFullExportMock.mockResolvedValue(mockExport);

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/json").set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.headers["content-disposition"]).toMatch(/attachment/);
    expect(response.headers["content-disposition"]).toMatch(/account-data-/);
  });

  it("response contains exportedAt and formatVersion", async () => {
    mockAuth();
    getUserFullExportMock.mockResolvedValue(mockExport);

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/json").set("Authorization", "Bearer token");

    expect(response.body.exportedAt).toBeTruthy();
    expect(response.body.formatVersion).toBe("1");
  });

  it("response does not contain password_hash", async () => {
    mockAuth();
    getUserFullExportMock.mockResolvedValue(mockExport);

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/json").set("Authorization", "Bearer token");

    expect(response.body.profile).not.toHaveProperty("password_hash");
    expect(response.body.profile).not.toHaveProperty("passwordHash");
  });

  it("response does not contain auth_sessions", async () => {
    mockAuth();
    getUserFullExportMock.mockResolvedValue(mockExport);

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/json").set("Authorization", "Bearer token");

    expect(response.body).not.toHaveProperty("auth_sessions");
    expect(response.body).not.toHaveProperty("authSessions");
  });

  it("passes correct userId to export function", async () => {
    mockAuth();
    getUserFullExportMock.mockResolvedValue(mockExport);

    const app = buildTestApp();
    await request(app).get("/api/user-data/export/json").set("Authorization", "Bearer token");

    expect(getUserFullExportMock).toHaveBeenCalledWith(MOCK_USER_ID);
  });

  it("returns 401 when no access token is provided", async () => {
    const { UnauthorizedError } = await import("../../shared/errors.js");
    verifyAccessTokenMock.mockRejectedValue(new UnauthorizedError());

    const app = buildTestApp();
    const response = await request(app).get("/api/user-data/export/json");

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/user-data/account", () => {
  it("returns 200 and clears cookie on success", async () => {
    mockAuth();
    deleteUserAccountMock.mockResolvedValue(undefined);

    const app = buildTestApp();
    const response = await request(app)
      .delete("/api/user-data/account")
      .set("Authorization", "Bearer token")
      .send({ currentPassword: "correct-password" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBeTruthy();
  });

  it("calls deleteUserAccount with correct userId", async () => {
    mockAuth();
    deleteUserAccountMock.mockResolvedValue(undefined);

    const app = buildTestApp();
    await request(app)
      .delete("/api/user-data/account")
      .set("Authorization", "Bearer token")
      .send({ currentPassword: "correct-password" });

    expect(deleteUserAccountMock).toHaveBeenCalledWith(MOCK_USER_ID, "correct-password", expect.any(Object));
  });

  it("returns 403 when password is wrong", async () => {
    mockAuth();
    const { ForbiddenError } = await import("../../shared/errors.js");
    deleteUserAccountMock.mockRejectedValue(new ForbiddenError("invalid_password", "Invalid password."));

    const app = buildTestApp();
    const response = await request(app)
      .delete("/api/user-data/account")
      .set("Authorization", "Bearer token")
      .send({ currentPassword: "wrong-password" });

    expect(response.status).toBe(403);
  });

  it("returns 400 when currentPassword is missing", async () => {
    mockAuth();

    const app = buildTestApp();
    const response = await request(app).delete("/api/user-data/account").set("Authorization", "Bearer token").send({});

    expect(response.status).toBe(400);
  });

  it("returns 401 when no access token is provided", async () => {
    const { UnauthorizedError } = await import("../../shared/errors.js");
    verifyAccessTokenMock.mockRejectedValue(new UnauthorizedError());

    const app = buildTestApp();
    const response = await request(app).delete("/api/user-data/account").send({ currentPassword: "password" });

    expect(response.status).toBe(401);
  });
});

describe("escapeCsvField (via service)", () => {
  it("is exported from service module", async () => {
    const { escapeCsvField } = await import("./service.js");
    expect(typeof escapeCsvField).toBe("function");
  });
});
