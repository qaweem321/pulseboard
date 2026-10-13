import { MonitorList } from "@/components/monitors/monitor-list";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { denied } = await searchParams;
  return <MonitorList denied={denied === "1"} />;
}
