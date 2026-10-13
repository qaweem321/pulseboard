"use client";

import { extent, line, max, scaleLinear, scaleUtc } from "d3";

type Point = { t: string; ms: number | null };

export function Sparkline({
  points,
  width = 120,
  height = 32,
}: {
  points: readonly Point[];
  width?: number;
  height?: number;
}) {
  const data = points.filter((p): p is { t: string; ms: number } => p.ms !== null);
  if (data.length < 2) {
    return <span className="text-xs text-muted">Not enough data</span>;
  }
  const [first, last] = extent(data, (p) => new Date(p.t)) as [Date, Date];
  const x = scaleUtc([first, last], [2, width - 2]);
  const y = scaleLinear([0, (max(data, (p) => p.ms) ?? 1) * 1.1], [height - 2, 2]);
  const path = line<{ t: string; ms: number }>()
    .x((p) => x(new Date(p.t)))
    .y((p) => y(p.ms))(data);
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={path ?? undefined} fill="none" stroke="var(--color-brand)" strokeWidth={1.5} />
    </svg>
  );
}
