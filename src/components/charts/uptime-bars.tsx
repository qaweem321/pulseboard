"use client";

import { scaleBand } from "d3";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { dayLevel, formatUptime, uptimePercent, type DayLevel, type DayStat } from "@/lib/uptime";
import { useWidth } from "./use-width";

const COLORS: Record<DayLevel, string> = {
  none: "var(--color-idle)",
  ok: "var(--color-up)",
  degraded: "var(--color-degraded)",
  outage: "var(--color-down)",
};

const LEVEL_TEXT: Record<DayLevel, string> = {
  none: "No data",
  ok: "No downtime",
  degraded: "Some failed checks",
  outage: "Outage",
};

export function UptimeBars({
  days,
  height = 32,
  label,
}: {
  days: readonly DayStat[];
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(300);
  const [active, setActive] = useState<number | null>(null);
  const x = scaleBand<number>()
    .domain(days.map((_, i) => i))
    .range([0, width])
    .paddingInner(width / days.length > 6 ? 0.3 : 0.15);
  const activeDay = active === null ? null : days[active];

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={label} onPointerLeave={() => setActive(null)}>
        {days.map((day, i) => (
          <rect
            key={day.day}
            data-level={dayLevel(day)}
            x={x(i)}
            width={x.bandwidth()}
            height={height}
            rx={Math.min(2, x.bandwidth() / 2)}
            fill={COLORS[dayLevel(day)]}
            opacity={active === null || active === i ? 1 : 0.55}
            onPointerEnter={() => setActive(i)}
          >
            <title>{`${formatDate(day.day)}: ${LEVEL_TEXT[dayLevel(day)]}`}</title>
          </rect>
        ))}
      </svg>
      {activeDay && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 mt-2 w-48 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max((x(active) ?? 0) - 96, 0), Math.max(0, width - 192)) }}
        >
          <div className="font-medium">{formatDate(activeDay.day)}</div>
          <div>{LEVEL_TEXT[dayLevel(activeDay)]}</div>
          {activeDay.checks > 0 && (
            <div className="text-muted">
              {formatUptime(uptimePercent(activeDay.checks, activeDay.failures))} uptime ·{" "}
              {activeDay.checks.toLocaleString("en-US")} checks
            </div>
          )}
        </div>
      )}
    </div>
  );
}
