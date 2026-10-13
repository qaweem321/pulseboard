export type DayStat = { day: string; checks: number; failures: number };

// Truncates instead of rounding: 99.996% shows as 99.99%, never as a misleading 100%.
export function uptimePercent(checks: number, failures: number): number | null {
  if (checks === 0) return null;
  return Math.floor(((checks - failures) / checks) * 10_000) / 100;
}

export function formatUptime(value: number | null): string {
  return value === null ? "No data" : `${value.toFixed(2)}%`;
}

export type DayLevel = "none" | "ok" | "degraded" | "outage";

export function dayLevel({ checks, failures }: DayStat): DayLevel {
  if (checks === 0) return "none";
  if (failures === 0) return "ok";
  return (uptimePercent(checks, failures) ?? 0) >= 99 ? "degraded" : "outage";
}

// The last `days` UTC days ending today, oldest first, with empty days filled in.
export function fillDays(stats: readonly DayStat[], days: number, now = new Date()): DayStat[] {
  const byDay = new Map(stats.map((s) => [s.day, s]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(today - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? { day, checks: 0, failures: 0 };
  });
}

export function totals(stats: readonly DayStat[]) {
  return stats.reduce((sum, s) => ({ checks: sum.checks + s.checks, failures: sum.failures + s.failures }), {
    checks: 0,
    failures: 0,
  });
}

export type OverallStatus = "operational" | "partial_outage" | "major_outage" | "unknown";

export const OVERALL_LABELS: Record<OverallStatus, string> = {
  operational: "All systems operational",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  unknown: "Waiting for the first checks",
};

export function overallStatus(statuses: readonly string[]): OverallStatus {
  const active = statuses.filter((s) => s !== "paused");
  if (active.length === 0 || active.every((s) => s === "pending")) return "unknown";
  const down = active.filter((s) => s === "down").length;
  if (down === 0) return "operational";
  return down * 2 > active.length ? "major_outage" : "partial_outage";
}
