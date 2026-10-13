import type { Monitor } from "../db/schema";

export type CheckOutcome = {
  ok: boolean;
  statusCode: number | null;
  responseMs: number | null;
  error: string | null;
};

export type MonitorEvent = "down" | "up";

export type Transition = {
  status: Monitor["status"];
  consecutiveFailures: number;
  // "down" opens an incident and alerts; "up" resolves it and alerts.
  event: MonitorEvent | null;
};

type State = Pick<Monitor, "status" | "consecutiveFailures" | "failureThreshold">;

// Pure state machine: one check result in, the monitor's next state out.
export function nextState(state: State, outcome: CheckOutcome): Transition {
  if (state.status === "paused") {
    return { status: "paused", consecutiveFailures: state.consecutiveFailures, event: null };
  }
  if (outcome.ok) {
    return { status: "up", consecutiveFailures: 0, event: state.status === "down" ? "up" : null };
  }
  const failures = state.consecutiveFailures + 1;
  if (state.status === "down") return { status: "down", consecutiveFailures: failures, event: null };
  if (failures >= state.failureThreshold)
    return { status: "down", consecutiveFailures: failures, event: "down" };
  // Below the threshold: keep the current status, so one blip doesn't page anyone.
  return { status: state.status, consecutiveFailures: failures, event: null };
}
