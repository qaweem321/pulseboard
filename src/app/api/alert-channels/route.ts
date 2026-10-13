import { asc } from "drizzle-orm";
import { alertChannelInput } from "@/lib/validation";
import { db } from "@/server/db";
import { alertChannels } from "@/server/db/schema";
import { apiRoute, json, readJson } from "@/server/http/api";
import { saveAlertChannel } from "@/server/mutations";

export const GET = apiRoute("admin", async () =>
  json(await db().select().from(alertChannels).orderBy(asc(alertChannels.name))),
);

export const POST = apiRoute("admin", async ({ request }) => {
  const values = alertChannelInput.parse(await readJson(request));
  return json(await saveAlertChannel(db(), null, values), { status: 201 });
});
