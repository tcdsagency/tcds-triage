-- Weather Alert Settings (per-tenant)
CREATE TABLE "weather_alert_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "poll_interval_minutes" integer DEFAULT 15 NOT NULL,
  "last_poll_at" timestamp,
  "last_poll_status" varchar(20),
  "last_poll_error" text,
  "enabled_alert_types" jsonb,
  "minimum_severity" varchar(20) DEFAULT 'Moderate' NOT NULL,
  "pds_only" boolean DEFAULT false NOT NULL,
  "radius_miles" integer DEFAULT 25 NOT NULL,
  "sms_enabled" boolean DEFAULT false NOT NULL,
  "sms_template" text DEFAULT 'WEATHER ALERT: {{event}} for {{location}}. {{headline}}. Stay safe!',
  "staff_phone_numbers" jsonb,
  "max_sms_per_day" integer DEFAULT 50 NOT NULL,
  "sms_sent_today" integer DEFAULT 0 NOT NULL,
  "last_sms_budget_reset_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "weather_alert_settings_tenant_id_unique" UNIQUE("tenant_id")
);

ALTER TABLE "weather_alert_settings"
  ADD CONSTRAINT "weather_alert_settings_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE no action ON UPDATE no action;

-- Weather Alert Subscriptions (monitored locations)
CREATE TABLE "weather_alert_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "label" varchar(255),
  "address" text,
  "zip" varchar(10),
  "lat" real,
  "lon" real,
  "nws_zone" varchar(20),
  "customer_id" uuid,
  "notify_phone" varchar(20),
  "notify_customer" boolean DEFAULT false NOT NULL,
  "notify_staff" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "weather_alert_subscriptions"
  ADD CONSTRAINT "weather_alert_subscriptions_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "weather_alert_subscriptions"
  ADD CONSTRAINT "weather_alert_subscriptions_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
  ON DELETE no action ON UPDATE no action;

CREATE INDEX "weather_sub_tenant_idx" ON "weather_alert_subscriptions" USING btree ("tenant_id");
CREATE INDEX "weather_sub_zip_idx" ON "weather_alert_subscriptions" USING btree ("zip");
CREATE INDEX "weather_sub_zone_idx" ON "weather_alert_subscriptions" USING btree ("nws_zone");

-- Weather Alert Log (poll run history)
CREATE TABLE "weather_alert_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "run_type" varchar(20) NOT NULL,
  "started_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "locations_checked" integer DEFAULT 0 NOT NULL,
  "alerts_found" integer DEFAULT 0 NOT NULL,
  "notifications_sent" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "weather_alert_log"
  ADD CONSTRAINT "weather_alert_log_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE no action ON UPDATE no action;

CREATE INDEX "weather_log_tenant_idx" ON "weather_alert_log" USING btree ("tenant_id");
CREATE INDEX "weather_log_run_idx" ON "weather_alert_log" USING btree ("run_id");

-- Sent Weather Alerts (detected alerts + notification records)
CREATE TABLE "sent_weather_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "nws_alert_id" text NOT NULL,
  "event" varchar(100) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "headline" text,
  "area_desc" text,
  "is_pds" boolean DEFAULT false NOT NULL,
  "onset" timestamp,
  "expires" timestamp,
  "subscription_id" uuid,
  "sms_sent_at" timestamp,
  "sms_status" varchar(20),
  "sms_recipient" varchar(20),
  "raw_alert" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "sent_weather_alerts"
  ADD CONSTRAINT "sent_weather_alerts_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "sent_weather_alerts"
  ADD CONSTRAINT "sent_weather_alerts_subscription_id_weather_alert_subscriptions_id_fk"
  FOREIGN KEY ("subscription_id") REFERENCES "public"."weather_alert_subscriptions"("id")
  ON DELETE no action ON UPDATE no action;

CREATE INDEX "sent_weather_tenant_idx" ON "sent_weather_alerts" USING btree ("tenant_id");
CREATE UNIQUE INDEX "sent_weather_dedup_idx" ON "sent_weather_alerts" USING btree ("nws_alert_id", "subscription_id");
