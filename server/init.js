import { closeDatabase, initializeDatabase } from "./database.js";

await initializeDatabase();
console.log("Database migrations applied and database ready.");
await closeDatabase();
