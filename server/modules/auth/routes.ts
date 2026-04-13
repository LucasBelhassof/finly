import type { Request } from "express";
import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../../shared/env.js";
import { BadRequestError, UnauthorizedError } from "../../shared/errors.js";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "./schemas.js";
import {
  forgotPassword,
  getCurrentUser,
  getExpiredRefreshCookieOptions,
  getRefreshCookieOptions,
  login,
  logout,
  refreshSession,
  resetPassword,
  signup,
  verifyAccessToken,
  type AuthRequestMetadata,
} from "./service.js";
import { insertAuditEvent } from "./repository.js";

function getRequestMetadata(request: Request): AuthRequestMetadata {
  const forwardedFor = request.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim() || null
      : request.ip || null;

  return {
    ipAddress,
    userAgent: request.get("user-agent") || null,
  };
}

function createAuthRateLimiter(route: string, max: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: async (request, response) => {
      const metadata = getRequestMetadata(request);

      await insertAuditEvent({
        email: typeof request.body?.email === "string" ? String(request.body.email).toLowerCase() : null,
        eventType: `${route}_rate_limited`,
        success: false,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      response.status(429).json({
        error: "rate_limited",
        message: "Too many attempts. Please wait before trying again.",
      });
    },
  });
}

function parseBearerToken(request: Request) {
  const authorizationHeader = request.get("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("authorization_header_missing", "Authorization header is required.");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  if (!token) {
    throw new BadRequestError("authorization_header_invalid", "Authorization header is invalid.");
  }

  return token;
}

export async function requireAccessToken(request: Request) {
  const token = parseBearerToken(request);
  const auth = await verifyAccessToken(token);
  request.auth = auth;
  return auth;
}

export function createAuthRouter() {
  const router = Router();
  const loginLimiter = createAuthRateLimiter("login", 5);
  const signupLimiter = createAuthRateLimiter("signup", 5);
  const forgotPasswordLimiter = createAuthRateLimiter("forgot_password", 3);
  const resetPasswordLimiter = createAuthRateLimiter("reset_password", 3);
  const refreshLimiter = createAuthRateLimiter("refresh", 30);
  const refreshCookieName = env.auth.refreshCookieName;

  router.post("/login", loginLimiter, async (request, response) => {
    const input = loginSchema.parse(request.body ?? {});
    const result = await login(
      {
        email: input.email,
        password: input.password,
        rememberMe: input.rememberMe ?? false,
      },
      getRequestMetadata(request),
    );

    response.cookie(refreshCookieName, result.refreshToken, getRefreshCookieOptions(result.rememberMe));
    response.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });
  });

  router.post("/signup", signupLimiter, async (request, response) => {
    const input = signupSchema.parse(request.body ?? {});
    const result = await signup(
      {
        name: input.name,
        email: input.email,
        password: input.password,
        rememberMe: input.rememberMe ?? false,
      },
      getRequestMetadata(request),
    );

    response.cookie(refreshCookieName, result.refreshToken, getRefreshCookieOptions(result.rememberMe));
    response.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });
  });

  router.post("/refresh", refreshLimiter, async (request, response) => {
    const result = await refreshSession(request.cookies?.[refreshCookieName], getRequestMetadata(request));

    response.cookie(refreshCookieName, result.refreshToken, getRefreshCookieOptions(result.rememberMe));
    response.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });
  });

  router.post("/logout", async (request, response) => {
    await logout(request.cookies?.[refreshCookieName], getRequestMetadata(request));
    response.cookie(refreshCookieName, "", getExpiredRefreshCookieOptions());
    response.status(204).send();
  });

  router.post("/forgot-password", forgotPasswordLimiter, async (request, response) => {
    const input = forgotPasswordSchema.parse(request.body ?? {});
    const result = await forgotPassword(input.email, getRequestMetadata(request));
    response.json(result);
  });

  router.post("/reset-password", resetPasswordLimiter, async (request, response) => {
    const input = resetPasswordSchema.parse(request.body ?? {});
    const result = await resetPassword(
      {
        token: input.token,
        newPassword: input.newPassword,
      },
      getRequestMetadata(request),
    );
    response.json(result);
  });

  router.get("/me", async (request, response) => {
    const auth = await requireAccessToken(request);
    const user = await getCurrentUser(auth.userId);
    response.json({ user });
  });

  return router;
}
