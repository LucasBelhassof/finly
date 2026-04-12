import dotenv from "dotenv";
import pg from "pg";

import { runSeedData } from "./seed-data.js";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run db:seed.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  await runSeedData(pool);
  console.log("Financial seed completed.");
} finally {
  await pool.end();
}
