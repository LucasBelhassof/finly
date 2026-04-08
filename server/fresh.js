import dotenv from "dotenv";
import pg from "pg";

import { runMigrations } from "./migrations.js";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run db:fresh.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetPublicSchema() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

try {
  await resetPublicSchema();
  await runMigrations(pool);
  console.log("Database schema reset completed and migrations reapplied.");
} finally {
  await pool.end();
}
