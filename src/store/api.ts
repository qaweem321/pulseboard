import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Range } from "@/lib/validation";
import type { MonitorInput, StatusPageInput, AlertChannelInput, IncidentUpdateInput } from "@/lib/validation";
import type { AlertChannel, Monitor, StatusPage } from "@/server/db/schema";
import type { IncidentWithUpdates } from "@/server/queries/incidents";
import type { MonitorSummary, ResponsePoint } from "@/server/queries/monitors";
import type { DayStat } from "@/lib/uptime";

// JSON turns Dates into strings; these types say so.
type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

export type MonitorSummaryDto = Jsonify<MonitorSummary>;
export type MonitorDto = Jsonify<Monitor>;
export type IncidentDto = Jsonify<IncidentWithUpdates>;
export type StatusPageDto = Jsonify<StatusPage> & { monitorIds: number[] };
export type AlertChannelDto = Jsonify<AlertChannel>;
export type MonitorDetailDto = {
  monitor: MonitorDto;
  bars: DayStat[];
  checks: Jsonify<{
    id: number;
    checkedAt: Date;
    ok: boolean;
    statusCode: number | null;
    responseMs: number | null;
    error: string | null;
  }>[];
  incidents: Jsonify<{ id: number; startedAt: Date; resolvedAt: Date | null; cause: string }>[];
};
export type SeriesDto = { range: Range; bucketMs: number; from: string; to: string; points: ResponsePoint[] };

export type ApiError = { status: number; data?: { error?: string; fields?: Record<string, string[]> } };

export const POLL_MS = 30_000;

// When the session expires mid-use, send the user to log in and come back to the same page.
// Absolute in the browser (and in tests, where Node's fetch rejects relative URLs).
const baseUrl = typeof window === "undefined" ? "/api" : new URL("/api", window.location.origin).toString();
const baseQuery = fetchBaseQuery({ baseUrl });
const baseQueryWithLogin: typeof baseQuery = async (args, api, extra) => {
  const result = await baseQuery(args, api, extra);
  if (result.error?.status === 401 && typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    window.location.replace(`/login?next=${encodeURIComponent(next)}&expired=1`);
  }
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithLogin,
  tagTypes: ["Monitor", "Incident", "StatusPage", "Channel"],
  endpoints: (build) => ({
    monitors: build.query<MonitorSummaryDto[], void>({
      query: () => "monitors",
      providesTags: ["Monitor"],
    }),
    monitor: build.query<MonitorDetailDto, number>({
      query: (id) => `monitors/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Monitor", id }],
    }),
    series: build.query<SeriesDto, { id: number; range: Range }>({
      query: ({ id, range }) => `monitors/${id}/series?range=${range}`,
      providesTags: (_r, _e, { id }) => [{ type: "Monitor", id }],
    }),
    createMonitor: build.mutation<MonitorDto, MonitorInput>({
      query: (body) => ({ url: "monitors", method: "POST", body }),
      invalidatesTags: ["Monitor"],
    }),
    updateMonitor: build.mutation<MonitorDto, { id: number } & Partial<MonitorInput> & { paused?: boolean }>({
      query: ({ id, ...body }) => ({ url: `monitors/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Monitor", "Incident"],
    }),
    deleteMonitor: build.mutation<void, number>({
      query: (id) => ({ url: `monitors/${id}`, method: "DELETE" }),
      invalidatesTags: ["Monitor", "Incident", "StatusPage"],
    }),
    incidents: build.query<IncidentDto[], void>({
      query: () => "incidents",
      providesTags: ["Incident"],
    }),
    addIncidentUpdate: build.mutation<void, { id: number } & IncidentUpdateInput>({
      query: ({ id, ...body }) => ({ url: `incidents/${id}/updates`, method: "POST", body }),
      invalidatesTags: ["Incident"],
    }),
    statusPages: build.query<StatusPageDto[], void>({
      query: () => "status-pages",
      providesTags: ["StatusPage"],
    }),
    saveStatusPage: build.mutation<StatusPageDto, { id: number | null } & StatusPageInput>({
      query: ({ id, ...body }) =>
        id
          ? { url: `status-pages/${id}`, method: "PUT", body }
          : { url: "status-pages", method: "POST", body },
      invalidatesTags: ["StatusPage"],
    }),
    deleteStatusPage: build.mutation<void, number>({
      query: (id) => ({ url: `status-pages/${id}`, method: "DELETE" }),
      invalidatesTags: ["StatusPage"],
    }),
    channels: build.query<AlertChannelDto[], void>({
      query: () => "alert-channels",
      providesTags: ["Channel"],
    }),
    saveChannel: build.mutation<AlertChannelDto, { id: number | null } & AlertChannelInput>({
      query: ({ id, ...body }) =>
        id
          ? { url: `alert-channels/${id}`, method: "PUT", body }
          : { url: "alert-channels", method: "POST", body },
      invalidatesTags: ["Channel"],
    }),
    deleteChannel: build.mutation<void, number>({
      query: (id) => ({ url: `alert-channels/${id}`, method: "DELETE" }),
      invalidatesTags: ["Channel"],
    }),
    testChannel: build.mutation<{ ok: boolean; error: string | null }, number>({
      query: (id) => ({ url: `alert-channels/${id}/test`, method: "POST" }),
    }),
  }),
});

export const {
  useMonitorsQuery,
  useMonitorQuery,
  useSeriesQuery,
  useCreateMonitorMutation,
  useUpdateMonitorMutation,
  useDeleteMonitorMutation,
  useIncidentsQuery,
  useAddIncidentUpdateMutation,
  useStatusPagesQuery,
  useSaveStatusPageMutation,
  useDeleteStatusPageMutation,
  useChannelsQuery,
  useSaveChannelMutation,
  useDeleteChannelMutation,
  useTestChannelMutation,
} = api;

export function errorMessage(error: unknown): string {
  const data = (error as ApiError | undefined)?.data;
  return data?.error ?? "Something went wrong. Please try again.";
}

export function errorFields(error: unknown): Record<string, string> {
  const fields = (error as ApiError | undefined)?.data?.fields ?? {};
  return Object.fromEntries(Object.entries(fields).map(([key, messages]) => [key, messages[0] ?? ""]));
}
