import { notFound } from "next/navigation";
import { MonitorDetail } from "@/components/monitors/monitor-detail";

export default async function MonitorPage({ params }: PageProps<"/dashboard/monitors/[id]">) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <MonitorDetail id={id} />;
}
