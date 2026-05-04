import { beforeEach, describe, expect, it, vi } from "vitest";

const seedDefaultCategoriesForUserMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const findUserByEmailMock = vi.hoisted(() => vi.fn());
const insertAuditEventMock = vi.hoisted(() => vi.fn());
const listUsersWithoutCredentialsMock = vi.hoisted(() => vi.fn());
const withTransactionMock = vi.hoisted(() => vi.fn());
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
  jwtVerify: vi.fn(),
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
  findSessionByTokenHash: noop,
  findUserByEmail: findUserByEmailMock,
  findUserByEmailExcludingUserId: noop,
  findUserById: noop,
  insertAuditEvent: insertAuditEventMock,
  invalidateActivePasswordResetTokens: noop,
  listUsersWithoutCredentials: listUsersWithoutCredentialsMock,
  markPasswordResetTokenUsed: noop,
  markSessionRotated: noop,
  revokeSession: noop,
  revokeSessionFamily: noop,
  revokeUserSessions: noop,
  touchSession: noop,
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
});
