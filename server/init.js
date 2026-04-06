import { closeDatabase, initializeDatabase } from "./database.js";

await initializeDatabase();
console.log("Database initialized and seed applied.");
await closeDatabase();
