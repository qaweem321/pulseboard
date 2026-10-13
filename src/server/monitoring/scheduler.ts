import { and, asc, eq, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  checkResults,
  dailyStats,
  incidents,
  monitors,
  sessions,
  type Incident,
  type Monitor,
} from "../db/schema";
import { nextState, type CheckOutcome, type Transition } from "./transition";

// Claims up to `limit` due monitors and pushes their next check into the future in one statement.
// SKIP LOCKED lets several workers run side by side without checking the same monitor twice.
export async function claimDueMonitors(db: Db, limit: number, now = new Date()): Promise<Monitor[]> {
  const due = db
    .select({ id: monitors.id })
    .from(monitors)
    .where(and(ne(monitors.status, "paused"), lte(monitors.nextCheckAt, now)))
    .orderBy(asc(monitors.nextCheckAt))
    .limit(limit)
    .for("update", { skipLocked: true });
  return db
    .update(monitors)
    .set({
      nextCheckAt: sql`${now.toISOString()}::timestamptz + make_interval(secs => ${monitors.intervalSeconds})`,
    })
    .where(inArray(monitors.id, due))
    .returning();
}

export type RecordedCheck = {
  monitor: Monitor;
  transition: Transition;
  incident: Incident | null;
};

// Stores one check result and applies the state change atomically. The monitor row is locked so a
// concurrent edit (pause, threshold change) can't interleave with the state machine.
export async function recordCheck(
  db: Db,
  monitorId: number,
  outcome: CheckOutcome,
  at = new Date(),
): Promise<RecordedCheck | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(monitors).where(eq(monitors.id, monitorId)).for("update");
    // Deleted or paused while the request was in flight: drop the result.
    if (!current || current.status === "paused") return null;
    const transition = nextState(current, outcome);
    const day = at.toISOString().slice(0, 10);
    const [[monitor]] = await Promise.all([
      tx
        .update(monitors)
        .set({
          status: transition.status,
          consecutiveFailures: transition.consecutiveFailures,
          lastCheckedAt: at,
          lastResponseMs: outcome.responseMs,
          lastError: outcome.error,
        })
        .where(eq(monitors.id, monitorId))
        .returning(),
      tx.insert(checkResults).values({
        monitorId,
        checkedAt: at,
        ok: outcome.ok,
        statusCode: outcome.statusCode,
        responseMs: outcome.responseMs,
        error: outcome.error,
      }),
      tx
        .insert(dailyStats)
        .values({
          monitorId,
          day,
          checks: 1,
          failures: outcome.ok ? 0 : 1,
          totalResponseMs: outcome.responseMs ?? 0,
        })
        .onConflictDoUpdate({
          target: [dailyStats.monitorId, dailyStats.day],
          set: {
            checks: sql`${dailyStats.checks} + 1`,
            failures: sql`${dailyStats.failures} + ${outcome.ok ? 0 : 1}`,
            totalResponseMs: sql`${dailyStats.totalResponseMs} + ${outcome.responseMs ?? 0}`,
          },
        }),
    ]);
    let incident: Incident | null = null;
    if (transition.event === "down") {
      [incident = null] = await tx
        .insert(incidents)
        .values({ monitorId, startedAt: at, cause: outcome.error ?? "Check failed" })
        .onConflictDoNothing()
        .returning();
    } else if (transition.event === "up") {
      [incident = null] = await tx
        .update(incidents)
        .set({ resolvedAt: at })
        .where(and(eq(incidents.monitorId, monitorId), isNull(incidents.resolvedAt)))
        .returning();
    }
    return { monitor: monitor!, transition, incident };
  });
}

// Raw checks are kept for `retentionDays`; daily_stats keeps the long-term history.
export async function pruneOldData(db: Db, retentionDays: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  await Promise.all([
    db.delete(checkResults).where(lt(checkResults.checkedAt, cutoff)),
    db.delete(sessions).where(lt(sessions.expiresAt, now)),
  ]);
}
