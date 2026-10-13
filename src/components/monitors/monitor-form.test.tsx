import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../testing";
import { MonitorForm, toInput } from "./monitor-form";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push }) }));

const fetchMock = jest.fn();
beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

test("shows every validation error without calling the API", async () => {
  renderWithProviders(<MonitorForm />);
  await userEvent.clear(screen.getByLabelText(/URL/));
  await userEvent.type(screen.getByLabelText(/URL/), "not a url");
  await userEvent.clear(screen.getByLabelText("Accepted status codes"));
  await userEvent.type(screen.getByLabelText("Accepted status codes"), "2xx");
  await userEvent.click(screen.getByRole("button", { name: "Create monitor" }));

  expect(screen.getByText("Required")).toBeInTheDocument();
  expect(screen.getByText("Enter a full URL, like https://example.com/health")).toBeInTheDocument();
  expect(screen.getByText("Use codes or ranges like 200-299,301")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("creates the monitor, then opens it", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ id: 42 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }),
  );
  renderWithProviders(<MonitorForm />);
  await userEvent.type(screen.getByLabelText(/Name/), "Marketing site");
  await userEvent.type(screen.getByLabelText(/URL/), "example.com");
  await userEvent.click(screen.getByRole("button", { name: "Create monitor" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/monitors/42"));
  const request = fetchMock.mock.calls[0]![0] as Request;
  expect(request.method).toBe("POST");
  expect(await request.json()).toMatchObject({ name: "Marketing site", url: "https://example.com" });
});

test("toInput converts seconds to milliseconds", () => {
  expect(
    toInput({
      name: "a",
      url: "https://a.b",
      method: "GET",
      intervalSeconds: 60,
      expectedStatus: "200",
      keyword: "",
      timeoutSeconds: "2.5",
      failureThreshold: "3",
    }),
  ).toMatchObject({ timeoutMs: 2500, failureThreshold: 3 });
});
