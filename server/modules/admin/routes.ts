import type { Request } from "express";
import { Router } from "express";

import { ForbiddenError } from "../../shared/errors.js";
import { insertAuditEvent } from "../auth/repository.js";
import {
  getAdminActivity,
  getAdminFinancialMetrics,
  getAdminOverview,
  getAdminSubscriptionMetrics,
  getAdminAiUsage,
  getAdminUsers,
} from "./service.js";
import {
  createAdminNotification,
  listAdminNotificationTargets,
  listAdminNotifications,
} from "../notifications/service.js";

function getRequestMetadata(request: Request) {
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

async function requireAdminAccess(request: Request) {
  const user = request.auth?.user;

  if (!user || user.role !== "admin") {
    const metadata = getRequestMetadata(request);

    await insertAuditEvent({
      userId: request.auth?.userId,
      email: request.auth?.user?.email ?? null,
      eventType: "admin_access_denied",
      success: false,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        path: request.path,
        method: request.method,
      },
    });

    throw new ForbiddenError("admin_required", "Admin access is required.");
  }

  return user;
}

async function auditAdminAccess(request: Request, eventType: string) {
  const metadata = getRequestMetadata(request);

  await insertAuditEvent({
    userId: request.auth?.userId,
    email: request.auth?.user?.email ?? null,
    eventType,
    success: true,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    metadata: {
      path: request.path,
      method: request.method,
    },
  });
}

export function createAdminRouter() {
  const router = Router();

  router.use(async (request, _response, next) => {
    try {
      await requireAdminAccess(request);
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get("/overview", async (request, response) => {
    await auditAdminAccess(request, "admin_overview_viewed");
    const result = await getAdminOverview({
      startDate: request.query.startDate as string | undefined,
      endDate: request.query.endDate as string | undefined,
    });
    response.json(result);
  });

  router.get("/users", async (request, response) => {
    await auditAdminAccess(request, "admin_users_viewed");
    const result = await getAdminUsers({
      page: request.query.page as string | undefined,
      pageSize: request.query.pageSize as string | undefined,
      status: request.query.status as string | undefined,
      premium: request.query.premium as string | undefined,
      recentActivity: request.query.recentActivity as string | undefined,
    });
    response.json(result);
  });

  router.get("/financial-metrics", async (request, response) => {
    await auditAdminAccess(request, "admin_financial_metrics_viewed");
    const result = await getAdminFinancialMetrics({
      startDate: request.query.startDate as string | undefined,
      endDate: request.query.endDate as string | undefined,
    });
    response.json(result);
  });

  router.get("/subscription-metrics", async (request, response) => {
    await auditAdminAccess(request, "admin_subscription_metrics_viewed");
    const result = await getAdminSubscriptionMetrics({
      startDate: request.query.startDate as string | undefined,
      endDate: request.query.endDate as string | undefined,
    });
    response.json(result);
  });

  router.get("/activity", async (request, response) => {
    await auditAdminAccess(request, "admin_activity_viewed");
    const result = await getAdminActivity({
      limit: request.query.limit as string | undefined,
    });
    response.json(result);
  });

  router.get("/ai-usage", async (request, response) => {
    await auditAdminAccess(request, "admin_ai_usage_viewed");
    const result = await getAdminAiUsage({
      startDate: request.query.startDate as string | undefined,
      endDate: request.query.endDate as string | undefined,
    });
    response.json(result);
  });

  router.get("/notification-targets", async (request, response) => {
    await auditAdminAccess(request, "admin_notification_targets_viewed");
    const result = await listAdminNotificationTargets(request.auth!.userId);
    response.json(result);
  });

  router.get("/notifications", async (request, response) => {
    await auditAdminAccess(request, "admin_notifications_viewed");
    const result = await listAdminNotifications(request.auth!.userId, {
      limit: request.query.limit as string | undefined,
    });
    response.json(result);
  });

  router.post("/notifications", async (request, response) => {
    await auditAdminAccess(request, "admin_notifications_created");
    const result = await createAdminNotification(request.auth!.userId, request.body ?? {});
    response.status(201).json(result);
  });

  return router;
}
