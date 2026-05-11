import type { Request } from "express";
import { Router } from "express";

import { env } from "../../shared/env.js";
import { requireAccessToken } from "../auth/routes.js";
import { getExpiredRefreshCookieOptions } from "../auth/service.js";
import { deleteAccountSchema } from "./schemas.js";
import { buildTransactionsCsv, deleteUserAccount, getUserFullExport, getUserTransactionsForExport } from "./service.js";

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

export function createUserDataRouter() {
  const router = Router();

  router.get("/export/csv", async (request, response) => {
    const auth = await requireAccessToken(request);
    const rows = await getUserTransactionsForExport(auth.userId);
    const csv = buildTransactionsCsv(rows);
    const dateStr = new Date().toISOString().slice(0, 10);

    response.set("Content-Type", "text/csv; charset=utf-8");
    response.set("Content-Disposition", `attachment; filename="transactions-${dateStr}.csv"`);
    response.send(csv);
  });

  router.get("/export/json", async (request, response) => {
    const auth = await requireAccessToken(request);
    const data = await getUserFullExport(auth.userId);
    const dateStr = new Date().toISOString().slice(0, 10);

    response.set("Content-Type", "application/json; charset=utf-8");
    response.set("Content-Disposition", `attachment; filename="account-data-${dateStr}.json"`);
    response.json(data);
  });

  router.delete("/account", async (request, response) => {
    const auth = await requireAccessToken(request);
    const input = deleteAccountSchema.parse(request.body ?? {});

    await deleteUserAccount(auth.userId, input.currentPassword, getRequestMetadata(request));

    response.cookie(env.auth.refreshCookieName, "", getExpiredRefreshCookieOptions());
    response.json({ message: "Account deleted successfully." });
  });

  return router;
}
