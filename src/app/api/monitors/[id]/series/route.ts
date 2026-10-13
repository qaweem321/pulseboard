import { RANGES, type Range } from "@/lib/validation";
import { db } from "@/server/db";
import { apiRoute, json, parseId } from "@/server/http/api";
import { responseSeries } from "@/server/queries/monitors";

export const GET = apiRoute<{ id: string }>("viewer", async ({ params, request }) => {
  const requested = new URL(request.url).searchParams.get("range");
  const range: Range = (RANGES as readonly string[]).includes(requested ?? "") ? (requested as Range) : "24h";
  return json(await responseSeries(db(), parseId(params.id), range));
});
