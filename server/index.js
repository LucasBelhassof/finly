import cors from "cors";
import express from "express";

import {
  commitTransactionImport,
  createCategory,
  createBankConnection,
  createChatReply,
  createTransaction,
  updateCategory,
  deleteBankConnection,
  deleteTransaction,
  getDashboardData,
  getTransactionImportAiSuggestions,
  initializeDatabase,
  listBanks,
  listCategories,
  listChatMessages,
  listInsights,
  listTransactions,
  listRecentTransactions,
  listSpendingByCategory,
  pingDatabase,
  previewTransactionImport,
  updateBankConnection,
  updateTransaction,
} from "./database.js";
import { MAX_IMPORT_BYTES, parseMultipartCsvUpload } from "./transaction-import.js";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "3001", 10);

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_request, response, next) => {
  try {
    const database = await pingDatabase();

    response.json({
      status: "ok",
      database: "connected",
      serverTime: database.server_time,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (_request, response, next) => {
  try {
    const dashboard = await getDashboardData();
    response.json(dashboard);
  } catch (error) {
    next(error);
  }
});

app.get("/api/transactions", async (request, response, next) => {
  try {
    const limitValue = request.query.limit;
    const limit = limitValue === undefined ? undefined : Number.parseInt(limitValue, 10);
    const transactions =
      limitValue === undefined ? await listTransactions() : await listTransactions(Number.isNaN(limit) ? 8 : limit);
    response.json({ transactions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/transactions", async (request, response, next) => {
  try {
    const transaction = await createTransaction(request.body ?? {});
    response.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/transactions/import/preview",
  express.raw({ type: "multipart/form-data", limit: `${MAX_IMPORT_BYTES}b` }),
  async (request, response, next) => {
    try {
      const upload = parseMultipartCsvUpload(request.headers["content-type"], request.body);
      const importSource =
        request.query.importSource === "credit_card_statement" ? "credit_card_statement" : "bank_statement";
      const preview = await previewTransactionImport(
        upload.buffer,
        importSource,
        request.query.bankConnectionId,
        upload.filename,
        upload.contentType,
      );
      response.status(201).json(preview);
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/transactions/import/commit", async (request, response, next) => {
  try {
    const result = await commitTransactionImport(request.body ?? {});
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/transactions/import/ai-suggestions", async (request, response, next) => {
  try {
    const result = await getTransactionImportAiSuggestions(request.body ?? {});
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/transactions/:id", async (request, response, next) => {
  try {
    const transactionId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(transactionId)) {
      response.status(400).json({ error: "invalid_transaction_id" });
      return;
    }

    const transaction = await updateTransaction(transactionId, request.body ?? {});
    response.json(transaction);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/transactions/:id", async (request, response, next) => {
  try {
    const transactionId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(transactionId)) {
      response.status(400).json({ error: "invalid_transaction_id" });
      return;
    }

    await deleteTransaction(transactionId);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/categories", async (_request, response, next) => {
  try {
    const categories = await listCategories();
    response.json({ categories });
  } catch (error) {
    next(error);
  }
});

app.post("/api/categories", async (request, response, next) => {
  try {
    const category = await createCategory(request.body ?? {});
    response.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/categories/:id", async (request, response, next) => {
  try {
    const categoryId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(categoryId)) {
      response.status(400).json({ error: "invalid_category_id" });
      return;
    }

    const category = await updateCategory(categoryId, request.body ?? {});
    response.json(category);
  } catch (error) {
    next(error);
  }
});

app.get("/api/spending", async (_request, response, next) => {
  try {
    const spending = await listSpendingByCategory();
    response.json({ spending });
  } catch (error) {
    next(error);
  }
});

app.get("/api/insights", async (_request, response, next) => {
  try {
    const insights = await listInsights();
    response.json({ insights });
  } catch (error) {
    next(error);
  }
});

app.get("/api/banks", async (_request, response, next) => {
  try {
    const banks = await listBanks();
    response.json({ banks });
  } catch (error) {
    next(error);
  }
});

app.post("/api/banks", async (request, response, next) => {
  try {
    const bank = await createBankConnection(request.body ?? {});
    response.status(201).json(bank);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/banks/:id", async (request, response, next) => {
  try {
    const bankConnectionId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(bankConnectionId)) {
      response.status(400).json({ error: "invalid_bank_connection_id" });
      return;
    }

    const bank = await updateBankConnection(bankConnectionId, request.body ?? {});
    response.json(bank);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/banks/:id", async (request, response, next) => {
  try {
    const bankConnectionId = Number.parseInt(request.params.id, 10);

    if (!Number.isInteger(bankConnectionId)) {
      response.status(400).json({ error: "invalid_bank_connection_id" });
      return;
    }

    await deleteBankConnection(bankConnectionId);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/chat/messages", async (request, response, next) => {
  try {
    const limit = Number.parseInt(request.query.limit ?? "20", 10);
    const messages = await listChatMessages(Number.isNaN(limit) ? 20 : limit);
    response.json({ messages });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat/messages", async (request, response, next) => {
  try {
    const message = request.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      response.status(400).json({
        error: "message is required",
      });
      return;
    }

    const reply = await createChatReply(message.trim());
    response.status(201).json(reply);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);

  const message = error?.message ?? "The backend failed while processing the request.";
  const lowerMessage = String(message).toLowerCase();
  const status = lowerMessage.includes("not found")
    ? 404
    : lowerMessage.includes("required") ||
        lowerMessage.includes("invalid") ||
        lowerMessage.includes("expirou") ||
        lowerMessage.includes("no maximo") ||
        lowerMessage.includes("lista de linhas") ||
        lowerMessage.includes("nao pertencem") ||
        lowerMessage.includes("nao foi possivel identificar")
      ? 400
      : 500;

  response.status(status).json({
    error: "internal_server_error",
    message:
      process.env.NODE_ENV === "development"
        ? message
        : "The backend failed while processing the request.",
  });
});

const server = app.listen(port, () => {
  console.log(`Finance backend listening on http://localhost:${port}`);
});

async function start() {
  await initializeDatabase();
}

function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
