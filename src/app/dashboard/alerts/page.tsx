import type { Metadata } from "next";
import { AlertChannels } from "@/components/alerts/alert-channels";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Alert channels" };

export default async function AlertsPage() {
  await requireRole("admin");
  return <AlertChannels />;
}
