import argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { env } from "../../shared/env.js";
import { BadRequestError, HttpError, UnauthorizedError } from "../../shared/errors.js";
import {
  attachCredentialsToUser,
  createPasswordResetToken,
  createSession,
  createUser,
  findPasswordResetTokenByHash,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  insertAuditEvent,
  invalidateActivePasswordResetTokens,
  listUsersWithoutCredentials,
  markPasswordResetTokenUsed,
  markSessionRotated,
  revokeSession,
  revokeSessionFamily,
  revokeUserSessions,
  touchSession,
  updateUserPassword,
  withTransaction,
} from "./repository.js";
import type { AuthSessionResult, AuthUser } from "./types.js";

export interface AuthRequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

const accessSecret = new TextEncoder().encode(env.auth.accessTokenSecret);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildRefreshToken() {
  return randomBytes(48).toString("base64url");
}

function buildResetToken() {
  return randomBytes(32).toString("hex");
}

function resolveRefreshTtlMs(rememberMe: boolean) {
  return rememberMe ? env.auth.rememberedRefreshTtlMs : env.auth.sessionRefreshTtlMs;
}

function resolveRefreshExpiry(rememberMe: boolean) {
  return new Date(Date.now() + resolveRefreshTtlMs(rememberMe));
}

function toAuthUser(user: {
  id: number;
  name: string;
  email: string | null;
  emailVerifiedAt?: Date | null;
  onboardingCompletedAt?: Date | null;
  role?: "user" | "admin";
  status?: "active" | "inactive" | "suspended";
  isPremium?: boolean;
  premiumSince?: Date | null;
}): AuthUser {
  if (!user.email) {
    throw new BadRequestError("user_email_missing", "The user does not have an email configured.");
  }

  return {
    id: Number(user.id),
    name: String(user.name),
    email: String(user.email),
    emailVerified: user.emailVerifiedAt != null,
    hasCompletedOnboarding: user.onboardingCompletedAt != null,
    role: user.role === "admin" ? "admin" : "user",
    status:
      user.status === "inactive" || user.status === "suspended"
        ? user.status
        : "active",
    isPremium: Boolean(user.isPremium),
    premiumSince: user.premiumSince ? user.premiumSince.toISOString() : null,
  };
}

async function createAccessToken(user: AuthUser) {
  const expiresAt = new Date(Date.now() + env.auth.accessTokenTtlMs);
  const accessToken = await new SignJWT({
    type: "access",
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(accessSecret);

  return {
    accessToken,
    expiresAt: expiresAt.toISOString(),
  };
}

export function getRefreshCookieOptions(rememberMe: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    path: "/api/auth",
    ...(rememberMe ? { maxAge: resolveRefreshTtlMs(true) } : {}),
  };
}

export function getExpiredRefreshCookieOptions() {
  return {
    ...getRefreshCookieOptions(false),
    expires: new Date(0),
    maxAge: 0,
  };
}

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function login(
  input: {
    email: string;
    password: string;
    rememberMe: boolean;
  },
  metadata: AuthRequestMetadata,
) {
  const email = normalizeEmail(input.email);
  const user = await findUserByEmail(email);

  if (!user?.passwordHash || !user.email) {
    await insertAuditEvent({
      email,
      eventType: "login_failed",
      success: false,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        reason: "invalid_credentials",
      },
    });
    throw new UnauthorizedError("invalid_credentials", "Invalid email or password.");
  }

  const isValidPassword = await argon2.verify(user.passwordHash, input.password);

  if (!isValidPassword) {
    await insertAuditEvent({
      userId: user.id,
      email: user.email,
      eventType: "login_failed",
      success: false,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        reason: "invalid_credentials",
      },
    });
    throw new UnauthorizedError("invalid_credentials", "Invalid email or password.");
  }

  const authUser = toAuthUser(user);
  const refreshToken = buildRefreshToken();
  const refreshTokenHash = sha256(refreshToken);
  const sessionFamilyId = randomUUID();
  const accessToken = await createAccessToken(authUser);

  await withTransaction(async (client) => {
    const session = await createSession(
      {
        userId: authUser.id,
        sessionFamilyId,
        tokenHash: refreshTokenHash,
        rememberMe: input.rememberMe,
        expiresAt: resolveRefreshExpiry(input.rememberMe),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      client,
    );

    await insertAuditEvent(
      {
        userId: authUser.id,
        email: authUser.email,
        eventType: "login_success",
        success: true,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          sessionId: session.id,
          rememberMe: input.rememberMe,
        },
      },
      client,
    );
  });

  return {
    user: authUser,
    accessToken: accessToken.accessToken,
    expiresAt: accessToken.expiresAt,
    refreshToken,
    rememberMe: input.rememberMe,
  } satisfies AuthSessionResult;
}

export async function signup(
  input: {
    name: string;
    email: string;
    password: string;
    rememberMe: boolean;
  },
  metadata: AuthRequestMetadata,
) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  return withTransaction(async (client) => {
    const existingUser = await findUserByEmail(email, client);

    if (existingUser) {
      await insertAuditEvent(
        {
          email,
          eventType: "signup_failed",
          success: false,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: { reason: "email_already_registered" },
        },
        client,
      );
      throw new HttpError(409, "email_already_registered", "This email is already registered.");
    }

    const user = await createUser(
      {
        name: input.name.trim(),
        email,
        passwordHash,
      },
      client,
    );

    const authUser = toAuthUser(user);
    const refreshToken = buildRefreshToken();
    const refreshTokenHash = sha256(refreshToken);
    const sessionFamilyId = randomUUID();
    const accessToken = await createAccessToken(authUser);

    const session = await createSession(
      {
        userId: authUser.id,
        sessionFamilyId,
        tokenHash: refreshTokenHash,
        rememberMe: input.rememberMe,
        expiresAt: resolveRefreshExpiry(input.rememberMe),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      client,
    );

    await insertAuditEvent(
      {
        userId: authUser.id,
        email: authUser.email,
        eventType: "signup_success",
        success: true,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          sessionId: session.id,
          rememberMe: input.rememberMe,
        },
      },
      client,
    );

    return {
      user: authUser,
      accessToken: accessToken.accessToken,
      expiresAt: accessToken.expiresAt,
      refreshToken,
      rememberMe: input.rememberMe,
    } satisfies AuthSessionResult;
  });
}

export async function refreshSession(refreshToken: string | undefined, metadata: AuthRequestMetadata) {
  if (!refreshToken) {
    throw new UnauthorizedError("refresh_token_missing", "Refresh token is missing.");
  }

  const refreshTokenHash = sha256(refreshToken);

  return withTransaction(async (client) => {
    const session = await findSessionByTokenHash(refreshTokenHash, client);

    if (!session || !session.user) {
      await insertAuditEvent(
        {
          eventType: "refresh_failed",
          success: false,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: {
            reason: "session_not_found",
          },
        },
        client,
      );
      throw new UnauthorizedError("refresh_token_invalid", "Refresh token is invalid.");
    }

    if (session.revokedAt || session.rotatedAt) {
      await revokeSessionFamily(session.sessionFamilyId, client);
      await insertAuditEvent(
        {
          userId: session.user.id,
          email: session.user.email,
          eventType: "refresh_reuse_detected",
          success: false,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: {
            sessionId: session.id,
            sessionFamilyId: session.sessionFamilyId,
          },
        },
        client,
      );
      throw new UnauthorizedError("refresh_token_reused", "Refresh token reuse detected.");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await revokeSession(session.id, client);
      await insertAuditEvent(
        {
          userId: session.user.id,
          email: session.user.email,
          eventType: "refresh_expired",
          success: false,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: {
            sessionId: session.id,
          },
        },
        client,
      );
      throw new UnauthorizedError("refresh_token_expired", "Refresh token expired.");
    }

    const nextRefreshToken = buildRefreshToken();
    const nextRefreshTokenHash = sha256(nextRefreshToken);
    const nextSession = await createSession(
      {
        userId: session.user.id,
        sessionFamilyId: session.sessionFamilyId,
        tokenHash: nextRefreshTokenHash,
        rememberMe: session.rememberMe,
        expiresAt: resolveRefreshExpiry(session.rememberMe),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      client,
    );

    await markSessionRotated(session.id, nextSession.id, client);
    await touchSession(nextSession.id, client);
    await insertAuditEvent(
      {
        userId: session.user.id,
        email: session.user.email,
        eventType: "refresh_success",
        success: true,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          previousSessionId: session.id,
          nextSessionId: nextSession.id,
        },
      },
      client,
    );

    const authUser = toAuthUser(session.user);
    const accessToken = await createAccessToken(authUser);

    return {
      user: authUser,
      accessToken: accessToken.accessToken,
      expiresAt: accessToken.expiresAt,
      refreshToken: nextRefreshToken,
      rememberMe: session.rememberMe,
    } satisfies AuthSessionResult;
  });
}

export async function logout(refreshToken: string | undefined, metadata: AuthRequestMetadata) {
  if (!refreshToken) {
    return;
  }

  const refreshTokenHash = sha256(refreshToken);

  await withTransaction(async (client) => {
    const session = await findSessionByTokenHash(refreshTokenHash, client);

    if (!session || !session.user) {
      return;
    }

    await revokeSession(session.id, client);
    await insertAuditEvent(
      {
        userId: session.user.id,
        email: session.user.email,
        eventType: "logout_success",
        success: true,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          sessionId: session.id,
        },
      },
      client,
    );
  });
}

export async function forgotPassword(emailInput: string, metadata: AuthRequestMetadata) {
  const email = normalizeEmail(emailInput);
  const user = await findUserByEmail(email);
  let debugResetUrl: string | undefined;

  if (user?.email) {
    const rawResetToken = buildResetToken();
    const tokenHash = sha256(rawResetToken);

    await withTransaction(async (client) => {
      await invalidateActivePasswordResetTokens(user.id, client);
      await createPasswordResetToken(
        {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + env.auth.resetTokenTtlMs),
          requestedIp: metadata.ipAddress,
        },
        client,
      );
      await insertAuditEvent(
        {
          userId: user.id,
          email: user.email,
          eventType: "forgot_password_requested",
          success: true,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        client,
      );
    });

    if (!env.isProduction) {
      debugResetUrl = `${env.auth.passwordResetBaseUrl}?token=${rawResetToken}`;
    }
  } else {
    await insertAuditEvent({
      email,
      eventType: "forgot_password_requested",
      success: true,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        matchedUser: false,
      },
    });
  }

  return {
    message: "If the email exists, a reset link has been generated.",
    ...(debugResetUrl ? { debugResetUrl } : {}),
  };
}

export async function resetPassword(
  input: {
    token: string;
    newPassword: string;
  },
  metadata: AuthRequestMetadata,
) {
  const tokenHash = sha256(input.token);
  const passwordHash = await hashPassword(input.newPassword);

  await withTransaction(async (client) => {
    const passwordResetToken = await findPasswordResetTokenByHash(tokenHash, client);

    if (!passwordResetToken?.user?.email) {
      await insertAuditEvent(
        {
          eventType: "reset_password_failed",
          success: false,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: {
            reason: "token_not_found",
          },
        },
        client,
      );
      throw new BadRequestError("reset_token_invalid", "Reset token is invalid.");
    }

    if (passwordResetToken.usedAt) {
      throw new BadRequestError("reset_token_used", "Reset token has already been used.");
    }

    if (passwordResetToken.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestError("reset_token_expired", "Reset token expired.");
    }

    await updateUserPassword(passwordResetToken.user.id, passwordHash, client);
    await markPasswordResetTokenUsed(passwordResetToken.id, client);
    await invalidateActivePasswordResetTokens(passwordResetToken.user.id, client);
    await revokeUserSessions(passwordResetToken.user.id, client);
    await insertAuditEvent(
      {
        userId: passwordResetToken.user.id,
        email: passwordResetToken.user.email,
        eventType: "reset_password_success",
        success: true,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      client,
    );
  });

  return {
    message: "Password updated successfully. Active sessions have been revoked.",
  };
}

export async function getCurrentUser(userId: number) {
  const user = await findUserById(userId);

  if (!user) {
    throw new UnauthorizedError("user_not_found", "The authenticated user was not found.");
  }

  return toAuthUser(user);
}

export async function verifyAccessToken(accessToken: string) {
  try {
    const { payload } = await jwtVerify(accessToken, accessSecret);
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId)) {
      throw new Error("invalid_token_subject");
    }

    const user = await getCurrentUser(userId);

    return {
      userId,
      user,
    };
  } catch (error) {
    throw new UnauthorizedError("access_token_invalid", error instanceof Error ? error.message : "Invalid access token.");
  }
}

export async function bootstrapUserCredentials(input: {
  email: string;
  password: string;
  name: string;
  userId?: number;
}) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  return withTransaction(async (client) => {
    const existingUserByEmail = await findUserByEmail(email, client);

    if (existingUserByEmail) {
      throw new BadRequestError("email_in_use", "This email is already attached to another user.");
    }

    const candidates = await listUsersWithoutCredentials(client);

    if (input.userId) {
      const attachedUser = await attachCredentialsToUser(
        input.userId,
        {
          name: input.name,
          email,
          passwordHash,
        },
        client,
      );

      if (!attachedUser) {
        throw new BadRequestError("user_not_found", "The selected user was not found.");
      }

      return {
        action: "attached" as const,
        user: toAuthUser(attachedUser),
      };
    }

    if (candidates.length === 0) {
      const createdUser = await createUser(
        {
          name: input.name,
          email,
          passwordHash,
        },
        client,
      );

      return {
        action: "created" as const,
        user: toAuthUser(createdUser),
      };
    }

    if (candidates.length === 1) {
      const attachedUser = await attachCredentialsToUser(
        candidates[0].id,
        {
          name: input.name || candidates[0].name,
          email,
          passwordHash,
        },
        client,
      );

      if (!attachedUser) {
        throw new BadRequestError("user_not_found", "The bootstrap candidate was not found.");
      }

      return {
        action: "attached" as const,
        user: toAuthUser(attachedUser),
      };
    }

    throw new BadRequestError(
      "bootstrap_user_selection_required",
      "Multiple users without credentials were found. Run auth:bootstrap again with --user-id.",
    );
  });
}
