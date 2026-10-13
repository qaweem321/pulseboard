"use client";

import { scaleBand } from "d3";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { dayLevel, formatUptime, uptimePercent, type DayLevel, type DayStat } from "@/lib/uptime";

const BAR_UNIT = 10;

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
  const [active, setActive] = useState<number | null>(null);
  // A fixed coordinate system stretched to the container with viewBox: correct on the server, no
  // measuring, no layout jump when the page hydrates.
  const width = days.length * BAR_UNIT;
  const x = scaleBand<number>()
    .domain(days.map((_, i) => i))
    .range([0, width])
    .paddingInner(0.3);
  const activeDay = active === null ? null : days[active];

  return (
    <div className="relative w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        onPointerLeave={() => setActive(null)}
      >
        {days.map((day, i) => (
          <rect
            key={day.day}
            data-level={dayLevel(day)}
            x={x(i)}
            width={x.bandwidth()}
            height={height}
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
          style={{
            left: `clamp(0px, calc(${((x(active) ?? 0) / width) * 100}% - 96px), calc(100% - 192px))`,
          }}
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
