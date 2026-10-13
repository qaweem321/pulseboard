import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MonitorSummaryDto } from "@/store/api";
import { renderWithProviders } from "../testing";
import { filterMonitors, MonitorList } from "./monitor-list";

const monitor = (id: number, name: string, status: MonitorSummaryDto["status"]): MonitorSummaryDto => ({
  id,
  name,
  url: `https://${name.toLowerCase()}.example.com`,
  method: "GET",
  status,
  intervalSeconds: 60,
  lastCheckedAt: null,
  lastResponseMs: null,
  lastError: status === "down" ? "Connection refused" : null,
  uptime24h: { checks: 100, failures: status === "down" ? 10 : 0 },
  uptime30d: { checks: 0, failures: 0 },
  sparkline: [],
});

const MONITORS = [monitor(1, "API", "up"), monitor(2, "Billing", "down"), monitor(3, "Docs", "paused")];

function mockMonitors(list: MonitorSummaryDto[]) {
  global.fetch = jest.fn(
    async () => new Response(JSON.stringify(list), { headers: { "content-type": "application/json" } }),
  );
}

test("filterMonitors matches status and searches name and URL", () => {
  expect(filterMonitors(MONITORS, "down", "").map((m) => m.name)).toEqual(["Billing"]);
  expect(filterMonitors(MONITORS, "all", "DOCS.example").map((m) => m.name)).toEqual(["Docs"]);
});

test("lists monitors with counts, errors and filters", async () => {
  mockMonitors(MONITORS);
  renderWithProviders(<MonitorList />);
  const list = await screen.findByRole("list");
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(within(list).getByText("Connection refused")).toBeInTheDocument();
  expect(within(list).getByText("90.00%")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "down" }));
  expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);

  await userEvent.type(screen.getByLabelText("Search monitors"), "nothing");
  expect(screen.getByText("No matches")).toBeInTheDocument();
});

test("viewers don't get an Add button", async () => {
  mockMonitors([]);
  renderWithProviders(<MonitorList />, { role: "viewer" });
  expect(await screen.findByText("No monitors yet")).toBeInTheDocument();
  expect(screen.getByText("An editor hasn't added any monitors yet.")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Add monitor" })).not.toBeInTheDocument();
});

test("editors can add the first monitor", async () => {
  mockMonitors([]);
  renderWithProviders(<MonitorList />, { role: "editor" });
  expect(await screen.findByText("No monitors yet")).toBeInTheDocument();
  // One in the page header, one in the empty state.
  expect(screen.getAllByRole("link", { name: "Add monitor" })).toHaveLength(2);
});
