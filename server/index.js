import cors from "cors";
import express from "express";

import {
  createChatReply,
  getDashboardData,
  initializeDatabase,
  listBanks,
  listChatMessages,
  listInsights,
  listRecentTransactions,
  listSpendingByCategory,
  pingDatabase,
} from "./database.js";

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
    const limit = Number.parseInt(request.query.limit ?? "8", 10);
    const transactions = await listRecentTransactions(Number.isNaN(limit) ? 8 : limit);
    response.json({ transactions });
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

  response.status(500).json({
    error: "internal_server_error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
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
