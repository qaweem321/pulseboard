import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const monitorStatus = pgEnum("monitor_status", ["pending", "up", "down", "paused"]);
export const httpMethod = pgEnum("http_method", ["GET", "HEAD", "POST"]);

export const monitors = pgTable(
  "monitors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    method: httpMethod("method").notNull().default("GET"),
    // Accepted status codes, e.g. "200-299" or "200-299,301".
    expectedStatus: text("expected_status").notNull().default("200-299"),
    // When set, the response body must contain this text.
    keyword: text("keyword"),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    timeoutMs: integer("timeout_ms").notNull().default(10_000),
    // Failures in a row before the monitor counts as down (filters out one-off blips).
    failureThreshold: integer("failure_threshold").notNull().default(2),
    status: monitorStatus("status").notNull().default("pending"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastResponseMs: integer("last_response_ms"),
    lastError: text("last_error"),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("monitors_due_idx")
      .on(t.nextCheckAt)
      .where(sql`${t.status} <> 'paused'`),
  ],
);

export const checkResults = pgTable(
  "check_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    ok: boolean("ok").notNull(),
    statusCode: integer("status_code"),
    responseMs: integer("response_ms"),
    error: text("error"),
  },
  (t) => [index("check_results_monitor_time_idx").on(t.monitorId, t.checkedAt.desc())],
);

// One row per monitor per UTC day, so 90-day uptime bars never scan raw checks.
export const dailyStats = pgTable(
  "daily_stats",
  {
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    checks: integer("checks").notNull().default(0),
    failures: integer("failures").notNull().default(0),
    totalResponseMs: bigint("total_response_ms", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.monitorId, t.day] })],
);

export const incidents = pgTable(
  "incidents",
  {
    id: serial("id").primaryKey(),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    cause: text("cause").notNull(),
  },
  (t) => [
    index("incidents_monitor_idx").on(t.monitorId, t.startedAt.desc()),
    // At most one open incident per monitor, enforced by the database.
    uniqueIndex("incidents_one_open_idx")
      .on(t.monitorId)
      .where(sql`${t.resolvedAt} is null`),
  ],
);

export const incidentUpdateStatus = pgEnum("incident_update_status", [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

export const incidentUpdates = pgTable(
  "incident_updates",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    status: incidentUpdateStatus("status").notNull(),
    message: text("message").notNull(),
    authorName: text("author_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("incident_updates_incident_idx").on(t.incidentId)],
);

export const statusPages = pgTable("status_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  published: boolean("published").notNull().default(true),
  createdAt: createdAt(),
});

export const statusPageMonitors = pgTable(
  "status_page_monitors",
  {
    pageId: integer("page_id")
      .notNull()
      .references(() => statusPages.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.monitorId] })],
);

export const channelKind = pgEnum("channel_kind", ["webhook", "slack", "discord"]);

export const alertChannels = pgTable("alert_channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: channelKind("kind").notNull(),
  url: text("url").notNull(),
  // Webhook channels sign each body with HMAC-SHA256 using this secret.
  secret: text("secret"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
});

export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
    incidentId: integer("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    ok: boolean("ok").notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("alert_deliveries_channel_idx").on(t.channelId, t.createdAt.desc())],
);

export const users = pgTable("users", {
  // The Keycloak subject (user id).
  sub: text("sub").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie value: a leaked database row can't be replayed as a cookie.
    id: text("id").primaryKey(),
    userSub: text("user_sub")
      .notNull()
      .references(() => users.sub, { onDelete: "cascade" }),
    roles: text("roles").array().notNull(),
    idToken: text("id_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userSub)],
);

export type Monitor = typeof monitors.$inferSelect;
export type NewMonitor = typeof monitors.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type AlertChannel = typeof alertChannels.$inferSelect;
export type StatusPage = typeof statusPages.$inferSelect;
