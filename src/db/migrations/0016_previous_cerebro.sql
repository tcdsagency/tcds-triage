ALTER TYPE "public"."renewal_candidate_status" ADD VALUE 'awaiting_az_ticket' BEFORE 'pending';--> statement-breakpoint
CREATE TABLE "hawksoft_attachment_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hawksoft_attachment_id" varchar(50) NOT NULL,
	"hawksoft_client_uuid" varchar(36) NOT NULL,
	"policy_number" varchar(50),
	"al3_type" integer,
	"effective_date" timestamp,
	"file_ext" varchar(10),
	"file_size" integer,
	"processed_at" timestamp,
	"batch_id" uuid,
	"status" varchar(20) DEFAULT 'downloaded' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threecx_polling_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"last_seen_id" integer DEFAULT 0 NOT NULL,
	"last_polled_at" timestamp,
	"poll_errors" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processing_started_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_recording_id" integer;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_sentiment_score" integer;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_summary" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_transcription" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_recording_url" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_call_type" varchar(30);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_from_dn" varchar(10);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_to_dn" varchar(10);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_from_caller_number" varchar(20);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_to_caller_number" varchar(20);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "threecx_polled_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "ezlynx_account_id" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "ezlynx_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "hawksoft_cloud_uuid" varchar(36);--> statement-breakpoint
ALTER TABLE "property_lookups" ADD COLUMN "report_card" jsonb;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD COLUMN "agencyzoom_sr_id" integer;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "threecx_recording_id" integer;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "threecx_summary" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "threecx_sentiment_score" integer;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "source" varchar(20) DEFAULT 'threecx';--> statement-breakpoint
ALTER TABLE "hawksoft_attachment_log" ADD CONSTRAINT "hawksoft_attachment_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hawksoft_attachment_log" ADD CONSTRAINT "hawksoft_attachment_log_batch_id_renewal_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."renewal_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threecx_polling_state" ADD CONSTRAINT "threecx_polling_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hs_attachment_log_tenant_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hs_attachment_log_dedup_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id","hawksoft_attachment_id");--> statement-breakpoint
CREATE INDEX "hs_attachment_log_policy_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id","policy_number");--> statement-breakpoint
CREATE UNIQUE INDEX "threecx_polling_state_tenant_unique" ON "threecx_polling_state" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_ezlynx_idx" ON "customers" USING btree ("tenant_id","ezlynx_account_id");