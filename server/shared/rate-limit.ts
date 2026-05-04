import rateLimit, { ipKeyGenerator } from "express-rate-limit";

function resolveRateLimitKey(request: {
  auth?: {
    userId?: number;
  };
  ip?: string | undefined;
}) {
  if (request.auth?.userId) {
    return `user:${request.auth.userId}`;
  }

  return ipKeyGenerator(request.ip || "unknown");
}

export function createApiRateLimiter(key: string, max: number, windowMs = 15 * 60 * 1000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: resolveRateLimitKey,
    handler: (_request, response) => {
      response.status(429).json({
        error: "rate_limited",
        message: `Too many ${key} requests. Please wait before trying again.`,
      });
    },
  });
}
