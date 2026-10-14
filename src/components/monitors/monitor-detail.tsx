"use client";

import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PauseOutlined from "@mui/icons-material/PauseOutlined";
import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/dates";
import { formatUptime, totals, uptimePercent } from "@/lib/uptime";
import { RANGES, type Range } from "@/lib/validation";
import {
  errorMessage,
  POLL_MS,
  useDeleteMonitorMutation,
  useMonitorQuery,
  useSeriesQuery,
  useUpdateMonitorMutation,
  type MonitorDetailDto,
} from "@/store/api";
import { useAppDispatch, useAppSelector, useCan } from "@/store/store";
import { setRange } from "@/store/ui-slice";
import { ResponseTimeChart } from "../charts/response-time-chart";
import { seriesStats } from "../charts/series";
import { UptimeBars } from "../charts/uptime-bars";
import { ConfirmDialog, ErrorState, LoadingRows, PageHeader, StatusChip } from "../ui";

const RANGE_LABELS: Record<Range, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };

export function MonitorDetail({ id }: { id: number }) {
  const { data, error, isLoading, refetch } = useMonitorQuery(id, { pollingInterval: POLL_MS });
  if (isLoading) return <LoadingRows rows={5} />;
  if (error || !data) {
    const missing = (error as { status?: number } | undefined)?.status === 404;
    return (
      <ErrorState
        message={missing ? "This monitor doesn't exist (it may have been deleted)." : errorMessage(error)}
        onRetry={missing ? undefined : refetch}
      />
    );
  }
  return <MonitorDetailView detail={data} />;
}

function MonitorDetailView({ detail }: { detail: MonitorDetailDto }) {
  const { monitor, bars, checks, incidents } = detail;
  const canEdit = useCan("editor");
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [update, updateState] = useUpdateMonitorMutation();
  const [remove] = useDeleteMonitorMutation();
  const paused = monitor.status === "paused";
  const ninety = totals(bars);

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/dashboard" className="text-muted no-underline hover:text-ink">
          ← Monitors
        </Link>
      </div>
      <PageHeader
        title={monitor.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={monitor.status} />
            <span className="break-all">
              {monitor.method} {monitor.url}
            </span>
          </span>
        }
        actions={
          canEdit && (
            <>
              <Button
                variant="outlined"
                startIcon={paused ? <PlayArrowOutlined /> : <PauseOutlined />}
                disabled={updateState.isLoading}
                onClick={() => update({ id: monitor.id, paused: !paused })}
              >
                {updateState.isLoading ? "Saving..." : paused ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditOutlined />}
                component={Link}
                href={`/dashboard/monitors/${monitor.id}/edit`}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlined />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </>
          )
        }
      />

      {monitor.status === "down" && monitor.lastError && (
        <div className="mb-6 rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm">
          <b className="text-down">Down:</b> {monitor.lastError}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Last check"
          value={monitor.lastCheckedAt ? formatRelative(monitor.lastCheckedAt) : "Not yet"}
        />
        <Tile
          label="Last response"
          value={monitor.lastResponseMs !== null ? `${monitor.lastResponseMs} ms` : "–"}
        />
        <Tile label="Uptime (90 days)" value={formatUptime(uptimePercent(ninety.checks, ninety.failures))} />
        <Tile label="Checks every" value={formatDuration(monitor.intervalSeconds * 1000)} />
      </div>

      <ResponseTimeCard id={monitor.id} />

      <section className="mb-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-semibold">Last 90 days</h2>
        <UptimeBars days={bars} label={`Daily uptime for ${monitor.name} over the last 90 days`} />
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold">Incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted">No incidents. Nice.</p>
          ) : (
            <ul className="space-y-3">
              {incidents.map((incident) => (
                <li key={incident.id} className="text-sm">
                  <div className="font-medium">
                    {incident.resolvedAt ? (
                      <span>
                        Resolved after{" "}
                        {formatDuration(Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt))}
                      </span>
                    ) : (
                      <span className="text-down">Ongoing</span>
                    )}
                  </div>
                  <div className="text-muted">
                    Started {formatDateTime(incident.startedAt)} · {incident.cause}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold">Recent checks</h2>
          {checks.length === 0 ? (
            <p className="text-sm text-muted">The first check runs within a few seconds.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">Time (UTC)</th>
                  <th className="pb-2 font-medium">Result</th>
                  <th className="pb-2 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id} className="border-t border-line">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {formatDateTime(check.checkedAt).replace(" UTC", "")}
                    </td>
                    <td className={`py-1.5 pr-2 ${check.ok ? "" : "text-down"}`}>
                      {check.ok ? `OK ${check.statusCode}` : check.error}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {check.responseMs !== null ? `${check.responseMs} ms` : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${monitor.name}?`}
        body="This deletes the monitor, its check history and incidents, and removes it from status pages. It can't be undone."
        confirmLabel="Delete monitor"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await remove(monitor.id).unwrap();
          router.replace("/dashboard");
        }}
      />
    </>
  );
}

function ResponseTimeCard({ id }: { id: number }) {
  const range = useAppSelector((state) => state.ui.range);
  const dispatch = useAppDispatch();
  const { data, isFetching, error } = useSeriesQuery({ id, range }, { pollingInterval: POLL_MS });
  const stats = data ? seriesStats(data.points) : null;
  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Response time</h2>
          {stats && stats.checks > 0 && (
            <p className="text-sm text-muted">
              {stats.avgMs !== null && `Average ${stats.avgMs} ms · slowest ${stats.maxMs} ms · `}
              {formatUptime(uptimePercent(stats.checks, stats.failures))} uptime
            </p>
          )}
        </div>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_, value: Range | null) => value && dispatch(setRange(value))}
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <ToggleButton key={r} value={r} aria-label={RANGE_LABELS[r]}>
              {r}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <div className={isFetching && !data ? "opacity-50" : ""}>
        {error ? (
          <ErrorState message={errorMessage(error)} />
        ) : data ? (
          <ResponseTimeChart points={data.points} from={data.from} to={data.to} bucketMs={data.bucketMs} />
        ) : (
          <div className="h-60" />
        )}
      </div>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
