import type { Metadata } from "next";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "New monitor" };

export default async function NewMonitorPage() {
  await requireRole("editor");
  return (
    <>
      <PageHeader title="New monitor" description="Pulseboard starts checking as soon as you save." />
      <MonitorForm />
    </>
  );
}
