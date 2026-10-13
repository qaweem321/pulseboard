import type { IncidentUpdateInput } from "./validation";

export const UPDATE_LABELS: Record<IncidentUpdateInput["status"], string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};
