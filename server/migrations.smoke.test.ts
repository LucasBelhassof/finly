// @vitest-environment node
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const { Pool } = pg;

const REQUIRED_TABLES = [
  "users",
  "transactions",
  "categories",
  "bank_connections",
  "auth_sessions",
  "auth_audit_events",
];

describe("migrations smoke test", () => {
  const databaseUrl = process.env.DATABASE_URL;
  const isCI = Boolean(process.env.CI);

  if (!databaseUrl || !isCI) {
    it.skip("skipped — only runs in CI with PostgreSQL service", () => {});
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });

  afterAll(async () => {
    await pool.end();
  });

  it("all required tables exist after migrations", async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'`,
    );

    const existingTables = result.rows.map((row) => row.table_name);

    for (const table of REQUIRED_TABLES) {
      expect(existingTables, `table "${table}" should exist`).toContain(table);
    }
  });
});
