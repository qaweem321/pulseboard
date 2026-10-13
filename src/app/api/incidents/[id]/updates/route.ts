import { incidentUpdateInput } from "@/lib/validation";
import { db } from "@/server/db";
import { apiRoute, json, notFound, parseId, readJson } from "@/server/http/api";
import { addIncidentUpdate } from "@/server/mutations";
import { getIncident } from "@/server/queries/incidents";

export const POST = apiRoute<{ id: string }>("editor", async ({ params, request, user }) => {
  const id = parseId(params.id);
  const [values, incident] = await Promise.all([
    readJson(request).then((body) => incidentUpdateInput.parse(body)),
    getIncident(db(), id),
  ]);
  if (!incident) throw notFound("Incident not found");
  return json(await addIncidentUpdate(db(), id, values, user.name), { status: 201 });
});
