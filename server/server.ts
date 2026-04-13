import { createApp } from "./app.js";
import { closeDatabase, initializeDatabase } from "./database.js";
import { closeSharedDatabase } from "./shared/db.js";
import { env } from "./shared/env.js";

export async function startServer() {
  await initializeDatabase();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Finly backend listening on http://localhost:${env.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down...`);

    server.close(async () => {
      await Promise.allSettled([closeDatabase(), closeSharedDatabase()]);
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  return server;
}

const currentModulePath = new URL(import.meta.url).pathname;
const currentProcessPath = process.argv[1] ? process.argv[1].replaceAll("\\", "/") : "";

if (currentProcessPath && currentModulePath.endsWith(currentProcessPath)) {
  startServer().catch((error) => {
    console.error("Failed to start backend", error);
    process.exit(1);
  });
}
