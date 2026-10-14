"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  fieldErrors,
  INTERVAL_OPTIONS,
  monitorInput,
  normalizeMonitorUrl,
  type MonitorInput,
} from "@/lib/validation";
import {
  errorFields,
  errorMessage,
  useCreateMonitorMutation,
  useUpdateMonitorMutation,
  type MonitorDto,
} from "@/store/api";

const INTERVAL_LABELS: Record<number, string> = {
  30: "Every 30 seconds",
  60: "Every minute",
  120: "Every 2 minutes",
  300: "Every 5 minutes",
  600: "Every 10 minutes",
  1800: "Every 30 minutes",
  3600: "Every hour",
};

type FormState = {
  name: string;
  url: string;
  method: "GET" | "HEAD" | "POST";
  intervalSeconds: number;
  expectedStatus: string;
  keyword: string;
  timeoutSeconds: string;
  failureThreshold: string;
};

function initialState(monitor?: MonitorDto): FormState {
  return {
    name: monitor?.name ?? "",
    url: monitor?.url ?? "",
    method: monitor?.method ?? "GET",
    intervalSeconds: monitor?.intervalSeconds ?? 60,
    expectedStatus: monitor?.expectedStatus ?? "200-299",
    keyword: monitor?.keyword ?? "",
    timeoutSeconds: String((monitor?.timeoutMs ?? 10_000) / 1000),
    failureThreshold: String(monitor?.failureThreshold ?? 2),
  };
}

export function toInput(form: FormState): MonitorInput {
  return {
    name: form.name,
    url: normalizeMonitorUrl(form.url),
    method: form.method,
    intervalSeconds: form.intervalSeconds,
    expectedStatus: form.expectedStatus,
    keyword: form.keyword,
    timeoutMs: Math.round(Number(form.timeoutSeconds) * 1000),
    failureThreshold: Number(form.failureThreshold),
  };
}

export function MonitorForm({ monitor }: { monitor?: MonitorDto }) {
  const router = useRouter();
  const [form, setForm] = useState(() => initialState(monitor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [create, createState] = useCreateMonitorMutation();
  const [update, updateState] = useUpdateMonitorMutation();
  const saving = createState.isLoading || updateState.isLoading;

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));
  const field = (key: keyof FormState, errorKey: string = key) => ({
    value: form[key],
    error: Boolean(errors[errorKey]),
    helperText: errors[errorKey],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key)(e.target.value as never),
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const input = toInput(form);
    const parsed = monitorInput.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    try {
      const saved = monitor
        ? await update({ id: monitor.id, ...input }).unwrap()
        : await create(input).unwrap();
      router.push(`/dashboard/monitors/${saved.id}`);
    } catch (error) {
      setErrors(errorFields(error));
      setFormError(errorMessage(error));
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="max-w-2xl space-y-5 rounded-xl border border-line bg-surface p-6"
    >
      {formError && <Alert severity="error">{formError}</Alert>}
      <TextField label="Name" placeholder="Marketing site" required autoFocus {...field("name")} />
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <TextField select label="Method" {...field("method")}>
          {["GET", "HEAD", "POST"].map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="URL"
          required
          type="url"
          placeholder="https://example.com/health"
          {...field("url")}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField select label="Check" {...field("intervalSeconds")}>
          {INTERVAL_OPTIONS.map((seconds) => (
            <MenuItem key={seconds} value={seconds}>
              {INTERVAL_LABELS[seconds]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Accepted status codes"
          {...field("expectedStatus")}
          helperText={errors.expectedStatus ?? "Codes or ranges, e.g. 200-299,301"}
        />
      </div>
      <TextField
        label="Keyword (optional)"
        {...field("keyword")}
        helperText={errors.keyword ?? "The check fails if the response body doesn't contain this text."}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Timeout (seconds)"
          type="number"
          slotProps={{ htmlInput: { min: 1, max: 30, step: 1 } }}
          {...field("timeoutSeconds", "timeoutMs")}
        />
        <TextField
          label="Failures before alerting"
          type="number"
          slotProps={{ htmlInput: { min: 1, max: 10, step: 1 } }}
          {...field("failureThreshold")}
          helperText={
            errors.failureThreshold ?? "Ignore one-off blips: alert after this many failures in a row."
          }
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving..." : monitor ? "Save changes" : "Create monitor"}
        </Button>
        <Button
          component={Link}
          href={monitor ? `/dashboard/monitors/${monitor.id}` : "/dashboard"}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
