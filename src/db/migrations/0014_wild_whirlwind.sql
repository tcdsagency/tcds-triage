CREATE TYPE "public"."commission_match_status" AS ENUM('unmatched', 'matched', 'manual');--> statement-breakpoint
CREATE TABLE "dead_letter_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"queue_name" varchar(100) NOT NULL,
	"job_id" varchar(200) NOT NULL,
	"job_name" varchar(200),
	"job_data" jsonb,
	"error" text,
	"stack" text,
	"attempts_made" integer,
	"failed_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolution" text
);
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "assistant_documents" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "assistant_sessions" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "features" SET DEFAULT '{"aiAssistant":true,"voiceTranscription":true,"propertyIntelligence":false,"commercialQuotes":false,"trainingSystem":true,"riskMonitor":false,"reviewAutoSend":true,"autoCreateServiceTickets":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "commission_import_batches" ADD COLUMN "file_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "commission_policies" ADD COLUMN "central_policy_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_policies" ADD COLUMN "match_status" "commission_match_status" DEFAULT 'unmatched' NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "prior_term_captured_at" timestamp;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "sync_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_monitor_policies" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "risk_monitor_policies" ADD COLUMN "policy_id" uuid;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD COLUMN "locally_modified_at" timestamp;--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_queue_idx" ON "dead_letter_jobs" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_failed_at_idx" ON "dead_letter_jobs" USING btree ("failed_at");--> statement-breakpoint
ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_central_policy_id_policies_id_fk" FOREIGN KEY ("central_policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_policies" ADD CONSTRAINT "risk_monitor_policies_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_policies" ADD CONSTRAINT "risk_monitor_policies_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_import_batches_file_hash_idx" ON "commission_import_batches" USING btree ("tenant_id","file_hash");--> statement-breakpoint
CREATE INDEX "commission_policies_central_policy_idx" ON "commission_policies" USING btree ("central_policy_id");--> statement-breakpoint
CREATE INDEX "commission_policies_match_status_idx" ON "commission_policies" USING btree ("match_status");