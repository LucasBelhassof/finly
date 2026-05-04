import { Router } from "express";

import { BadRequestError } from "../../shared/errors.js";
import { normalizePaginationParams } from "../../shared/pagination.js";
import { listInvoicesForUser, markInvoicePaid, unmarkInvoicePaid, updateInvoiceSettingsForCard } from "./service.js";

function parseIntegerRouteParam(value: string | undefined, code: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: code, message: "Invalid route parameter." };
  }

  return { value: parsed };
}

export function createInvoicesRouter() {
  const router = Router();

  router.get("/", async (request, response) => {
    if (!request.auth) {
      throw new BadRequestError("missing_auth_context", "Authentication context is missing.");
    }

    const result = await listInvoicesForUser(request.auth.userId, {
      cardId: request.query.cardId,
      referenceStart: request.query.referenceStart,
      referenceEnd: request.query.referenceEnd,
      status: request.query.status,
      categoryId: request.query.categoryId,
      search: request.query.search,
    });
    const pagination = normalizePaginationParams({
      page: request.query.page as string | undefined,
      pageSize: request.query.pageSize as string | undefined,
    });

    if (!pagination.isPaginated) {
      response.json(result);
      return;
    }

    const start = pagination.offset;
    const end = start + pagination.pageSize;
    response.json({
      ...result,
      invoices: result.invoices.slice(start, end),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.invoices.length,
      },
    });
  });

  router.post("/payments", async (request, response) => {
    if (!request.auth) {
      throw new BadRequestError("missing_auth_context", "Authentication context is missing.");
    }

    const { cardId, periodEnd } = request.body ?? {};
    const parsedCardId = parseIntegerRouteParam(String(cardId ?? ""), "invalid_card_id");

    if ("error" in parsedCardId) {
      response.status(400).json(parsedCardId);
      return;
    }

    if (!periodEnd || typeof periodEnd !== "string") {
      response.status(400).json({ error: "invalid_period_end", message: "periodEnd is required." });
      return;
    }

    await markInvoicePaid(request.auth.userId, parsedCardId.value, periodEnd);
    response.json({ ok: true });
  });

  router.delete("/payments/:cardId/:periodEnd", async (request, response) => {
    if (!request.auth) {
      throw new BadRequestError("missing_auth_context", "Authentication context is missing.");
    }

    const cardId = parseIntegerRouteParam(request.params.cardId, "invalid_card_id");

    if ("error" in cardId) {
      response.status(400).json(cardId);
      return;
    }

    const { periodEnd } = request.params;

    if (!periodEnd) {
      response.status(400).json({ error: "invalid_period_end", message: "periodEnd is required." });
      return;
    }

    await unmarkInvoicePaid(request.auth.userId, cardId.value, periodEnd);
    response.status(204).end();
  });

  router.patch("/cards/:id/settings", async (request, response) => {
    if (!request.auth) {
      throw new BadRequestError("missing_auth_context", "Authentication context is missing.");
    }

    const cardId = parseIntegerRouteParam(request.params.id, "invalid_card_id");

    if ("error" in cardId) {
      response.status(400).json(cardId);
      return;
    }

    const card = await updateInvoiceSettingsForCard(request.auth.userId, cardId.value, request.body ?? {});
    response.json({ card });
  });

  return router;
}
