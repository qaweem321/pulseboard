import { monitorPatch } from "@/lib/validation";
import { db } from "@/server/db";
import { apiRoute, json, notFound, parseId, readJson } from "@/server/http/api";
import { deleteMonitor, updateMonitor } from "@/server/mutations";
import { monitorDetail } from "@/server/queries/monitors";

type Params = { id: string };

export const GET = apiRoute<Params>("viewer", async ({ params }) => {
  const detail = await monitorDetail(db(), parseId(params.id));
  if (!detail) throw notFound("Monitor not found");
  return json(detail);
});

export const PATCH = apiRoute<Params>("editor", async ({ params, request }) => {
  const patch = monitorPatch.parse(await readJson(request));
  const monitor = await updateMonitor(db(), parseId(params.id), patch);
  if (!monitor) throw notFound("Monitor not found");
  return json(monitor);
});

export const DELETE = apiRoute<Params>("editor", async ({ params }) => {
  if (!(await deleteMonitor(db(), parseId(params.id)))) throw notFound("Monitor not found");
  return new Response(null, { status: 204 });
});
