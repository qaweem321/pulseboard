import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { checkResults, dailyStats, incidents, monitors } from "../db/schema";
import { createTestDb } from "../testing/db";
import { createMonitor, resetDb } from "../testing/factories";
import { claimDueMonitors, pruneOldData, recordCheck } from "./scheduler";
import type { CheckOutcome } from "./transition";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(() => resetDb(db));

const ok: CheckOutcome = { ok: true, statusCode: 200, responseMs: 100, error: null };
const fail: CheckOutcome = { ok: false, statusCode: null, responseMs: null, error: "Connection refused" };
const at = (iso: string) => new Date(iso);

describe("claimDueMonitors", () => {
  it("claims due monitors, skips paused and future ones, and schedules the next check", async () => {
    const now = at("2026-10-11T12:00:00Z");
    const due = await createMonitor(db, { intervalSeconds: 30, nextCheckAt: at("2026-10-11T11:59:00Z") });
    await createMonitor(db, { status: "paused", nextCheckAt: at("2026-10-11T11:00:00Z") });
    await createMonitor(db, { nextCheckAt: at("2026-10-11T12:05:00Z") });

    const claimed = await claimDueMonitors(db, 10, now);
    expect(claimed.map((m) => m.id)).toEqual([due.id]);
    expect(claimed[0]!.nextCheckAt).toEqual(at("2026-10-11T12:00:30Z"));
    // Claimed monitors aren't due again until their interval passes.
    expect(await claimDueMonitors(db, 10, now)).toEqual([]);
  });

  it("respects the batch size, oldest first", async () => {
    const now = at("2026-10-11T12:00:00Z");
    const older = await createMonitor(db, { nextCheckAt: at("2026-10-11T11:00:00Z") });
    await createMonitor(db, { nextCheckAt: at("2026-10-11T11:30:00Z") });
    expect((await claimDueMonitors(db, 1, now)).map((m) => m.id)).toEqual([older.id]);
  });
});

describe("recordCheck", () => {
  it("stores the result, updates the monitor and adds to the daily stats", async () => {
    const monitor = await createMonitor(db);
    const recorded = await recordCheck(db, monitor.id, ok, at("2026-10-11T12:00:00Z"));
    await recordCheck(db, monitor.id, { ...ok, responseMs: 300 }, at("2026-10-11T12:01:00Z"));

    expect(recorded?.monitor).toMatchObject({ status: "up", lastResponseMs: 100 });
    expect(await db.select().from(checkResults)).toHaveLength(2);
    expect(await db.select().from(dailyStats)).toEqual([
      { monitorId: monitor.id, day: "2026-10-11", checks: 2, failures: 0, totalResponseMs: 400 },
    ]);
  });

  it("opens one incident at the threshold and resolves it on recovery", async () => {
    const monitor = await createMonitor(db, { status: "up", failureThreshold: 2 });
    expect((await recordCheck(db, monitor.id, fail, at("2026-10-11T12:00:00Z")))?.incident).toBeNull();

    const down = await recordCheck(db, monitor.id, fail, at("2026-10-11T12:01:00Z"));
    expect(down?.transition.event).toBe("down");
    expect(down?.incident).toMatchObject({ cause: "Connection refused", resolvedAt: null });

    await recordCheck(db, monitor.id, fail, at("2026-10-11T12:02:00Z"));
    const up = await recordCheck(db, monitor.id, ok, at("2026-10-11T12:30:00Z"));
    expect(up?.transition.event).toBe("up");
    expect(up?.incident).toMatchObject({ id: down!.incident!.id, resolvedAt: at("2026-10-11T12:30:00Z") });

    expect(await db.select().from(incidents)).toHaveLength(1);
    const [stats] = await db.select().from(dailyStats);
    expect(stats).toMatchObject({ checks: 4, failures: 3 });
  });

  it("drops results for monitors paused or deleted mid-check", async () => {
    const paused = await createMonitor(db, { status: "paused" });
    expect(await recordCheck(db, paused.id, fail)).toBeNull();
    expect(await recordCheck(db, 9999, fail)).toBeNull();
    expect(await db.select().from(checkResults)).toHaveLength(0);
  });

  it("the database refuses a second open incident for the same monitor", async () => {
    const monitor = await createMonitor(db);
    await db.insert(incidents).values({ monitorId: monitor.id, cause: "first" });
    await expect(db.insert(incidents).values({ monitorId: monitor.id, cause: "second" })).rejects.toThrow();
  });
});

test("pruneOldData deletes raw checks past retention but keeps daily stats", async () => {
  const monitor = await createMonitor(db);
  await recordCheck(db, monitor.id, ok, at("2026-09-01T00:00:00Z"));
  await recordCheck(db, monitor.id, ok, at("2026-10-10T00:00:00Z"));
  await pruneOldData(db, 30, at("2026-10-11T00:00:00Z"));

  const remaining = await db.select().from(checkResults).where(eq(checkResults.monitorId, monitor.id));
  expect(remaining.map((r) => r.checkedAt)).toEqual([at("2026-10-10T00:00:00Z")]);
  expect(await db.select().from(dailyStats)).toHaveLength(2);
  expect(await db.select().from(monitors)).toHaveLength(1);
});
