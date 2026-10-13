import { dayLevel, fillDays, formatUptime, overallStatus, totals, uptimePercent } from "./uptime";

test("uptime never rounds up to 100%", () => {
  expect(uptimePercent(100_000, 4)).toBe(99.99);
  expect(uptimePercent(10, 0)).toBe(100);
  expect(uptimePercent(0, 0)).toBeNull();
  expect(formatUptime(99.5)).toBe("99.50%");
  expect(formatUptime(null)).toBe("No data");
});

test("day levels", () => {
  expect(dayLevel({ day: "", checks: 0, failures: 0 })).toBe("none");
  expect(dayLevel({ day: "", checks: 1440, failures: 0 })).toBe("ok");
  expect(dayLevel({ day: "", checks: 1440, failures: 3 })).toBe("degraded");
  expect(dayLevel({ day: "", checks: 1440, failures: 60 })).toBe("outage");
});

test("fillDays fills gaps, oldest first, ending today in UTC", () => {
  const days = fillDays([{ day: "2026-10-10", checks: 5, failures: 1 }], 3, new Date("2026-10-11T23:30:00Z"));
  expect(days).toEqual([
    { day: "2026-10-09", checks: 0, failures: 0 },
    { day: "2026-10-10", checks: 5, failures: 1 },
    { day: "2026-10-11", checks: 0, failures: 0 },
  ]);
  expect(totals(days)).toEqual({ checks: 5, failures: 1 });
});

test.each([
  [[], "unknown"],
  [["pending"], "unknown"],
  [["up", "up", "paused"], "operational"],
  [["up", "up", "down"], "partial_outage"],
  [["down", "down", "up"], "major_outage"],
  [["down", "paused"], "major_outage"],
])("overallStatus(%j) = %s", (statuses, expected) => {
  expect(overallStatus(statuses)).toBe(expected);
});
