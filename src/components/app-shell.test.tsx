import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./app-shell";
import { renderWithProviders } from "./testing";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

test("the account menu offers System, Light and Dark themes", async () => {
  renderWithProviders(<AppShell>Content</AppShell>);
  expect(screen.queryByRole("button", { name: /switch to/i })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
  const group = screen.getByRole("group", { name: "Theme" });
  expect(group).toBeInTheDocument();
  for (const name of ["System", "Light", "Dark"]) {
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
});
