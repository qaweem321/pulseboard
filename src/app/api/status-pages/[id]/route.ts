import { statusPageInput } from "@/lib/validation";
import { db } from "@/server/db";
import { apiRoute, HttpError, json, notFound, parseId, readJson } from "@/server/http/api";
import { deleteStatusPage, saveStatusPage, SlugTakenError } from "@/server/mutations";

type Params = { id: string };

export const PUT = apiRoute<Params>("editor", async ({ params, request }) => {
  const values = statusPageInput.parse(await readJson(request));
  try {
    const page = await saveStatusPage(db(), parseId(params.id), values);
    if (!page) throw notFound("Status page not found");
    return json(page);
  } catch (error) {
    if (error instanceof SlugTakenError) throw new HttpError(409, error.message);
    throw error;
  }
});

export const DELETE = apiRoute<Params>("editor", async ({ params }) => {
  if (!(await deleteStatusPage(db(), parseId(params.id)))) throw notFound("Status page not found");
  return new Response(null, { status: 204 });
});
