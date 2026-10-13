import { nextState, type CheckOutcome } from "./transition";

const ok: CheckOutcome = { ok: true, statusCode: 200, responseMs: 80, error: null };
const fail: CheckOutcome = { ok: false, statusCode: 500, responseMs: 90, error: "Unexpected status 500" };

describe("nextState", () => {
  it("a new monitor goes up on its first success, without alerting", () => {
    expect(nextState({ status: "pending", consecutiveFailures: 0, failureThreshold: 2 }, ok)).toEqual({
      status: "up",
      consecutiveFailures: 0,
      event: null,
    });
  });

  it("one failure below the threshold doesn't change the status", () => {
    expect(nextState({ status: "up", consecutiveFailures: 0, failureThreshold: 2 }, fail)).toEqual({
      status: "up",
      consecutiveFailures: 1,
      event: null,
    });
  });

  it("reaching the threshold goes down and alerts once", () => {
    const down = nextState({ status: "up", consecutiveFailures: 1, failureThreshold: 2 }, fail);
    expect(down).toEqual({ status: "down", consecutiveFailures: 2, event: "down" });
    expect(nextState({ ...down, failureThreshold: 2 }, fail)).toEqual({
      status: "down",
      consecutiveFailures: 3,
      event: null,
    });
  });

  it("a threshold of 1 alerts on the first failure, even for a new monitor", () => {
    expect(nextState({ status: "pending", consecutiveFailures: 0, failureThreshold: 1 }, fail).event).toBe(
      "down",
    );
  });

  it("recovering from down alerts 'up' and resets failures", () => {
    expect(nextState({ status: "down", consecutiveFailures: 7, failureThreshold: 2 }, ok)).toEqual({
      status: "up",
      consecutiveFailures: 0,
      event: "up",
    });
  });

  it("a success between failures resets the count", () => {
    const blip = nextState({ status: "up", consecutiveFailures: 1, failureThreshold: 2 }, ok);
    expect(nextState({ ...blip, failureThreshold: 2 }, fail).event).toBeNull();
  });

  it("paused monitors never change", () => {
    expect(nextState({ status: "paused", consecutiveFailures: 0, failureThreshold: 1 }, fail)).toEqual({
      status: "paused",
      consecutiveFailures: 0,
      event: null,
    });
  });
});
