"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useState } from "react";
import { formatDateTime, formatDuration } from "@/lib/dates";
import { UPDATE_LABELS } from "@/lib/labels";
import { fieldErrors, incidentUpdateInput, type IncidentUpdateInput } from "@/lib/validation";
import {
  errorMessage,
  POLL_MS,
  useAddIncidentUpdateMutation,
  useIncidentsQuery,
  type IncidentDto,
} from "@/store/api";
import { useCan } from "@/store/store";
import { useNow } from "../use-now";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "../ui";

export function IncidentList() {
  const { data, error, isLoading, refetch } = useIncidentsQuery(undefined, { pollingInterval: POLL_MS });
  const [updating, setUpdating] = useState<IncidentDto | null>(null);
  const open = data?.filter((i) => !i.resolvedAt) ?? [];
  const resolved = data?.filter((i) => i.resolvedAt) ?? [];

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Opened automatically when a monitor goes down, closed when it recovers. Post updates to keep your status pages informed."
      />
      {isLoading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No incidents" body="When a monitor goes down, its incident shows up here." />
      ) : (
        <div className="space-y-8">
          <IncidentSection
            title={`Ongoing (${open.length})`}
            incidents={open}
            onUpdate={setUpdating}
            empty="Nothing is down right now."
          />
          <IncidentSection
            title="Resolved"
            incidents={resolved}
            onUpdate={setUpdating}
            empty="No resolved incidents yet."
          />
        </div>
      )}
      {updating && <UpdateDialog incident={updating} onClose={() => setUpdating(null)} />}
    </>
  );
}

function IncidentSection({
  title,
  incidents,
  onUpdate,
  empty,
}: {
  title: string;
  incidents: IncidentDto[];
  onUpdate: (incident: IncidentDto) => void;
  empty: string;
}) {
  const canEdit = useCan("editor");
  const now = useNow();
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {incidents.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/dashboard/monitors/${incident.monitorId}`} className="font-medium text-ink">
                    {incident.monitorName}
                  </Link>
                  <div className="text-sm text-muted">
                    {formatDateTime(incident.startedAt)} ·{" "}
                    {incident.resolvedAt
                      ? `down for ${formatDuration(Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt))}`
                      : `down for ${formatDuration(now - Date.parse(incident.startedAt))} so far`}
                  </div>
                  <div className="mt-1 text-sm">{incident.cause}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Chip
                    size="small"
                    color={incident.resolvedAt ? "success" : "error"}
                    label={incident.resolvedAt ? "Resolved" : "Ongoing"}
                  />
                  {canEdit && (
                    <Button size="small" variant="outlined" onClick={() => onUpdate(incident)}>
                      Post update
                    </Button>
                  )}
                </div>
              </div>
              {incident.updates.length > 0 && (
                <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
                  {incident.updates.map((u) => (
                    <li key={u.id} className="text-sm">
                      <b>{UPDATE_LABELS[u.status]}</b>{" "}
                      <span className="text-muted">
                        · {formatDateTime(u.createdAt)} · {u.authorName}
                      </span>
                      <div className="whitespace-pre-line">{u.message}</div>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UpdateDialog({ incident, onClose }: { incident: IncidentDto; onClose: () => void }) {
  const [status, setStatus] = useState<IncidentUpdateInput["status"]>(
    incident.resolvedAt ? "resolved" : "investigating",
  );
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [add, { isLoading, error }] = useAddIncidentUpdateMutation();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading) return;
    const parsed = incidentUpdateInput.safeParse({ status, message });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    try {
      await add({ id: incident.id, status, message }).unwrap();
      onClose();
    } catch {
      // Shown below from the mutation state.
    }
  }

  return (
    <Dialog open onClose={isLoading ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>Update: {incident.monitorName}</DialogTitle>
        <DialogContent className="space-y-4 !pt-2">
          {error && <Alert severity="error">{errorMessage(error)}</Alert>}
          <TextField
            select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            {Object.entries(UPDATE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Message"
            multiline
            minRows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            error={Boolean(errors.message)}
            helperText={errors.message ?? "Shown on public status pages that include this monitor."}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? "Saving..." : "Post update"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
