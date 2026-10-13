import { db } from "@/server/db";
import { apiRoute, json } from "@/server/http/api";
import { listIncidents } from "@/server/queries/incidents";

export const GET = apiRoute("viewer", async () => json(await listIncidents(db(), { limit: 100 })));
