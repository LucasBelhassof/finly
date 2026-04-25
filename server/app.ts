import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  commitTransactionImport,
  createBankConnection,
  createCategory,
  createChatConversation,
  createChatReply,
  createHousing,
  createTransaction,
  deleteBankConnection,
  deleteCategory,
  deleteChatConversation,
  deleteHousing,
  deleteTransaction,
  getDashboardData,
  getInstallmentsOverview,
  getTransactionImportAiSuggestions,
  listBanks,
  listCategories,
  listChatConversations,
  listLatestChatMessages,
  listChatMessages,
  listHousing,
  listInsights,
  listSpendingByCategory,
  listTransactions,
  pingDatabase,
  previewTransactionImport,
  updateBankConnection,
  updateCategory,
  updateHousing,
  updateTransaction,
} from "./database.js";
import { createAdminRouter } from "./modules/admin/routes.js";
import { createAuthRouter, requireAccessToken } from "./modules/auth/routes.js";
import { createNotificationsRouter } from "./modules/notifications/routes.js";
import { env } from "./shared/env.js";
import { isHttpError, toHttpError } from "./shared/errors.js";
import { MAX_IMPORT_BYTES, parseMultipartCsvUpload } from "./transaction-import.js";

function getAuthenticatedUserId(request: Request) {
  if (!request.auth) {
    throw toHttpError(new Error("authenticated user is required"));
  }

  return request.auth.userId;
}

function parseIntegerRouteParam(value: string | undefined, errorCode: string) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed)) {
    return {
      error: errorCode,
    };
  }

  return {
    value: parsed,
  };
}

export function createApp() {
  const app = express();
  const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
  const clientDistDirectory = path.resolve(serverDirectory, "../dist");
  const clientIndexPath = path.join(clientDistDirectory, "index.html");

  app.use(
    cors({
      origin: env.appOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  app.get("/api/health", async (_request, response) => {
    const database = await pingDatabase();

    response.json({
      status: "ok",
      database: "connected",
      serverTime: database.server_time,
    });
  });

  app.use("/api/auth", createAuthRouter());
  app.use("/api", async (request, _response, next) => {
    await requireAccessToken(request);
    next();
  });
  app.use("/api/admin", createAdminRouter());
  app.use("/api/notifications", createNotificationsRouter());

  app.get("/api/dashboard", async (request, response) => {
    const dashboard = await getDashboardData(getAuthenticatedUserId(request), {
      startDate: request.query.startDate as string | undefined,
      endDate: request.query.endDate as string | undefined,
    });
    response.json(dashboard);
  });

  app.get("/api/transactions", async (request, response) => {
    const limitValue = request.query.limit;
    const limit = limitValue === undefined ? undefined : Number.parseInt(String(limitValue), 10);
    const transactions =
      limitValue === undefined
        ? await listTransactions(getAuthenticatedUserId(request))
        : await listTransactions(getAuthenticatedUserId(request), Number.isNaN(limit) ? 8 : limit);

    response.json({ transactions });
  });

  app.get("/api/housing", async (request, response) => {
    const housing = await listHousing(getAuthenticatedUserId(request));
    response.json({ housing });
  });

  app.post("/api/housing", async (request, response) => {
    const housing = await createHousing(getAuthenticatedUserId(request), request.body ?? {});
    response.status(201).json(housing);
  });

  app.patch("/api/housing/:id", async (request, response) => {
    const housingId = parseIntegerRouteParam(request.params.id, "invalid_housing_id");

    if (housingId.error) {
      response.status(400).json(housingId);
      return;
    }

    const housing = await updateHousing(getAuthenticatedUserId(request), housingId.value, request.body ?? {});
    response.json(housing);
  });

  app.delete("/api/housing/:id", async (request, response) => {
    const housingId = parseIntegerRouteParam(request.params.id, "invalid_housing_id");

    if (housingId.error) {
      response.status(400).json(housingId);
      return;
    }

    await deleteHousing(getAuthenticatedUserId(request), housingId.value);
    response.status(204).send();
  });

  app.get("/api/installments/overview", async (request, response) => {
    const overview = await getInstallmentsOverview(getAuthenticatedUserId(request), {
      cardId: request.query.cardId as string | undefined,
      categoryId: request.query.categoryId as string | undefined,
      status: request.query.status as string | undefined,
      installmentAmountMin: request.query.installmentAmountMin as string | undefined,
      installmentAmountMax: request.query.installmentAmountMax as string | undefined,
      installmentCountMode: request.query.installmentCountMode as string | undefined,
      installmentCountValue: request.query.installmentCountValue as string | undefined,
      purchaseStart: request.query.purchaseStart as string | undefined,
      purchaseEnd: request.query.purchaseEnd as string | undefined,
      sortBy: request.query.sortBy as string | undefined,
      sortOrder: request.query.sortOrder as string | undefined,
    });

    response.json(overview);
  });

  app.post("/api/transactions", async (request, response) => {
    const transaction = await createTransaction(getAuthenticatedUserId(request), request.body ?? {});
    response.status(201).json(transaction);
  });

  app.post(
    "/api/transactions/import/preview",
    express.raw({ type: "multipart/form-data", limit: `${MAX_IMPORT_BYTES}b` }),
    async (request, response) => {
      const upload = parseMultipartCsvUpload(request.headers["content-type"], request.body);
      const importSource =
        request.query.importSource === "credit_card_statement" ? "credit_card_statement" : "bank_statement";
      const preview = await previewTransactionImport(
        getAuthenticatedUserId(request),
        upload.buffer,
        importSource,
        request.query.bankConnectionId as string | undefined,
        upload.filename,
        upload.contentType,
        upload.filePassword,
      );

      response.status(201).json(preview);
    },
  );

  app.post("/api/transactions/import/commit", async (request, response) => {
    const result = await commitTransactionImport(getAuthenticatedUserId(request), request.body ?? {});
    response.status(201).json(result);
  });

  app.post("/api/transactions/import/ai-suggestions", async (request, response) => {
    const result = await getTransactionImportAiSuggestions(getAuthenticatedUserId(request), request.body ?? {});
    response.status(201).json(result);
  });

  app.patch("/api/transactions/:id", async (request, response) => {
    const transactionId = parseIntegerRouteParam(request.params.id, "invalid_transaction_id");

    if (transactionId.error) {
      response.status(400).json(transactionId);
      return;
    }

    const transaction = await updateTransaction(getAuthenticatedUserId(request), transactionId.value, request.body ?? {});
    response.json(transaction);
  });

  app.delete("/api/transactions/:id", async (request, response) => {
    const transactionId = parseIntegerRouteParam(request.params.id, "invalid_transaction_id");

    if (transactionId.error) {
      response.status(400).json(transactionId);
      return;
    }

    await deleteTransaction(getAuthenticatedUserId(request), transactionId.value, request.body ?? {});
    response.status(204).send();
  });

  app.get("/api/categories", async (_request, response) => {
    const categories = await listCategories();
    response.json({ categories });
  });

  app.post("/api/categories", async (request, response) => {
    const category = await createCategory(request.body ?? {});
    response.status(201).json(category);
  });

  app.patch("/api/categories/:id", async (request, response) => {
    const categoryId = parseIntegerRouteParam(request.params.id, "invalid_category_id");

    if (categoryId.error) {
      response.status(400).json(categoryId);
      return;
    }

    const category = await updateCategory(categoryId.value, request.body ?? {});
    response.json(category);
  });

  app.delete("/api/categories/:id", async (request, response) => {
    const categoryId = parseIntegerRouteParam(request.params.id, "invalid_category_id");

    if (categoryId.error) {
      response.status(400).json(categoryId);
      return;
    }

    await deleteCategory(categoryId.value);
    response.status(204).send();
  });

  app.get("/api/spending", async (request, response) => {
    const spending = await listSpendingByCategory(getAuthenticatedUserId(request));
    response.json({ spending });
  });

  app.get("/api/insights", async (request, response) => {
    const insights = await listInsights(getAuthenticatedUserId(request));
    response.json({ insights });
  });

  app.get("/api/banks", async (request, response) => {
    const banks = await listBanks(getAuthenticatedUserId(request));
    response.json({ banks });
  });

  app.post("/api/banks", async (request, response) => {
    const bank = await createBankConnection(getAuthenticatedUserId(request), request.body ?? {});
    response.status(201).json(bank);
  });

  app.patch("/api/banks/:id", async (request, response) => {
    const bankConnectionId = parseIntegerRouteParam(request.params.id, "invalid_bank_connection_id");

    if (bankConnectionId.error) {
      response.status(400).json(bankConnectionId);
      return;
    }

    const bank = await updateBankConnection(getAuthenticatedUserId(request), bankConnectionId.value, request.body ?? {});
    response.json(bank);
  });

  app.delete("/api/banks/:id", async (request, response) => {
    const bankConnectionId = parseIntegerRouteParam(request.params.id, "invalid_bank_connection_id");

    if (bankConnectionId.error) {
      response.status(400).json(bankConnectionId);
      return;
    }

    await deleteBankConnection(getAuthenticatedUserId(request), bankConnectionId.value);
    response.status(204).send();
  });

  app.get("/api/chats", async (request, response) => {
    const chats = await listChatConversations(getAuthenticatedUserId(request));
    response.json({ chats });
  });

  app.post("/api/chats", async (request, response) => {
    const chat = await createChatConversation(getAuthenticatedUserId(request));
    response.status(201).json({ chat });
  });

  app.get("/api/chats/:chatId/messages", async (request, response) => {
    const limit = Number.parseInt(String(request.query.limit ?? "20"), 10);
    const messages = await listChatMessages(
      getAuthenticatedUserId(request),
      request.params.chatId,
      Number.isNaN(limit) ? 20 : limit,
    );
    response.json({ messages });
  });

  app.post("/api/chats/:chatId/messages", async (request, response) => {
    const message = request.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      response.status(400).json({
        error: "message is required",
      });
      return;
    }

    const reply = await createChatReply(getAuthenticatedUserId(request), request.params.chatId, message.trim());
    response.status(201).json(reply);
  });

  app.delete("/api/chats/:chatId", async (request, response) => {
    await deleteChatConversation(getAuthenticatedUserId(request), request.params.chatId);
    response.status(204).send();
  });

  app.get("/api/chat/messages", async (request, response) => {
    const limit = Number.parseInt(String(request.query.limit ?? "20"), 10);
    const messages = await listLatestChatMessages(getAuthenticatedUserId(request), Number.isNaN(limit) ? 20 : limit);
    response.json({ messages });
  });

  app.post("/api/chat/messages", async (request, response) => {
    const message = request.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      response.status(400).json({
        error: "message is required",
      });
      return;
    }

    const chat = await createChatConversation(getAuthenticatedUserId(request));
    const reply = await createChatReply(getAuthenticatedUserId(request), chat.id, message.trim());
    response.status(201).json(reply);
  });

  if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientDistDirectory));

    app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(clientIndexPath);
    });
  }

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const normalizedError = isHttpError(error) ? error : toHttpError(error);

    if (normalizedError.status >= 500) {
      console.error(error);
    }

    response.status(normalizedError.status).json({
      error: normalizedError.code,
      message:
        normalizedError.status >= 500 && env.nodeEnv !== "development"
          ? "The backend failed while processing the request."
          : normalizedError.message,
      ...(normalizedError.details ? { details: normalizedError.details } : {}),
    });
  });

  return app;
}
