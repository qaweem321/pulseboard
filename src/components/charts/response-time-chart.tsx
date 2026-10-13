"use client";

import { area, bisector, curveMonotoneX, line, max, scaleLinear, scaleUtc, utcFormat } from "d3";
import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/dates";
import type { ResponsePoint } from "@/server/queries/monitors";
import { fillBuckets, seriesStats, type ChartPoint } from "./series";
import { useWidth } from "./use-width";

type Props = {
  points: readonly ResponsePoint[];
  from: string;
  to: string;
  bucketMs: number;
  height?: number;
};

const MARGIN = { top: 12, right: 12, bottom: 28, left: 48 };
const findIndex = bisector((p: ChartPoint) => p.date).center;

// D3 computes the scales and paths; React renders the SVG, so it stays declarative and testable.
export function ResponseTimeChart({ points, from, to, bucketMs, height = 240 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const data = useMemo(() => fillBuckets(points, from, to, bucketMs), [points, from, to, bucketMs]);
  const stats = useMemo(() => seriesStats(points), [points]);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const x = scaleUtc([new Date(from), new Date(to)], [0, innerWidth]);
  const y = scaleLinear(
    [0, (max(data, (d) => d.maxMs ?? d.avgMs ?? 0) || 100) * 1.1],
    [innerHeight, 0],
  ).nice();
  const defined = (d: ChartPoint) => d.avgMs !== null;
  const linePath = line<ChartPoint>()
    .defined(defined)
    .x((d) => x(d.date))
    .y((d) => y(d.avgMs ?? 0))
    .curve(curveMonotoneX)(data);
  const areaPath = area<ChartPoint>()
    .defined(defined)
    .x((d) => x(d.date))
    .y0(innerHeight)
    .y1((d) => y(d.avgMs ?? 0))
    .curve(curveMonotoneX)(data);
  const tickFormat = bucketMs < 3_600_000 ? utcFormat("%H:%M") : utcFormat("%b %d");
  const bucketWidth = Math.max(2, x(new Date(new Date(from).getTime() + bucketMs)) - x(new Date(from)));

  const label =
    stats.avgMs === null
      ? "Response time chart: no checks in this period."
      : `Response time chart: average ${stats.avgMs} ms, slowest ${stats.maxMs} ms, ${stats.failures} failed checks out of ${stats.checks}.`;

  return (
    <div ref={ref} className="relative w-full">
      {stats.checks === 0 ? (
        <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>
          No checks in this period yet.
        </div>
      ) : (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const date = x.invert(event.clientX - box.left - MARGIN.left);
            setHover(data[findIndex(data, date)] ?? null);
          }}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="rt-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {y.ticks(4).map((tick) => (
              <g key={tick} transform={`translate(0,${y(tick)})`}>
                <line x2={innerWidth} stroke="var(--color-line)" strokeDasharray="3 3" />
                <text x={-8} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                  {tick} ms
                </text>
              </g>
            ))}
            {x.ticks(Math.max(2, Math.floor(innerWidth / 110))).map((tick) => (
              <text
                key={tick.getTime()}
                x={x(tick)}
                y={innerHeight + 18}
                textAnchor="middle"
                className="fill-muted text-[11px]"
              >
                {tickFormat(tick)}
              </text>
            ))}
            {data
              .filter((d) => d.failures > 0)
              .map((d) => (
                <rect
                  key={d.t}
                  data-testid="failure-marker"
                  x={x(d.date) - bucketWidth / 2}
                  width={bucketWidth}
                  y={0}
                  height={innerHeight}
                  fill="var(--color-down)"
                  opacity={0.12}
                />
              ))}
            {areaPath && <path d={areaPath} fill="url(#rt-fill)" />}
            {linePath && <path d={linePath} fill="none" stroke="var(--color-brand)" strokeWidth={2} />}
            {hover && (
              <g transform={`translate(${x(hover.date)},0)`}>
                <line y2={innerHeight} stroke="var(--color-muted)" strokeWidth={1} />
                {hover.avgMs !== null && (
                  <circle cy={y(hover.avgMs)} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" />
                )}
              </g>
            )}
          </g>
        </svg>
      )}
      {hover && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(MARGIN.left + x(hover.date) + 12, 0), Math.max(0, width - 190)),
          }}
        >
          <div className="font-medium">{formatDateTime(hover.date)}</div>
          {hover.checks === 0 ? (
            <div className="text-muted">No checks</div>
          ) : (
            <>
              <div>
                Avg <b>{hover.avgMs ?? "–"} ms</b> · max {hover.maxMs ?? "–"} ms
              </div>
              <div className={hover.failures ? "text-down" : "text-muted"}>
                {hover.failures} of {hover.checks} checks failed
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
