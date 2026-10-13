import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { fillDays, type DayStat } from "@/lib/uptime";
import type { Range } from "@/lib/validation";
import type { Db } from "../db";
import { checkResults, dailyStats, incidents, monitors, type Monitor } from "../db/schema";

const DAY = 86_400_000;

export type SparkPoint = { t: string; ms: number | null };

export type MonitorSummary = Pick<
  Monitor,
  | "id"
  | "name"
  | "url"
  | "method"
  | "status"
  | "intervalSeconds"
  | "lastCheckedAt"
  | "lastResponseMs"
  | "lastError"
> & {
  uptime24h: { checks: number; failures: number };
  uptime30d: { checks: number; failures: number };
  sparkline: SparkPoint[];
};

// The dashboard list: three independent queries in parallel instead of one per monitor.
export async function listMonitorSummaries(db: Db, now = new Date()): Promise<MonitorSummary[]> {
  const dayAgo = new Date(now.getTime() - DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10);
  const [rows, last24h, last30d, spark] = await Promise.all([
    db.select().from(monitors).orderBy(asc(monitors.name)),
    db
      .select({
        monitorId: checkResults.monitorId,
        checks: sql<number>`count(*)::int`,
        failures: sql<number>`count(*) filter (where not ${checkResults.ok})::int`,
      })
      .from(checkResults)
      .where(gte(checkResults.checkedAt, dayAgo))
      .groupBy(checkResults.monitorId),
    db
      .select({
        monitorId: dailyStats.monitorId,
        checks: sql<number>`sum(${dailyStats.checks})::int`,
        failures: sql<number>`sum(${dailyStats.failures})::int`,
      })
      .from(dailyStats)
      .where(gte(dailyStats.day, monthAgo))
      .groupBy(dailyStats.monitorId),
    db
      .select({
        monitorId: checkResults.monitorId,
        t: sql<string>`date_bin('1 hour', ${checkResults.checkedAt}, 'epoch'::timestamptz)`,
        ms: sql<number | null>`avg(${checkResults.responseMs})::int`,
      })
      .from(checkResults)
      .where(gte(checkResults.checkedAt, dayAgo))
      .groupBy(checkResults.monitorId, sql`2`)
      .orderBy(sql`2`),
  ]);
  const empty = { checks: 0, failures: 0 };
  const by24h = new Map(last24h.map((r) => [r.monitorId, { checks: r.checks, failures: r.failures }]));
  const by30d = new Map(last30d.map((r) => [r.monitorId, { checks: r.checks, failures: r.failures }]));
  const sparkByMonitor = new Map<number, SparkPoint[]>();
  for (const point of spark) {
    const list = sparkByMonitor.get(point.monitorId) ?? [];
    list.push({ t: new Date(point.t).toISOString(), ms: point.ms });
    sparkByMonitor.set(point.monitorId, list);
  }
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    url: m.url,
    method: m.method,
    status: m.status,
    intervalSeconds: m.intervalSeconds,
    lastCheckedAt: m.lastCheckedAt,
    lastResponseMs: m.lastResponseMs,
    lastError: m.lastError,
    uptime24h: by24h.get(m.id) ?? empty,
    uptime30d: by30d.get(m.id) ?? empty,
    sparkline: sparkByMonitor.get(m.id) ?? [],
  }));
}

export async function getMonitor(db: Db, id: number) {
  const [monitor] = await db.select().from(monitors).where(eq(monitors.id, id));
  return monitor ?? null;
}

// 90-day bars for several monitors in one query.
export async function dailyBars(
  db: Db,
  monitorIds: readonly number[],
  days = 90,
  now = new Date(),
): Promise<Map<number, DayStat[]>> {
  const result = new Map<number, DayStat[]>();
  if (monitorIds.length === 0) return result;
  const since = new Date(now.getTime() - (days - 1) * DAY).toISOString().slice(0, 10);
  const rows = await db
    .select({
      monitorId: dailyStats.monitorId,
      day: dailyStats.day,
      checks: dailyStats.checks,
      failures: dailyStats.failures,
    })
    .from(dailyStats)
    .where(and(inArray(dailyStats.monitorId, [...monitorIds]), gte(dailyStats.day, since)));
  const byMonitor = new Map<number, DayStat[]>();
  for (const { monitorId, ...stat } of rows) {
    const list = byMonitor.get(monitorId) ?? [];
    list.push(stat);
    byMonitor.set(monitorId, list);
  }
  for (const id of monitorIds) result.set(id, fillDays(byMonitor.get(id) ?? [], days, now));
  return result;
}

export type ResponsePoint = {
  t: string;
  avgMs: number | null;
  maxMs: number | null;
  checks: number;
  failures: number;
};

// Buckets keep every range around 150-180 points, however many raw checks there are.
const RANGE_BUCKETS: Record<Range, { span: number; bucket: string; bucketMs: number }> = {
  "24h": { span: DAY, bucket: "10 minutes", bucketMs: 10 * 60_000 },
  "7d": { span: 7 * DAY, bucket: "1 hour", bucketMs: 3_600_000 },
  "30d": { span: 30 * DAY, bucket: "4 hours", bucketMs: 4 * 3_600_000 },
};

export async function responseSeries(db: Db, monitorId: number, range: Range, now = new Date()) {
  const { span, bucket, bucketMs } = RANGE_BUCKETS[range];
  const since = new Date(now.getTime() - span);
  const rows = await db
    .select({
      t: sql<string>`date_bin(${bucket}::interval, ${checkResults.checkedAt}, 'epoch'::timestamptz)`,
      avgMs: sql<number | null>`avg(${checkResults.responseMs})::int`,
      maxMs: sql<number | null>`max(${checkResults.responseMs})`,
      checks: sql<number>`count(*)::int`,
      failures: sql<number>`count(*) filter (where not ${checkResults.ok})::int`,
    })
    .from(checkResults)
    .where(and(eq(checkResults.monitorId, monitorId), gte(checkResults.checkedAt, since)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const points: ResponsePoint[] = rows.map((r) => ({ ...r, t: new Date(r.t).toISOString() }));
  return { range, bucketMs, from: since.toISOString(), to: now.toISOString(), points };
}

export async function recentChecks(db: Db, monitorId: number, limit = 20) {
  return db
    .select()
    .from(checkResults)
    .where(eq(checkResults.monitorId, monitorId))
    .orderBy(desc(checkResults.checkedAt))
    .limit(limit);
}

export async function monitorIncidents(db: Db, monitorId: number, limit = 10) {
  return db
    .select()
    .from(incidents)
    .where(eq(incidents.monitorId, monitorId))
    .orderBy(desc(incidents.startedAt))
    .limit(limit);
}

export async function monitorDetail(db: Db, id: number, now = new Date()) {
  const [monitor, bars, checks, incidentList] = await Promise.all([
    getMonitor(db, id),
    dailyBars(db, [id], 90, now),
    recentChecks(db, id),
    monitorIncidents(db, id),
  ]);
  if (!monitor) return null;
  return { monitor, bars: bars.get(id) ?? [], checks, incidents: incidentList };
}
