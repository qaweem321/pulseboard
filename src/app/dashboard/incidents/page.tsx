import type { Metadata } from "next";
import { IncidentList } from "@/components/incidents/incident-list";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  return <IncidentList />;
}
