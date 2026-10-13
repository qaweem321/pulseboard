import { createHmac } from "node:crypto";
import { safeRequest } from "@qaweem321/no-ssrf/node";
import { formatDateTime, formatDuration } from "@/lib/dates";
import type { Db } from "../db";
import { alertDeliveries, type AlertChannel, type Incident, type Monitor } from "../db/schema";
import type { NetworkPolicy, Requester } from "./check";
import type { MonitorEvent } from "./transition";

export type AlertEvent = {
  event: MonitorEvent | "test";
  monitor: Pick<Monitor, "id" | "name" | "url">;
  incident: Pick<Incident, "id" | "startedAt" | "resolvedAt" | "cause"> | null;
};

export function alertText({ event, monitor, incident }: AlertEvent): string {
  if (event === "test") return `Test alert from Pulseboard: the "${monitor.name}" channel works.`;
  if (event === "down") {
    return `🔴 ${monitor.name} is DOWN (${monitor.url}). Cause: ${incident?.cause ?? "check failed"}.`;
  }
  const downtime =
    incident?.resolvedAt && incident.startedAt
      ? ` after ${formatDuration(new Date(incident.resolvedAt).getTime() - new Date(incident.startedAt).getTime())}`
      : "";
  return `🟢 ${monitor.name} is back UP${downtime} (${monitor.url}).`;
}

export type OutgoingRequest = { body: string; headers: Record<string, string> };

// Builds the HTTP request for one channel. Webhook bodies are signed like Stripe's:
// `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`, so receivers can reject replays.
export function buildRequest(channel: AlertChannel, alert: AlertEvent, now = new Date()): OutgoingRequest {
  const text = alertText(alert);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (channel.kind === "slack") return { body: JSON.stringify({ text }), headers };
  if (channel.kind === "discord") return { body: JSON.stringify({ content: text }), headers };
  const body = JSON.stringify({
    event: alert.event,
    text,
    monitor: alert.monitor,
    incident: alert.incident && {
      ...alert.incident,
      startedAt: formatDateTime(alert.incident.startedAt),
      resolvedAt: alert.incident.resolvedAt && formatDateTime(alert.incident.resolvedAt),
    },
    sentAt: now.toISOString(),
  });
  if (channel.secret) {
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = createHmac("sha256", channel.secret).update(`${timestamp}.${body}`).digest("hex");
    headers["x-pulseboard-signature"] = `t=${timestamp},v1=${signature}`;
  }
  return { body, headers };
}

export type DeliveryResult = { channelId: number; ok: boolean; error: string | null };

export async function sendAlert(
  channel: AlertChannel,
  alert: AlertEvent,
  policy: NetworkPolicy,
  request: Requester = safeRequest,
): Promise<DeliveryResult> {
  const { body, headers } = buildRequest(channel, alert);
  try {
    const response = await request(channel.url, {
      method: "POST",
      headers,
      body,
      timeoutMs: 5_000,
      maxResponseBytes: 4_000,
      allowHosts: policy.allowHosts,
      allowHttp: policy.allowHttp,
    });
    const ok = response.status >= 200 && response.status < 300;
    return { channelId: channel.id, ok, error: ok ? null : `HTTP ${response.status}` };
  } catch (error) {
    return {
      channelId: channel.id,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Sends every alert to every channel in parallel, then logs all deliveries in one insert.
export async function dispatchAlerts(
  db: Db,
  channels: readonly AlertChannel[],
  alerts: readonly AlertEvent[],
  policy: NetworkPolicy,
  request: Requester = safeRequest,
) {
  const jobs = alerts.flatMap((alert) =>
    channels.map(async (channel) => ({ alert, result: await sendAlert(channel, alert, policy, request) })),
  );
  if (jobs.length === 0) return [];
  const deliveries = await Promise.all(jobs);
  await db.insert(alertDeliveries).values(
    deliveries.map(({ alert, result }) => ({
      channelId: result.channelId,
      incidentId: alert.incident?.id ?? null,
      event: alert.event,
      ok: result.ok,
      error: result.error,
    })),
  );
  return deliveries.map((d) => d.result);
}
