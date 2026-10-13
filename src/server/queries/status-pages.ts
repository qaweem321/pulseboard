import { asc, eq } from "drizzle-orm";
import { totals, uptimePercent } from "@/lib/uptime";
import type { Db } from "../db";
import { monitors, statusPageMonitors, statusPages } from "../db/schema";
import { listIncidents } from "./incidents";
import { dailyBars } from "./monitors";

export async function listStatusPages(db: Db) {
  const [pages, links] = await Promise.all([
    db.select().from(statusPages).orderBy(asc(statusPages.title)),
    db.select().from(statusPageMonitors).orderBy(asc(statusPageMonitors.position)),
  ]);
  return pages.map((page) => ({
    ...page,
    monitorIds: links.filter((l) => l.pageId === page.id).map((l) => l.monitorId),
  }));
}

// Everything a public status page shows. Only published pages, and only public-safe fields:
// monitor URLs and error messages stay private.
export async function publicStatusPage(db: Db, slug: string, now = new Date()) {
  const [page] = await db.select().from(statusPages).where(eq(statusPages.slug, slug));
  if (!page || !page.published) return null;
  const pageMonitors = await db
    .select({ id: monitors.id, name: monitors.name, status: monitors.status })
    .from(statusPageMonitors)
    .innerJoin(monitors, eq(monitors.id, statusPageMonitors.monitorId))
    .where(eq(statusPageMonitors.pageId, page.id))
    .orderBy(asc(statusPageMonitors.position), asc(monitors.name));
  const ids = pageMonitors.map((m) => m.id);
  const [bars, incidentList] = await Promise.all([
    dailyBars(db, ids, 90, now),
    listIncidents(db, { monitorIds: ids, since: new Date(now.getTime() - 14 * 86_400_000), limit: 20 }),
  ]);
  return {
    page: { title: page.title, description: page.description, slug: page.slug },
    monitors: pageMonitors.map((m) => {
      const days = bars.get(m.id) ?? [];
      const sum = totals(days);
      return { ...m, days, uptime: uptimePercent(sum.checks, sum.failures) };
    }),
    incidents: incidentList.map(({ cause: _cause, ...incident }) => incident),
  };
}

export type PublicStatusPage = NonNullable<Awaited<ReturnType<typeof publicStatusPage>>>;
