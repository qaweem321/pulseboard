import { formatDate, formatDateTime, formatDuration, formatRelative } from "./dates";

test("dates are unambiguous and in UTC", () => {
  // 23:30 in New York is already the next day in UTC.
  expect(formatDate("2026-10-11T03:30:00Z")).toBe("Oct 11, 2026");
  expect(formatDateTime("2026-10-11T03:30:00Z")).toBe("Oct 11, 2026, 03:30 UTC");
});

test.each([
  [20_000, "less than a minute"],
  [5 * 60_000, "5 min"],
  [60 * 60_000, "1 h"],
  [95 * 60_000, "1 h 35 min"],
  [26 * 3600_000, "1 d 2 h"],
])("formatDuration(%d) = %s", (ms, text) => {
  expect(formatDuration(ms)).toBe(text);
});

test("formatRelative", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  expect(formatRelative("2026-10-11T11:59:58Z", now)).toBe("just now");
  expect(formatRelative("2026-10-11T11:59:30Z", now)).toBe("30s ago");
  expect(formatRelative("2026-10-11T11:15:00Z", now)).toBe("45m ago");
  expect(formatRelative("2026-10-11T02:00:00Z", now)).toBe("10h ago");
  expect(formatRelative("2026-10-01T02:00:00Z", now)).toBe("Oct 1, 2026");
});
