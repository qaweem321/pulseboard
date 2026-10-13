import { fillBuckets, seriesStats } from "./series";

const point = (t: string, avgMs: number, checks = 1, failures = 0) => ({
  t,
  avgMs,
  maxMs: avgMs,
  checks,
  failures,
});

test("fillBuckets adds empty buckets between data points, aligned to the epoch", () => {
  const filled = fillBuckets(
    [point("2026-10-11T10:00:00.000Z", 100), point("2026-10-11T10:30:00.000Z", 200)],
    "2026-10-11T09:55:00.000Z",
    "2026-10-11T10:35:00.000Z",
    10 * 60_000,
  );
  expect(filled.map((p) => [p.t.slice(11, 16), p.avgMs])).toEqual([
    ["09:50", null],
    ["10:00", 100],
    ["10:10", null],
    ["10:20", null],
    ["10:30", 200],
  ]);
});

test("seriesStats weights the average by the number of checks", () => {
  expect(seriesStats([point("a", 100, 3), point("b", 400, 1, 1)])).toEqual({
    avgMs: 175,
    maxMs: 400,
    checks: 4,
    failures: 1,
  });
  expect(seriesStats([])).toEqual({ avgMs: null, maxMs: null, checks: 0, failures: 0 });
});
