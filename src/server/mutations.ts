import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import type {
  alertChannelInput,
  incidentUpdateInput,
  monitorInput,
  monitorPatch,
  statusPageInput,
} from "@/lib/validation";
import type { Db } from "./db";
import {
  alertChannels,
  incidents,
  incidentUpdates,
  monitors,
  statusPageMonitors,
  statusPages,
} from "./db/schema";

type Out<T extends z.ZodType> = z.output<T>;

export async function createMonitor(db: Db, values: Out<typeof monitorInput>) {
  const [monitor] = await db.insert(monitors).values(values).returning();
  return monitor!;
}

// Pausing closes any open incident (nobody wants an alert storm about planned maintenance).
// Resuming starts over as "pending" and checks right away.
export async function updateMonitor(db: Db, id: number, patch: Out<typeof monitorPatch>, now = new Date()) {
  const { paused, ...fields } = patch;
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(monitors).where(eq(monitors.id, id)).for("update");
    if (!current) return null;
    const state: Partial<typeof monitors.$inferInsert> = {};
    if (paused === true && current.status !== "paused") {
      Object.assign(state, { status: "paused", consecutiveFailures: 0 });
      await tx
        .update(incidents)
        .set({ resolvedAt: now })
        .where(and(eq(incidents.monitorId, id), isNull(incidents.resolvedAt)));
    } else if (paused === false && current.status === "paused") {
      Object.assign(state, { status: "pending", consecutiveFailures: 0, nextCheckAt: now });
    }
    const [monitor] = await tx
      .update(monitors)
      .set({ ...fields, ...state, updatedAt: now })
      .where(eq(monitors.id, id))
      .returning();
    return monitor ?? null;
  });
}

export async function deleteMonitor(db: Db, id: number) {
  const deleted = await db.delete(monitors).where(eq(monitors.id, id)).returning({ id: monitors.id });
  return deleted.length > 0;
}

export async function addIncidentUpdate(
  db: Db,
  incidentId: number,
  values: Out<typeof incidentUpdateInput>,
  authorName: string,
) {
  const [update] = await db
    .insert(incidentUpdates)
    .values({ incidentId, ...values, authorName })
    .returning();
  return update!;
}

export class SlugTakenError extends Error {}

// Saves a page and its monitor list together; the order of monitorIds is the display order.
export async function saveStatusPage(db: Db, id: number | null, values: Out<typeof statusPageInput>) {
  const { monitorIds, ...page } = values;
  try {
    return await db.transaction(async (tx) => {
      const [saved] = id
        ? await tx.update(statusPages).set(page).where(eq(statusPages.id, id)).returning()
        : await tx.insert(statusPages).values(page).returning();
      if (!saved) return null;
      await tx.delete(statusPageMonitors).where(eq(statusPageMonitors.pageId, saved.id));
      const unique = [...new Set(monitorIds)];
      if (unique.length > 0) {
        await tx
          .insert(statusPageMonitors)
          .values(unique.map((monitorId, position) => ({ pageId: saved.id, monitorId, position })));
      }
      return { ...saved, monitorIds: unique };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new SlugTakenError("That address is already used by another page.");
    throw error;
  }
}

export async function deleteStatusPage(db: Db, id: number) {
  const deleted = await db
    .delete(statusPages)
    .where(eq(statusPages.id, id))
    .returning({ id: statusPages.id });
  return deleted.length > 0;
}

export async function saveAlertChannel(db: Db, id: number | null, values: Out<typeof alertChannelInput>) {
  const [saved] = id
    ? await db.update(alertChannels).set(values).where(eq(alertChannels.id, id)).returning()
    : await db.insert(alertChannels).values(values).returning();
  return saved ?? null;
}

export async function deleteAlertChannel(db: Db, id: number) {
  const deleted = await db
    .delete(alertChannels)
    .where(eq(alertChannels.id, id))
    .returning({ id: alertChannels.id });
  return deleted.length > 0;
}

function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}
