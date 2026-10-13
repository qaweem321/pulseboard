import { and, asc, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import type { Db } from "../db";
import { incidents, incidentUpdates, monitors } from "../db/schema";

export type IncidentWithUpdates = Awaited<ReturnType<typeof listIncidents>>[number];

// Incidents with their monitor and timeline updates, in two queries (not one per incident).
export async function listIncidents(
  db: Db,
  options: { monitorIds?: readonly number[]; since?: Date; limit?: number } = {},
) {
  const { monitorIds, since, limit = 50 } = options;
  if (monitorIds && monitorIds.length === 0) return [];
  const conditions = [
    monitorIds ? inArray(incidents.monitorId, [...monitorIds]) : undefined,
    // Open incidents always show, however old.
    since ? or(gte(incidents.startedAt, since), isNull(incidents.resolvedAt)) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({
      id: incidents.id,
      monitorId: incidents.monitorId,
      monitorName: monitors.name,
      startedAt: incidents.startedAt,
      resolvedAt: incidents.resolvedAt,
      cause: incidents.cause,
    })
    .from(incidents)
    .innerJoin(monitors, eq(monitors.id, incidents.monitorId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(incidents.startedAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const updates = await db
    .select()
    .from(incidentUpdates)
    .where(
      inArray(
        incidentUpdates.incidentId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(incidentUpdates.createdAt));
  return rows.map((row) => ({ ...row, updates: updates.filter((u) => u.incidentId === row.id) }));
}

export async function getIncident(db: Db, id: number) {
  const [row] = await db.select().from(incidents).where(eq(incidents.id, id));
  return row ?? null;
}
