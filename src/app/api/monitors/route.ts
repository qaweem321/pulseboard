import { monitorInput } from "@/lib/validation";
import { db } from "@/server/db";
import { apiRoute, json, readJson } from "@/server/http/api";
import { createMonitor } from "@/server/mutations";
import { listMonitorSummaries } from "@/server/queries/monitors";

export const GET = apiRoute("viewer", async () => json(await listMonitorSummaries(db())));

export const POST = apiRoute("editor", async ({ request }) => {
  const values = monitorInput.parse(await readJson(request));
  return json(await createMonitor(db(), values), { status: 201 });
});
