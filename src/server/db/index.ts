import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

// The app runs on node-postgres; tests run the same code on PGlite. Both fit this type.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { pulseboardDb?: Db; pulseboardPool?: Pool };

export function db(): Db {
  if (!globalForDb.pulseboardDb) {
    const pool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
    globalForDb.pulseboardPool = pool;
    globalForDb.pulseboardDb = drizzle(pool, { schema }) as unknown as Db;
  }
  return globalForDb.pulseboardDb;
}

export async function closeDb() {
  await globalForDb.pulseboardPool?.end();
  globalForDb.pulseboardDb = undefined;
  globalForDb.pulseboardPool = undefined;
}

export { schema };
