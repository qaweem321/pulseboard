import { alertChannelInput } from "@/lib/validation";
import { db } from "@/server/db";
import { apiRoute, json, notFound, parseId, readJson } from "@/server/http/api";
import { deleteAlertChannel, saveAlertChannel } from "@/server/mutations";

type Params = { id: string };

export const PUT = apiRoute<Params>("admin", async ({ params, request }) => {
  const values = alertChannelInput.parse(await readJson(request));
  const channel = await saveAlertChannel(db(), parseId(params.id), values);
  if (!channel) throw notFound("Alert channel not found");
  return json(channel);
});

export const DELETE = apiRoute<Params>("admin", async ({ params }) => {
  if (!(await deleteAlertChannel(db(), parseId(params.id)))) throw notFound("Alert channel not found");
  return new Response(null, { status: 204 });
});
