import { sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  checkResults,
  dailyStats,
  incidents,
  incidentUpdates,
  monitors,
  statusPageMonitors,
  statusPages,
  type NewMonitor,
} from "./db/schema";

const DAY = 86_400_000;
const RAW_STEP = 10 * 60_000;

type DemoMonitor = NewMonitor & {
  baseMs: number;
  // Synthetic outages: [days ago, duration in minutes, cause].
  outages: Array<[number, number, string]>;
};

// Real, public URLs, so the worker keeps the demo alive after seeding. The history before "now" is
// synthetic, generated so the charts have something to show on day one.
const DEMO: DemoMonitor[] = [
  {
    name: "Marketing site",
    url: "https://example.com",
    keyword: "Example Domain",
    baseMs: 120,
    outages: [[41, 25, "Unexpected status 502"]],
  },
  {
    name: "Public API",
    url: "https://httpbin.org/status/200",
    baseMs: 340,
    outages: [
      [12, 95, "Connection timed out"],
      [3, 18, "Unexpected status 503"],
    ],
  },
  { name: "Docs", url: "https://www.wikipedia.org", keyword: "Wikipedia", baseMs: 210, outages: [] },
  {
    name: "Payments webhook",
    url: "https://httpbin.org/status/503",
    baseMs: 280,
    failureThreshold: 1,
    outages: [[66, 240, "Connection refused"]],
  },
  { name: "Legacy admin", url: "https://example.org", status: "paused", baseMs: 400, outages: [] },
];

// Deterministic noise, so seeding twice gives the same charts.
function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43_758.5453;
  return x - Math.floor(x);
}

function isDown(outages: DemoMonitor["outages"], now: number, t: number) {
  return outages.find(([daysAgo, minutes]) => {
    const start = now - daysAgo * DAY;
    return t >= start && t < start + minutes * 60_000;
  });
}

export async function hasMonitors(db: Db) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(monitors);
  return (row?.n ?? 0) > 0;
}

export async function seedDemo(db: Db, now = new Date()) {
  const end = now.getTime();
  const created = await db
    .insert(monitors)
    .values(DEMO.map(({ baseMs: _b, outages: _o, ...m }) => ({ ...m, intervalSeconds: 60 })))
    .returning();

  const raw: (typeof checkResults.$inferInsert)[] = [];
  const daily: (typeof dailyStats.$inferInsert)[] = [];
  const incidentRows: (typeof incidents.$inferInsert)[] = [];

  created.forEach((monitor, index) => {
    const demo = DEMO[index]!;
    // 30 days of raw checks every 10 minutes for the response-time chart.
    for (let t = end - 30 * DAY; t < end; t += RAW_STEP) {
      const outage = isDown(demo.outages, end, t);
      const hour = new Date(t).getUTCHours();
      const ms = Math.round(
        demo.baseMs * (1 + 0.35 * Math.sin((hour / 24) * Math.PI * 2)) + noise(t) * demo.baseMs * 0.6,
      );
      raw.push({
        monitorId: monitor.id,
        checkedAt: new Date(t),
        ok: !outage,
        statusCode: outage?.[2].startsWith("Unexpected status")
          ? Number(outage[2].slice(-3))
          : outage
            ? null
            : 200,
        responseMs: outage && !outage[2].startsWith("Unexpected") ? null : ms,
        error: outage ? outage[2] : null,
      });
    }
    // 90 days of daily rollups, as if checked every minute.
    for (let d = 89; d >= 1; d--) {
      const dayStart = Math.floor((end - d * DAY) / DAY) * DAY;
      const failures = demo.outages
        .filter(([daysAgo]) => Math.floor((end - daysAgo * DAY) / DAY) * DAY === dayStart)
        .reduce((sum, [, minutes]) => sum + minutes, 0);
      daily.push({
        monitorId: monitor.id,
        day: new Date(dayStart).toISOString().slice(0, 10),
        checks: 1440,
        failures,
        totalResponseMs: 1440 * demo.baseMs,
      });
    }
    for (const [daysAgo, minutes, cause] of demo.outages) {
      const startedAt = new Date(end - daysAgo * DAY);
      incidentRows.push({
        monitorId: monitor.id,
        startedAt,
        resolvedAt: new Date(startedAt.getTime() + minutes * 60_000),
        cause,
      });
    }
  });

  // Bulk inserts in chunks: a few round trips instead of one per row.
  for (let i = 0; i < raw.length; i += 2000) await db.insert(checkResults).values(raw.slice(i, i + 2000));
  await db.insert(dailyStats).values(daily);
  const savedIncidents = await db.insert(incidents).values(incidentRows).returning();

  const longest = savedIncidents.find((i) => i.cause === "Connection timed out");
  if (longest) {
    const at = (minutes: number) => new Date(longest.startedAt.getTime() + minutes * 60_000);
    await db.insert(incidentUpdates).values([
      {
        incidentId: longest.id,
        status: "investigating",
        message: "API requests are timing out. We're looking into it.",
        authorName: "Demo Admin",
        createdAt: at(8),
      },
      {
        incidentId: longest.id,
        status: "identified",
        message: "A database failover left the API with stale connections. Restarting the API pods.",
        authorName: "Demo Admin",
        createdAt: at(40),
      },
      {
        incidentId: longest.id,
        status: "resolved",
        message: "All requests are succeeding again. We're adding connection health checks to prevent this.",
        authorName: "Demo Admin",
        createdAt: at(100),
      },
    ]);
  }

  const [page] = await db
    .insert(statusPages)
    .values({ slug: "demo", title: "Acme Cloud", description: "Live status of Acme Cloud services." })
    .returning();
  const shown = created.filter((m) => m.status !== "paused" && m.name !== "Payments webhook");
  await db
    .insert(statusPageMonitors)
    .values(shown.map((m, position) => ({ pageId: page!.id, monitorId: m.id, position })));

  return { monitors: created.length, checks: raw.length, incidents: savedIncidents.length };
}
