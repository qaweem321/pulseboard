import { eq } from "drizzle-orm";
import { mapLimit } from "@/lib/concurrency";
import type { Db } from "../db";
import { alertChannels } from "../db/schema";
import { dispatchAlerts, type AlertEvent } from "./alerts";
import { runCheck, type NetworkPolicy, type Requester } from "./check";
import { claimDueMonitors, recordCheck } from "./scheduler";

export type TickOptions = {
  policy: NetworkPolicy;
  batchSize?: number;
  concurrency?: number;
  request?: Requester;
};

// One scheduler pass: claim due monitors, check them in parallel, store results, send alerts.
export async function tick(db: Db, options: TickOptions) {
  const { policy, batchSize = 50, concurrency = 10, request } = options;
  const due = await claimDueMonitors(db, batchSize);
  if (due.length === 0) return { checked: 0, alerts: 0 };
  const recorded = await mapLimit(due, concurrency, async (monitor) =>
    recordCheck(db, monitor.id, await runCheck(monitor, policy, request)),
  );
  const alerts: AlertEvent[] = recorded.flatMap((r) =>
    r?.transition.event ? [{ event: r.transition.event, monitor: r.monitor, incident: r.incident }] : [],
  );
  if (alerts.length > 0) {
    const channels = await db.select().from(alertChannels).where(eq(alertChannels.enabled, true));
    await dispatchAlerts(db, channels, alerts, policy, request);
  }
  return { checked: due.length, alerts: alerts.length };
}
