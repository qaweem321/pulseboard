import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getMonitor } from "@/server/queries/monitors";
import type { MonitorDto } from "@/store/api";

export const metadata: Metadata = { title: "Edit monitor" };

export default async function EditMonitorPage({ params }: PageProps<"/dashboard/monitors/[id]/edit">) {
  await requireRole("editor");
  const id = Number((await params).id);
  const monitor = Number.isSafeInteger(id) ? await getMonitor(db(), id) : null;
  if (!monitor) notFound();
  const dto = JSON.parse(JSON.stringify(monitor)) as MonitorDto;
  return (
    <>
      <PageHeader title={`Edit ${monitor.name}`} />
      <MonitorForm monitor={dto} />
    </>
  );
}
