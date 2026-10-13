import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, db } from "@/server/db";

// Applies pending migrations. Safe to run on every deploy: applied ones are skipped.
const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

try {
  await migrate(db() as Parameters<typeof migrate>[0], { migrationsFolder });
  console.log("Migrations applied");
} finally {
  await closeDb();
}
