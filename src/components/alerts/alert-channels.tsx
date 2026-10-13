"use client";

import Add from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { alertChannelInput, fieldErrors, type AlertChannelInput } from "@/lib/validation";
import {
  errorFields,
  errorMessage,
  useChannelsQuery,
  useDeleteChannelMutation,
  useSaveChannelMutation,
  useTestChannelMutation,
  type AlertChannelDto,
} from "@/store/api";
import { ConfirmDialog, EmptyState, ErrorState, LoadingRows, PageHeader } from "../ui";

const KIND_LABELS: Record<AlertChannelInput["kind"], string> = {
  webhook: "Webhook",
  slack: "Slack",
  discord: "Discord",
};

const URL_HINTS: Record<AlertChannelInput["kind"], string> = {
  webhook: "Receives a signed JSON POST for every down and recovery event.",
  slack: "A Slack incoming-webhook URL (https://hooks.slack.com/services/...).",
  discord: "A Discord channel webhook URL (https://discord.com/api/webhooks/...).",
};

export function AlertChannels() {
  const { data, error, isLoading, refetch } = useChannelsQuery();
  const [editing, setEditing] = useState<AlertChannelDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<AlertChannelDto | null>(null);
  const [remove] = useDeleteChannelMutation();
  const [test, testState] = useTestChannelMutation();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const addButton = (
    <Button variant="contained" startIcon={<Add />} onClick={() => setEditing("new")}>
      Add channel
    </Button>
  );

  async function sendTest(channel: AlertChannelDto) {
    try {
      const result = await test(channel.id).unwrap();
      setToast(
        result.ok
          ? { ok: true, text: `Test alert sent to ${channel.name}.` }
          : { ok: false, text: `${channel.name} didn't accept it: ${result.error}` },
      );
    } catch (e) {
      setToast({ ok: false, text: errorMessage(e) });
    }
  }

  return (
    <>
      <PageHeader
        title="Alert channels"
        description="Where Pulseboard sends a message when a monitor goes down and when it recovers."
        actions={addButton}
      />
      {isLoading ? (
        <LoadingRows rows={3} />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState
          title="No alert channels"
          body="Add Slack, Discord or a webhook so downtime never goes unnoticed."
          action={addButton}
        />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {data.map((channel) => (
            <li key={channel.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{channel.name}</span>
                  <Chip size="small" label={KIND_LABELS[channel.kind]} />
                  {!channel.enabled && <Chip size="small" variant="outlined" label="Off" />}
                </div>
                <div className="truncate text-sm text-muted">{channel.url}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="small"
                  variant="outlined"
                  disabled={testState.isLoading && testState.originalArgs === channel.id}
                  onClick={() => sendTest(channel)}
                >
                  {testState.isLoading && testState.originalArgs === channel.id ? "Sending..." : "Send test"}
                </Button>
                <Button size="small" onClick={() => setEditing(channel)}>
                  Edit
                </Button>
                <Button size="small" color="error" onClick={() => setDeleting(channel)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ChannelDialog channel={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? "channel"}?`}
        body="Pulseboard stops sending alerts there right away."
        confirmLabel="Delete channel"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting!.id).unwrap()}
      />
      <Snackbar open={Boolean(toast)} autoHideDuration={6000} onClose={() => setToast(null)}>
        <Alert severity={toast?.ok ? "success" : "error"} onClose={() => setToast(null)} variant="filled">
          {toast?.text}
        </Alert>
      </Snackbar>
    </>
  );
}

function ChannelDialog({ channel, onClose }: { channel: AlertChannelDto | null; onClose: () => void }) {
  const [save, { isLoading }] = useSaveChannelMutation();
  const [values, setValues] = useState<AlertChannelInput>({
    name: channel?.name ?? "",
    kind: channel?.kind ?? "slack",
    url: channel?.url ?? "",
    secret: channel?.secret ?? "",
    enabled: channel?.enabled ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = (patch: Partial<AlertChannelInput>) => setValues((v) => ({ ...v, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading) return;
    const parsed = alertChannelInput.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    try {
      await save({
        id: channel?.id ?? null,
        ...values,
        secret: values.kind === "webhook" ? values.secret : null,
      }).unwrap();
      onClose();
    } catch (error) {
      setErrors(errorFields(error));
      setFormError(errorMessage(error));
    }
  }

  return (
    <Dialog open onClose={isLoading ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{channel ? "Edit alert channel" : "New alert channel"}</DialogTitle>
        <DialogContent className="space-y-4 !pt-2">
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={values.name}
            autoFocus
            onChange={(e) => set({ name: e.target.value })}
            error={Boolean(errors.name)}
            helperText={errors.name}
          />
          <TextField
            select
            label="Type"
            value={values.kind}
            onChange={(e) => set({ kind: e.target.value as AlertChannelInput["kind"] })}
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Webhook URL"
            value={values.url}
            onChange={(e) => set({ url: e.target.value })}
            error={Boolean(errors.url)}
            helperText={errors.url ?? URL_HINTS[values.kind]}
          />
          {values.kind === "webhook" && (
            <TextField
              label="Signing secret (optional)"
              value={values.secret ?? ""}
              onChange={(e) => set({ secret: e.target.value })}
              helperText="Adds an x-pulseboard-signature header (HMAC-SHA256) so your endpoint can verify alerts."
            />
          )}
          <FormControlLabel
            control={<Switch checked={values.enabled} onChange={(e) => set({ enabled: e.target.checked })} />}
            label="Enabled"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
