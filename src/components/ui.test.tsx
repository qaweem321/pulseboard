import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, StatusChip } from "./ui";

test("StatusChip labels each status", () => {
  render(
    <>
      <StatusChip status="up" />
      <StatusChip status="down" />
      <StatusChip status="paused" />
    </>,
  );
  expect(screen.getByText("Up")).toBeInTheDocument();
  expect(screen.getByText("Down")).toBeInTheDocument();
  expect(screen.getByText("Paused")).toBeInTheDocument();
});

describe("ConfirmDialog", () => {
  it("disables the button while working, then closes", async () => {
    let finish!: () => void;
    const onConfirm = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const onClose = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Delete API?"
        body="Gone for good."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const busy = screen.getByRole("button", { name: "Working..." });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows the server's error and stays open", async () => {
    const onClose = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Delete?"
        body="Sure?"
        confirmLabel="Delete"
        onConfirm={() => Promise.reject({ data: { error: "This needs the editor role." } })}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("This needs the editor role.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
