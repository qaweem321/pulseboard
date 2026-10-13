import type { Db } from "../db";
import { incidents } from "../db/schema";
import { recordCheck } from "../monitoring/scheduler";
import {
  addIncidentUpdate,
  deleteMonitor,
  saveStatusPage,
  SlugTakenError,
  updateMonitor,
} from "../mutations";
import { createTestDb } from "../testing/db";
import { createMonitor, resetDb } from "../testing/factories";
import { listIncidents } from "./incidents";
import { listMonitorSummaries, monitorDetail, responseSeries } from "./monitors";
import { publicStatusPage } from "./status-pages";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
beforeEach(() => resetDb(db));

const now = new Date("2026-10-11T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const ok = (ms: number) => ({ ok: true, statusCode: 200, responseMs: ms, error: null });
const fail = { ok: false, statusCode: 500, responseMs: 50, error: "Unexpected status 500" };

describe("listMonitorSummaries", () => {
  it("returns uptime and an hourly sparkline per monitor", async () => {
    const api = await createMonitor(db, { name: "API" });
    const web = await createMonitor(db, { name: "Web" });
    await recordCheck(db, api.id, ok(100), minutesAgo(90));
    await recordCheck(db, api.id, ok(300), minutesAgo(80));
    await recordCheck(db, api.id, fail, minutesAgo(10));
    await recordCheck(db, api.id, ok(200), minutesAgo(25 * 60)); // older than 24h

    const [apiSummary, webSummary] = await listMonitorSummaries(db, now);
    expect(apiSummary).toMatchObject({
      name: "API",
      uptime24h: { checks: 3, failures: 1 },
      uptime30d: { checks: 4, failures: 1 },
    });
    expect(apiSummary!.sparkline).toEqual([
      { t: "2026-10-11T10:00:00.000Z", ms: 200 },
      { t: "2026-10-11T11:00:00.000Z", ms: 50 },
    ]);
    expect(webSummary).toMatchObject({ name: "Web", uptime24h: { checks: 0 }, sparkline: [] });
    expect(web.id).toBe(webSummary!.id);
  });
});

test("responseSeries buckets checks for the chosen range", async () => {
  const monitor = await createMonitor(db);
  await recordCheck(db, monitor.id, ok(100), new Date("2026-10-11T11:01:00Z"));
  await recordCheck(db, monitor.id, ok(300), new Date("2026-10-11T11:05:00Z"));
  await recordCheck(db, monitor.id, fail, new Date("2026-10-11T11:15:00Z"));
  const series = await responseSeries(db, monitor.id, "24h", now);
  expect(series.bucketMs).toBe(600_000);
  expect(series.points).toEqual([
    { t: "2026-10-11T11:00:00.000Z", avgMs: 200, maxMs: 300, checks: 2, failures: 0 },
    { t: "2026-10-11T11:10:00.000Z", avgMs: 50, maxMs: 50, checks: 1, failures: 1 },
  ]);
});

test("monitorDetail loads everything in parallel and returns null for unknown ids", async () => {
  const monitor = await createMonitor(db, { failureThreshold: 1 });
  await recordCheck(db, monitor.id, fail, minutesAgo(5));
  const detail = await monitorDetail(db, monitor.id, now);
  expect(detail?.bars).toHaveLength(90);
  expect(detail?.bars.at(-1)).toEqual({ day: "2026-10-11", checks: 1, failures: 1 });
  expect(detail?.incidents).toHaveLength(1);
  expect(detail?.checks).toHaveLength(1);
  expect(await monitorDetail(db, 999, now)).toBeNull();
});

describe("updateMonitor", () => {
  it("pausing resolves the open incident; resuming re-checks right away", async () => {
    const monitor = await createMonitor(db, { failureThreshold: 1 });
    await recordCheck(db, monitor.id, fail, minutesAgo(5));
    const paused = await updateMonitor(db, monitor.id, { paused: true }, now);
    expect(paused).toMatchObject({ status: "paused", consecutiveFailures: 0 });
    expect((await db.select().from(incidents))[0]?.resolvedAt).toEqual(now);

    const resumed = await updateMonitor(db, monitor.id, { paused: false, name: "Renamed" }, now);
    expect(resumed).toMatchObject({ status: "pending", name: "Renamed", nextCheckAt: now });
  });

  it("returns null for a missing monitor", async () => {
    expect(await updateMonitor(db, 404, { name: "x" })).toBeNull();
    expect(await deleteMonitor(db, 404)).toBe(false);
  });
});

describe("status pages", () => {
  it("public pages hide URLs and causes, keep monitor order, and 404 when unpublished", async () => {
    const api = await createMonitor(db, {
      name: "API",
      url: "https://internal.example.com",
      failureThreshold: 1,
    });
    const web = await createMonitor(db, { name: "Web" });
    await recordCheck(db, api.id, fail, minutesAgo(5));
    const page = await saveStatusPage(db, null, {
      title: "Acme",
      slug: "acme",
      description: "",
      published: true,
      monitorIds: [web.id, api.id, web.id],
    });
    expect(page?.monitorIds).toEqual([web.id, api.id]);

    const data = await publicStatusPage(db, "acme", now);
    expect(data?.monitors.map((m) => [m.name, m.status])).toEqual([
      ["Web", "pending"],
      ["API", "down"],
    ]);
    expect(JSON.stringify(data)).not.toContain("internal.example.com");
    expect(JSON.stringify(data)).not.toContain("Unexpected status");
    expect(data?.incidents).toHaveLength(1);

    await saveStatusPage(db, page!.id, { ...page!, published: false });
    expect(await publicStatusPage(db, "acme", now)).toBeNull();
  });

  it("refuses a slug that is already taken", async () => {
    const values = { title: "A", slug: "same", description: "", published: true, monitorIds: [] };
    await saveStatusPage(db, null, values);
    await expect(saveStatusPage(db, null, values)).rejects.toBeInstanceOf(SlugTakenError);
  });
});

test("listIncidents attaches updates in order", async () => {
  const monitor = await createMonitor(db, { name: "API", failureThreshold: 1 });
  const recorded = await recordCheck(db, monitor.id, fail, minutesAgo(30));
  const incidentId = recorded!.incident!.id;
  await addIncidentUpdate(db, incidentId, { status: "investigating", message: "Looking" }, "Ada");
  await addIncidentUpdate(db, incidentId, { status: "identified", message: "Bad deploy" }, "Ada");
  const [incident] = await listIncidents(db);
  expect(incident).toMatchObject({ monitorName: "API", resolvedAt: null });
  expect(incident?.updates.map((u) => u.status)).toEqual(["investigating", "identified"]);
});
