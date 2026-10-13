import type { Metadata } from "next";
import { StatusPageManager } from "@/components/status-pages/status-page-manager";

export const metadata: Metadata = { title: "Status pages" };

export default function StatusPagesPage() {
  return <StatusPageManager />;
}
