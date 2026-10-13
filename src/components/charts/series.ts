import type { ResponsePoint } from "@/server/queries/monitors";

export type ChartPoint = ResponsePoint & { date: Date };

// The database only returns buckets that had checks. Fill the gaps with empty buckets so the line
// breaks where there was no data instead of drawing a straight line across it.
// Buckets are aligned to the Unix epoch, matching date_bin(..., 'epoch') in SQL.
export function fillBuckets(
  points: readonly ResponsePoint[],
  from: string,
  to: string,
  bucketMs: number,
): ChartPoint[] {
  const byTime = new Map(points.map((p) => [new Date(p.t).getTime(), p]));
  const start = Math.floor(new Date(from).getTime() / bucketMs) * bucketMs;
  const end = new Date(to).getTime();
  const filled: ChartPoint[] = [];
  for (let t = start; t <= end; t += bucketMs) {
    const point = byTime.get(t);
    filled.push(
      point
        ? { ...point, date: new Date(t) }
        : {
            t: new Date(t).toISOString(),
            avgMs: null,
            maxMs: null,
            checks: 0,
            failures: 0,
            date: new Date(t),
          },
    );
  }
  return filled;
}

export function seriesStats(points: readonly ResponsePoint[]) {
  let weighted = 0;
  let checks = 0;
  let failures = 0;
  let max: number | null = null;
  for (const p of points) {
    checks += p.checks;
    failures += p.failures;
    if (p.avgMs !== null) weighted += p.avgMs * p.checks;
    if (p.maxMs !== null) max = Math.max(max ?? 0, p.maxMs);
  }
  return { avgMs: checks ? Math.round(weighted / checks) : null, maxMs: max, checks, failures };
}
