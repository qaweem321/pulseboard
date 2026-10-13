import { statusPageInput } from "@/lib/validation";
import { db } from "@/server/db";
import { apiRoute, HttpError, json, readJson } from "@/server/http/api";
import { saveStatusPage, SlugTakenError } from "@/server/mutations";
import { listStatusPages } from "@/server/queries/status-pages";

export const GET = apiRoute("viewer", async () => json(await listStatusPages(db())));

export const POST = apiRoute("editor", async ({ request }) => {
  const values = statusPageInput.parse(await readJson(request));
  try {
    return json(await saveStatusPage(db(), null, values), { status: 201 });
  } catch (error) {
    if (error instanceof SlugTakenError) throw new HttpError(409, error.message);
    throw error;
  }
});
