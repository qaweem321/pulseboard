import type { Db } from "./db";
import { hasMonitors, seedDemo } from "./demo-seed";
import { publicStatusPage } from "./queries/status-pages";
import { listMonitorSummaries } from "./queries/monitors";
import { createTestDb } from "./testing/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

test("the demo seed fills every chart and the demo status page", async () => {
  const now = new Date("2026-10-11T12:00:00Z");
  expect(await hasMonitors(db)).toBe(false);
  expect(await seedDemo(db, now)).toEqual({ monitors: 5, checks: 5 * 4320, incidents: 4 });
  expect(await hasMonitors(db)).toBe(true);

  const summaries = await listMonitorSummaries(db, now);
  expect(summaries.find((m) => m.name === "Docs")?.uptime30d).toEqual({ checks: 29 * 1440, failures: 0 });

  const page = await publicStatusPage(db, "demo", now);
  expect(page?.monitors.map((m) => m.name)).toEqual(["Marketing site", "Public API", "Docs"]);
  expect(page?.incidents.some((i) => i.updates.length === 3)).toBe(true);
}, 30_000);
