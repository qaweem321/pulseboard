import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { alertChannels } from "@/server/db/schema";
import { env } from "@/server/env";
import { apiRoute, HttpError, json, notFound, parseId } from "@/server/http/api";
import { createRateLimiter } from "@/server/http/rate-limit";
import { dispatchAlerts } from "@/server/monitoring/alerts";

const allow = createRateLimiter({ limit: 5, windowMs: 60_000 });

export const POST = apiRoute<{ id: string }>("admin", async ({ params, user }) => {
  if (!allow(user.sub)) throw new HttpError(429, "Too many test alerts. Wait a minute and try again.");
  const [channel] = await db()
    .select()
    .from(alertChannels)
    .where(eq(alertChannels.id, parseId(params.id)));
  if (!channel) throw notFound("Alert channel not found");
  const config = env();
  const [result] = await dispatchAlerts(
    db(),
    [channel],
    [{ event: "test", monitor: { id: 0, name: channel.name, url: "" }, incident: null }],
    { allowHosts: config.MONITOR_ALLOW_HOSTS, allowHttp: config.MONITOR_ALLOW_HTTP },
  );
  return json({ ok: result?.ok ?? false, error: result?.error ?? null });
});
