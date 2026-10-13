"use client";

import Add from "@mui/icons-material/Add";
import OpenInNew from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { fieldErrors, statusPageInput } from "@/lib/validation";
import {
  errorFields,
  errorMessage,
  useDeleteStatusPageMutation,
  useMonitorsQuery,
  useSaveStatusPageMutation,
  useStatusPagesQuery,
  type StatusPageDto,
} from "@/store/api";
import { useCan } from "@/store/store";
import { ConfirmDialog, EmptyState, ErrorState, LoadingRows, PageHeader } from "../ui";

export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

type Editing = StatusPageDto | "new" | null;

export function StatusPageManager() {
  const { data, error, isLoading, refetch } = useStatusPagesQuery();
  const canEdit = useCan("editor");
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<StatusPageDto | null>(null);
  const [remove] = useDeleteStatusPageMutation();
  const addButton = canEdit && (
    <Button variant="contained" startIcon={<Add />} onClick={() => setEditing("new")}>
      New status page
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Status pages"
        description="Public pages that show your users what's up and what's down, without exposing internal URLs or errors."
        actions={addButton}
      />
      {isLoading ? (
        <LoadingRows rows={3} />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState
          title="No status pages yet"
          body="Create one and share its link with your customers."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((page) => (
            <li key={page.id} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{page.title}</h2>
                  <div className="truncate text-sm text-muted">/status/{page.slug}</div>
                </div>
                <Chip
                  size="small"
                  label={page.published ? "Published" : "Draft"}
                  color={page.published ? "success" : "default"}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {page.monitorIds.length} {page.monitorIds.length === 1 ? "monitor" : "monitors"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {page.published && (
                  <Button
                    size="small"
                    href={`/status/${page.slug}`}
                    target="_blank"
                    endIcon={<OpenInNew fontSize="small" />}
                  >
                    View
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button size="small" onClick={() => setEditing(page)}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => setDeleting(page)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <StatusPageDialog page={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.title ?? "status page"}?`}
        body="The public link stops working right away. Monitors and their history are kept."
        confirmLabel="Delete page"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting!.id).unwrap()}
      />
    </>
  );
}

function StatusPageDialog({ page, onClose }: { page: StatusPageDto | null; onClose: () => void }) {
  const { data: monitors = [] } = useMonitorsQuery();
  const [save, { isLoading }] = useSaveStatusPageMutation();
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(page));
  const [description, setDescription] = useState(page?.description ?? "");
  const [published, setPublished] = useState(page?.published ?? true);
  const [monitorIds, setMonitorIds] = useState<number[]>(page?.monitorIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const byId = new Map(monitors.map((m) => [m.id, m]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading) return;
    const values = { title, slug, description, published, monitorIds };
    const parsed = statusPageInput.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError(null);
    try {
      await save({ id: page?.id ?? null, ...values }).unwrap();
      onClose();
    } catch (error) {
      const fields = errorFields(error);
      if ((error as { status?: number }).status === 409) fields.slug = errorMessage(error);
      setErrors(fields);
      setFormError(errorMessage(error));
    }
  }

  return (
    <Dialog open onClose={isLoading ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{page ? "Edit status page" : "New status page"}</DialogTitle>
        <DialogContent className="space-y-4 !pt-2">
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Title"
            value={title}
            autoFocus
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            error={Boolean(errors.title)}
            helperText={errors.title}
          />
          <TextField
            label="Address"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            error={Boolean(errors.slug)}
            helperText={errors.slug ?? `Public link: /status/${slug || "your-page"}`}
          />
          <TextField
            label="Description (optional)"
            value={description}
            multiline
            minRows={2}
            onChange={(e) => setDescription(e.target.value)}
            error={Boolean(errors.description)}
            helperText={errors.description}
          />
          <Autocomplete
            multiple
            options={monitors.map((m) => m.id)}
            value={monitorIds}
            onChange={(_, value) => setMonitorIds(value)}
            getOptionLabel={(id) => byId.get(id)?.name ?? `Monitor ${id}`}
            renderInput={(params) => (
              <TextField {...params} label="Monitors" helperText="Shown in the order you pick them." />
            )}
          />
          <FormControlLabel
            control={<Switch checked={published} onChange={(e) => setPublished(e.target.checked)} />}
            label="Published (anyone with the link can see it)"
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
