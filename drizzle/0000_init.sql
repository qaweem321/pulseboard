CREATE TYPE "public"."channel_kind" AS ENUM('webhook', 'slack', 'discord');--> statement-breakpoint
CREATE TYPE "public"."http_method" AS ENUM('GET', 'HEAD', 'POST');--> statement-breakpoint
CREATE TYPE "public"."incident_update_status" AS ENUM('investigating', 'identified', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."monitor_status" AS ENUM('pending', 'up', 'down', 'paused');--> statement-breakpoint
CREATE TABLE "alert_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "channel_kind" NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"incident_id" integer,
	"event" text NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"monitor_id" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"status_code" integer,
	"response_ms" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"monitor_id" integer NOT NULL,
	"day" date NOT NULL,
	"checks" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"total_response_ms" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_stats_monitor_id_day_pk" PRIMARY KEY("monitor_id","day")
);
--> statement-breakpoint
CREATE TABLE "incident_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"status" "incident_update_status" NOT NULL,
	"message" text NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"monitor_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"cause" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"method" "http_method" DEFAULT 'GET' NOT NULL,
	"expected_status" text DEFAULT '200-299' NOT NULL,
	"keyword" text,
	"interval_seconds" integer DEFAULT 60 NOT NULL,
	"timeout_ms" integer DEFAULT 10000 NOT NULL,
	"failure_threshold" integer DEFAULT 2 NOT NULL,
	"status" "monitor_status" DEFAULT 'pending' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_response_ms" integer,
	"last_error" text,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_sub" text NOT NULL,
	"roles" text[] NOT NULL,
	"id_token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_page_monitors" (
	"page_id" integer NOT NULL,
	"monitor_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "status_page_monitors_page_id_monitor_id_pk" PRIMARY KEY("page_id","monitor_id")
);
--> statement-breakpoint
CREATE TABLE "status_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"sub" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_sub_users_sub_fk" FOREIGN KEY ("user_sub") REFERENCES "public"."users"("sub") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_deliveries_channel_idx" ON "alert_deliveries" USING btree ("channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "check_results_monitor_time_idx" ON "check_results" USING btree ("monitor_id","checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "incident_updates_incident_idx" ON "incident_updates" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incidents_monitor_idx" ON "incidents" USING btree ("monitor_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_one_open_idx" ON "incidents" USING btree ("monitor_id") WHERE "incidents"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "monitors_due_idx" ON "monitors" USING btree ("next_check_at") WHERE "monitors"."status" <> 'paused';--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_sub");