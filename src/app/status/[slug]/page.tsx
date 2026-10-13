import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { UptimeBars } from "@/components/charts/uptime-bars";
import { LogoMark } from "@/components/logo";
import { formatDateTime, formatDuration } from "@/lib/dates";
import { formatUptime, overallStatus, OVERALL_LABELS, type OverallStatus } from "@/lib/uptime";
import { db } from "@/server/db";
import { publicStatusPage } from "@/server/queries/status-pages";
import { UPDATE_LABELS } from "@/lib/labels";

// Public and cheap to serve: rendered on the server, refreshed at most every 30 seconds.
export const revalidate = 30;

const load = cache((slug: string) => publicStatusPage(db(), slug));

export async function generateMetadata({ params }: PageProps<"/status/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: `${data.page.title} status` } : { title: "Status page not found" };
}

const BANNER: Record<OverallStatus, string> = {
  operational: "bg-up text-white",
  partial_outage: "bg-degraded text-white",
  major_outage: "bg-down text-white",
  unknown: "bg-idle text-ink",
};

const MONITOR_STATUS: Record<string, { text: string; className: string }> = {
  up: { text: "Operational", className: "text-up" },
  down: { text: "Outage", className: "text-down" },
  paused: { text: "Maintenance", className: "text-muted" },
  pending: { text: "Checking", className: "text-muted" },
};

export default async function StatusPage({ params }: PageProps<"/status/[slug]">) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const overall = overallStatus(data.monitors.map((m) => m.status));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{data.page.title}</h1>
        {data.page.description && <p className="mt-2 text-muted">{data.page.description}</p>}
      </header>

      <div className={`mb-8 rounded-xl px-5 py-4 text-lg font-semibold ${BANNER[overall]}`} role="status">
        {OVERALL_LABELS[overall]}
      </div>

      <section className="mb-10 divide-y divide-line rounded-xl border border-line bg-surface">
        {data.monitors.length === 0 && <p className="p-5 text-sm text-muted">No services are listed yet.</p>}
        {data.monitors.map((monitor) => {
          const status = MONITOR_STATUS[monitor.status]!;
          return (
            <div key={monitor.id} className="p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-medium">{monitor.name}</h2>
                <span className={`text-sm font-medium ${status.className}`}>{status.text}</span>
              </div>
              <UptimeBars days={monitor.days} label={`${monitor.name}: daily uptime over the last 90 days`} />
              <div className="mt-2 flex justify-between text-xs text-muted">
                <span>90 days ago</span>
                <span>{formatUptime(monitor.uptime)} uptime</span>
                <span>Today</span>
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Recent incidents</h2>
        {data.incidents.length === 0 ? (
          <p className="text-sm text-muted">No incidents in the last 14 days.</p>
        ) : (
          <ul className="space-y-4">
            {data.incidents.map((incident) => (
              <li key={incident.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">
                    {incident.resolvedAt ? "Resolved" : "Ongoing"}: {incident.monitorName} unavailable
                  </h3>
                  <span className="text-sm text-muted">
                    {incident.resolvedAt
                      ? `${formatDuration(incident.resolvedAt.getTime() - incident.startedAt.getTime())}`
                      : "In progress"}
                  </span>
                </div>
                <p className="text-sm text-muted">Started {formatDateTime(incident.startedAt)}</p>
                {incident.updates.length > 0 && (
                  <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
                    {[...incident.updates].reverse().map((u) => (
                      <li key={u.id} className="text-sm">
                        <b>{UPDATE_LABELS[u.status]}</b>{" "}
                        <span className="text-muted">· {formatDateTime(u.createdAt)}</span>
                        <div className="whitespace-pre-line">{u.message}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-muted">
        <LogoMark size={16} /> Powered by Pulseboard · All times in UTC
      </footer>
    </div>
  );
}
