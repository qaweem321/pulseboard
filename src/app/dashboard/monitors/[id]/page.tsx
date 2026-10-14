import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonitorDetail } from "@/components/monitors/monitor-detail";
import { currentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getMonitor } from "@/server/queries/monitors";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Name the tab after the monitor. Signed-out visitors get a generic title; the layout redirects them.
export async function generateMetadata({ params }: PageProps<"/dashboard/monitors/[id]">): Promise<Metadata> {
  const id = parseId((await params).id);
  if (!id || !(await currentUser())) return { title: "Monitor" };
  const monitor = await getMonitor(db(), id);
  return { title: monitor?.name ?? "Monitor" };
}

export default async function MonitorPage({ params }: PageProps<"/dashboard/monitors/[id]">) {
  const id = parseId((await params).id);
  if (!id) notFound();
  return <MonitorDetail id={id} />;
}
