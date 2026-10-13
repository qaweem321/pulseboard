import { z } from "zod";
import { parseStatusRanges } from "./status-codes";

// Shared by the forms (instant feedback) and the API (the real check).

const trimmed = (max: number) => z.string().trim().min(1, "Required").max(max, `At most ${max} characters`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .nullable()
    .default(null)
    .transform((value) => value || null);

export const INTERVAL_OPTIONS = [30, 60, 120, 300, 600, 1800, 3600] as const;

export const monitorInput = z.object({
  name: trimmed(80),
  url: z
    .string()
    .trim()
    .url("Enter a full URL, like https://example.com/health")
    .refine((value) => /^https?:\/\//i.test(value), "Only http and https URLs can be monitored"),
  method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
  expectedStatus: z
    .string()
    .trim()
    .default("200-299")
    .refine((value) => parseStatusRanges(value) !== null, "Use codes or ranges like 200-299,301"),
  keyword: optionalText(200),
  intervalSeconds: z.coerce
    .number()
    .int()
    .default(60)
    .refine((value) => (INTERVAL_OPTIONS as readonly number[]).includes(value), "Pick one of the intervals"),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(1000, "At least 1 second")
    .max(30_000, "At most 30 seconds")
    .default(10_000),
  failureThreshold: z.coerce.number().int().min(1, "At least 1").max(10, "At most 10").default(2),
});
export type MonitorInput = z.input<typeof monitorInput>;
export type MonitorValues = z.output<typeof monitorInput>;

export const monitorPatch = monitorInput.partial().extend({ paused: z.boolean().optional() });

export const statusPageInput = z.object({
  title: trimmed(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/, "Lowercase letters, numbers and dashes, up to 50"),
  description: z.string().trim().max(500).default(""),
  published: z.boolean().default(true),
  monitorIds: z.array(z.number().int().positive()).max(100).default([]),
});
export type StatusPageInput = z.input<typeof statusPageInput>;

export const alertChannelInput = z.object({
  name: trimmed(80),
  kind: z.enum(["webhook", "slack", "discord"]),
  url: z.string().trim().url("Enter the full webhook URL"),
  secret: optionalText(200),
  enabled: z.boolean().default(true),
});
export type AlertChannelInput = z.input<typeof alertChannelInput>;

export const incidentUpdateInput = z.object({
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  message: trimmed(2000),
});
export type IncidentUpdateInput = z.input<typeof incidentUpdateInput>;

export const RANGES = ["24h", "7d", "30d"] as const;
export type Range = (typeof RANGES)[number];

// Field errors keyed by field name, for showing under each input.
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
