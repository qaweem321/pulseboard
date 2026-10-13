import { fireEvent, render, screen } from "@testing-library/react";
import { ResponseTimeChart } from "./response-time-chart";
import { Sparkline } from "./sparkline";
import { UptimeBars } from "./uptime-bars";

describe("UptimeBars", () => {
  const days = [
    { day: "2026-10-09", checks: 0, failures: 0 },
    { day: "2026-10-10", checks: 1440, failures: 0 },
    { day: "2026-10-11", checks: 1440, failures: 200 },
  ];

  it("draws one bar per day, colored by level, with an accessible label", () => {
    const { container } = render(<UptimeBars days={days} label="API uptime" />);
    expect(screen.getByRole("img", { name: "API uptime" })).toBeInTheDocument();
    const levels = [...container.querySelectorAll("rect")].map((r) => r.getAttribute("data-level"));
    expect(levels).toEqual(["none", "ok", "outage"]);
    expect(screen.getByText("Oct 11, 2026: Outage")).toBeInTheDocument();
  });

  it("shows a tooltip with the day's uptime on hover", () => {
    const { container } = render(<UptimeBars days={days} label="API uptime" />);
    fireEvent.pointerEnter(container.querySelectorAll("rect")[2]!);
    expect(screen.getByRole("status")).toHaveTextContent("Oct 11, 2026Outage86.11% uptime · 1,440 checks");
  });
});

describe("ResponseTimeChart", () => {
  const range = { from: "2026-10-11T10:00:00.000Z", to: "2026-10-11T11:00:00.000Z", bucketMs: 600_000 };

  it("summarises the data for screen readers and marks failed buckets", () => {
    render(
      <ResponseTimeChart
        {...range}
        points={[
          { t: "2026-10-11T10:00:00.000Z", avgMs: 120, maxMs: 150, checks: 10, failures: 0 },
          { t: "2026-10-11T10:30:00.000Z", avgMs: 300, maxMs: 900, checks: 10, failures: 2 },
        ]}
      />,
    );
    expect(
      screen.getByRole("img", {
        name: "Response time chart: average 210 ms, slowest 900 ms, 2 failed checks out of 20.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("failure-marker")).toHaveLength(1);
  });

  it("has an empty state", () => {
    render(<ResponseTimeChart {...range} points={[]} />);
    expect(screen.getByText("No checks in this period yet.")).toBeInTheDocument();
  });
});

test("Sparkline needs at least two points", () => {
  const { container, rerender } = render(<Sparkline points={[{ t: "2026-10-11T10:00:00Z", ms: 100 }]} />);
  expect(screen.getByText("Not enough data")).toBeInTheDocument();
  rerender(
    <Sparkline
      points={[
        { t: "2026-10-11T10:00:00Z", ms: 100 },
        { t: "2026-10-11T11:00:00Z", ms: null },
        { t: "2026-10-11T12:00:00Z", ms: 140 },
      ]}
    />,
  );
  expect(container.querySelector("path")?.getAttribute("d")).toMatch(/^M/);
});
