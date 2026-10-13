"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import { useState } from "react";

export type MonitorStatus = "pending" | "up" | "down" | "paused";

const STATUS: Record<MonitorStatus, { label: string; color: "success" | "error" | "default" | "warning" }> = {
  up: { label: "Up", color: "success" },
  down: { label: "Down", color: "error" },
  paused: { label: "Paused", color: "default" },
  pending: { label: "Pending", color: "warning" },
};

export function StatusChip({ status }: { status: MonitorStatus }) {
  const { label, color } = STATUS[status];
  return (
    <Chip size="small" label={label} color={color} variant={status === "paused" ? "outlined" : "filled"} />
  );
}

export function StatusDot({ status }: { status: MonitorStatus }) {
  const color = { up: "bg-up", down: "bg-down", paused: "bg-idle", pending: "bg-degraded" }[status];
  return (
    <span className="relative inline-flex h-2.5 w-2.5" aria-hidden="true">
      {status === "down" && (
        <span className={`absolute inset-0 animate-ping rounded-full ${color} opacity-60`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={56} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {message}
    </Alert>
  );
}

// "Are you sure?" before anything destructive. The confirm button shows progress and can't be
// clicked twice.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{body}</DialogContentText>
        {error && (
          <Alert severity="error" className="mt-3">
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(
                (e as { data?: { error?: string } })?.data?.error ?? "That didn't work. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working..." : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
