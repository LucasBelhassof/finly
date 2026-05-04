import { beforeEach, describe, expect, it, vi } from "vitest";

const seedDefaultCategoriesForUserMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const findSessionByTokenHashMock = vi.hoisted(() => vi.fn());
const findUserByEmailMock = vi.hoisted(() => vi.fn());
const findUserByIdMock = vi.hoisted(() => vi.fn());
const insertAuditEventMock = vi.hoisted(() => vi.fn());
const listUsersWithoutCredentialsMock = vi.hoisted(() => vi.fn());
const markSessionRotatedMock = vi.hoisted(() => vi.fn());
const revokeSessionFamilyMock = vi.hoisted(() => vi.fn());
const touchSessionMock = vi.hoisted(() => vi.fn());
const withTransactionMock = vi.hoisted(() => vi.fn());
const jwtVerifyMock = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => vi.fn());

vi.mock("argon2", () => ({
  default: {
    argon2id: 2,
    hash: vi.fn().mockResolvedValue("hashed-password"),
    verify: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }

    setSubject() {
      return this;
    }

    setIssuedAt() {
      return this;
    }

    setExpirationTime() {
      return this;
    }

    async sign() {
      return "access-token";
    }
  },
  jwtVerify: jwtVerifyMock,
}));

vi.mock("../../default-categories.js", () => ({
  seedDefaultCategoriesForUser: seedDefaultCategoriesForUserMock,
}));

vi.mock("./repository.js", () => ({
  attachCredentialsToUser: noop,
  createPasswordResetToken: noop,
  createSession: createSessionMock,
  createUser: createUserMock,
  findPasswordResetTokenByHash: noop,
  findSessionByTokenHash: findSessionByTokenHashMock,
  findUserByEmail: findUserByEmailMock,
  findUserByEmailExcludingUserId: noop,
  findUserById: findUserByIdMock,
  insertAuditEvent: insertAuditEventMock,
  invalidateActivePasswordResetTokens: noop,
  listUsersWithoutCredentials: listUsersWithoutCredentialsMock,
  markPasswordResetTokenUsed: noop,
  markSessionRotated: markSessionRotatedMock,
  revokeSession: noop,
  revokeSessionFamily: revokeSessionFamilyMock,
  revokeUserSessions: noop,
  touchSession: touchSessionMock,
  updateUserAccount: noop,
  updateUserContact: noop,
  updateUserOnboardingState: noop,
  updateUserPassword: noop,
  withTransaction: withTransactionMock,
}));

describe("auth category seeding", () => {
  const fakeClient = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    withTransactionMock.mockImplementation(async (callback: (client: typeof fakeClient) => unknown) =>
      callback(fakeClient),
    );
    findUserByEmailMock.mockResolvedValue(null);
    createSessionMock.mockResolvedValue({ id: 700 });
    insertAuditEventMock.mockResolvedValue(undefined);
    seedDefaultCategoriesForUserMock.mockResolvedValue(undefined);
    findUserByIdMock.mockReset();
    findSessionByTokenHashMock.mockReset();
    markSessionRotatedMock.mockReset();
    revokeSessionFamilyMock.mockReset();
    touchSessionMock.mockReset();
    jwtVerifyMock.mockReset();
  });

  it("seeds default categories inside signup transactions", async () => {
    createUserMock.mockResolvedValue({
      id: 15,
      name: "Lucas",
      email: "lucas@example.com",
      onboardingProgress: null,
      onboardingCompletedAt: null,
      emailVerifiedAt: null,
      role: "user",
      status: "active",
      isPremium: false,
      premiumSince: null,
    });

    const { signup } = await import("./service.js");

    await signup(
      {
        name: "Lucas",
        email: "lucas@example.com",
        password: "Password123!",
        rememberMe: true,
      },
      {
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
      },
    );

    expect(seedDefaultCategoriesForUserMock).toHaveBeenCalledWith(15, fakeClient);
    expect(createSessionMock).toHaveBeenCalledTimes(1);
  });

  it("seeds default categories when bootstrap creates a brand-new user row", async () => {
    createUserMock.mockResolvedValue({
      id: 21,
      name: "Novo Usuario",
      email: "novo@example.com",
      onboardingProgress: null,
      onboardingCompletedAt: null,
      emailVerifiedAt: null,
      role: "user",
      status: "active",
      isPremium: false,
      premiumSince: null,
    });
    listUsersWithoutCredentialsMock.mockResolvedValue([]);

    const { bootstrapUserCredentials } = await import("./service.js");

    const result = await bootstrapUserCredentials({
      email: "novo@example.com",
      password: "Password123!",
      name: "Novo Usuario",
    });

    expect(result.action).toBe("created");
    expect(seedDefaultCategoriesForUserMock).toHaveBeenCalledWith(21, fakeClient);
  });

  it("blocks login for inactive users", async () => {
    createUserMock.mockReset();
    findUserByEmailMock.mockResolvedValue({
      id: 31,
      name: "Inativo",
      email: "inactive@example.com",
      passwordHash: "hash",
      onboardingProgress: null,
      onboardingCompletedAt: null,
      emailVerifiedAt: null,
      role: "user",
      status: "inactive",
      isPremium: false,
      premiumSince: null,
    });

    const { login } = await import("./service.js");

    await expect(
      login(
        {
          email: "inactive@example.com",
          password: "Password123!",
          rememberMe: false,
        },
        {
          ipAddress: "127.0.0.1",
          userAgent: "Vitest",
        },
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "user_inactive",
    });

    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("revokes the session family when refresh is attempted by a suspended user", async () => {
    findSessionByTokenHashMock.mockResolvedValue({
      id: 900,
      sessionFamilyId: "family-1",
      rememberMe: true,
      revokedAt: null,
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 44,
        name: "Suspenso",
        email: "suspended@example.com",
        passwordHash: "hash",
        onboardingProgress: null,
        onboardingCompletedAt: null,
        emailVerifiedAt: null,
        role: "user",
        status: "suspended",
        isPremium: false,
        premiumSince: null,
      },
    });

    const { refreshSession } = await import("./service.js");

    await expect(
      refreshSession("refresh-token", {
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "user_suspended",
    });

    expect(revokeSessionFamilyMock).toHaveBeenCalledWith("family-1", fakeClient);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("blocks valid access tokens when the user is suspended", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "52",
      },
    });
    findUserByIdMock.mockResolvedValue({
      id: 52,
      name: "Suspenso",
      email: "suspended@example.com",
      onboardingProgress: null,
      onboardingCompletedAt: null,
      emailVerifiedAt: null,
      role: "user",
      status: "suspended",
      isPremium: false,
      premiumSince: null,
    });

    const { verifyAccessToken } = await import("./service.js");

    await expect(verifyAccessToken("access-token")).rejects.toMatchObject({
      status: 403,
      code: "user_suspended",
    });
  });
});
