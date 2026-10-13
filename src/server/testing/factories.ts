import { sql } from "drizzle-orm";
import type { Db } from "../db";
import { monitors, type NewMonitor } from "../db/schema";

export async function resetDb(db: Db) {
  await db.execute(
    sql`truncate monitors, check_results, daily_stats, incidents, incident_updates, status_pages,
        status_page_monitors, alert_channels, alert_deliveries, users, sessions restart identity cascade`,
  );
}

export async function createMonitor(db: Db, values: Partial<NewMonitor> = {}) {
  const [monitor] = await db
    .insert(monitors)
    .values({ name: "Example", url: "https://example.com", ...values })
    .returning();
  return monitor!;
}
