"use client";

import Add from "@mui/icons-material/Add";
import Search from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Link from "next/link";
import { useMemo } from "react";
import { formatRelative } from "@/lib/dates";
import { formatUptime, uptimePercent } from "@/lib/uptime";
import { errorMessage, POLL_MS, useMonitorsQuery, type MonitorSummaryDto } from "@/store/api";
import { useAppDispatch, useAppSelector, useCan } from "@/store/store";
import { setSearch, setStatusFilter, type StatusFilter } from "@/store/ui-slice";
import { Sparkline } from "../charts/sparkline";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusDot } from "../ui";

export function filterMonitors(monitors: readonly MonitorSummaryDto[], status: StatusFilter, search: string) {
  const query = search.trim().toLowerCase();
  return monitors.filter(
    (m) =>
      (status === "all" || m.status === status) &&
      (!query || m.name.toLowerCase().includes(query) || m.url.toLowerCase().includes(query)),
  );
}

export function MonitorList({ denied = false }: { denied?: boolean }) {
  const { data, error, isLoading, refetch } = useMonitorsQuery(undefined, { pollingInterval: POLL_MS });
  const canEdit = useCan("editor");
  const dispatch = useAppDispatch();
  const { statusFilter, search } = useAppSelector((state) => state.ui);
  const visible = useMemo(
    () => filterMonitors(data ?? [], statusFilter, search),
    [data, statusFilter, search],
  );
  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      up: all.filter((m) => m.status === "up").length,
      down: all.filter((m) => m.status === "down").length,
      paused: all.filter((m) => m.status === "paused").length,
    };
  }, [data]);

  const addButton = canEdit && (
    <Button component={Link} href="/dashboard/monitors/new" variant="contained" startIcon={<Add />}>
      Add monitor
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Monitors"
        description="Every endpoint Pulseboard checks, refreshed every 30 seconds."
        actions={addButton}
      />
      {denied && (
        <Alert severity="warning" className="mb-4">
          Your role can&apos;t open that page.
        </Alert>
      )}
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState
          title="No monitors yet"
          body={
            canEdit
              ? "Add the first URL you want to watch. Pulseboard checks it on a schedule and alerts you when it goes down."
              : "An editor hasn't added any monitors yet."
          }
          action={addButton}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Monitors" value={data.length} />
            <Stat label="Up" value={counts.up} tone="text-up" />
            <Stat label="Down" value={counts.down} tone={counts.down ? "text-down" : undefined} />
            <Stat label="Paused" value={counts.paused} />
          </div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TextField
              placeholder="Search by name or URL"
              value={search}
              onChange={(e) => dispatch(setSearch(e.target.value))}
              slotProps={{
                htmlInput: { "aria-label": "Search monitors" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ maxWidth: { sm: 320 } }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={statusFilter}
              onChange={(_, value: StatusFilter | null) => value && dispatch(setStatusFilter(value))}
              aria-label="Filter by status"
            >
              {(["all", "up", "down", "paused"] as const).map((value) => (
                <ToggleButton key={value} value={value} className="capitalize">
                  {value}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
          {visible.length === 0 ? (
            <EmptyState title="No matches" body="No monitors match this search and filter." />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {visible.map((monitor) => (
                <MonitorRow key={monitor.id} monitor={monitor} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function MonitorRow({ monitor }: { monitor: MonitorSummaryDto }) {
  const uptime24h = uptimePercent(monitor.uptime24h.checks, monitor.uptime24h.failures);
  const uptime30d = uptimePercent(monitor.uptime30d.checks, monitor.uptime30d.failures);
  return (
    <li>
      <Link
        href={`/dashboard/monitors/${monitor.id}`}
        className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-ink no-underline transition-colors hover:bg-line/30 md:grid-cols-[auto_minmax(0,1fr)_140px_90px_90px_100px]"
      >
        <StatusDot status={monitor.status} />
        <div className="min-w-0">
          <div className="truncate font-medium">{monitor.name}</div>
          <div className="truncate text-xs text-muted">
            {monitor.status === "down" && monitor.lastError ? (
              <span className="text-down">{monitor.lastError}</span>
            ) : (
              monitor.url
            )}
          </div>
        </div>
        <div className="hidden md:block">
          <Sparkline points={monitor.sparkline} />
        </div>
        <Metric label="24h" value={formatUptime(uptime24h)} />
        <Metric label="30 days" value={formatUptime(uptime30d)} className="hidden md:block" />
        <div className="hidden text-right text-xs text-muted md:block">
          {monitor.status === "paused"
            ? "Paused"
            : monitor.lastCheckedAt
              ? `${formatRelative(monitor.lastCheckedAt)} · ${monitor.lastResponseMs ?? "–"} ms`
              : "Not checked yet"}
        </div>
      </Link>
    </li>
  );
}

function Metric({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`text-right ${className}`}>
      <div className="text-sm font-medium tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
