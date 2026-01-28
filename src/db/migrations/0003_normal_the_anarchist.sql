CREATE TYPE "public"."correction_type" AS ENUM('wrong_value', 'missing_value', 'extra_value', 'format_issue', 'context_error');--> statement-breakpoint
CREATE TYPE "public"."evaluation_run_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prompt_version_status" AS ENUM('draft', 'testing', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "ai_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wrapup_draft_id" uuid,
	"call_id" uuid,
	"field_name" text NOT NULL,
	"ai_value" text,
	"agent_value" text,
	"correction_type" "correction_type" NOT NULL,
	"transcript_excerpt" text,
	"full_transcript" text,
	"corrected_by_id" uuid,
	"corrected_at" timestamp DEFAULT now() NOT NULL,
	"used_in_evaluation" boolean DEFAULT false,
	"evaluation_batch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wrapup_draft_id" uuid NOT NULL,
	"call_id" uuid,
	"intent_number" integer NOT NULL,
	"summary" text,
	"request_type" text,
	"category_id" integer,
	"priority_id" integer,
	"description" text,
	"transcript_excerpt" text,
	"confidence" numeric(3, 2),
	"ticket_created" boolean DEFAULT false,
	"ticket_id" uuid,
	"az_ticket_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"prompt_version_id" uuid NOT NULL,
	"baseline_prompt_version_id" uuid,
	"evaluation_dataset_size" integer NOT NULL,
	"correction_ids" uuid[],
	"status" "evaluation_run_status" DEFAULT 'pending' NOT NULL,
	"results" jsonb,
	"overall_accuracy" numeric(5, 4),
	"field_accuracies" jsonb,
	"improvement_delta" numeric(5, 4),
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"triggered_by_id" uuid,
	"trigger_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"prompt_type" text NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text NOT NULL,
	"status" "prompt_version_status" DEFAULT 'draft' NOT NULL,
	"evaluation_results" jsonb,
	"suggested_improvements" text,
	"created_by_id" uuid,
	"activated_by_id" uuid,
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_cache" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk_monitor_alerts" ADD COLUMN "service_ticket_id" varchar(50);--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "summary_edited" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "summary_edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "ai_triage_recommendation" jsonb;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "appended_to_ticket_id" integer;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "similarity_computed_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "ai_similarity_score" integer;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "ai_related_ticket_id" integer;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "ai_recommendation_reason" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "priority" "triage_priority" DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "priority_score" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "priority_reasons" text[];--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "intent_count" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "multi_intent_detected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "multi_intent_warning_acknowledged" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "has_corrections" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "correction_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "assigned_to_id" uuid;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "assigned_by_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_wrapup_draft_id_wrapup_drafts_id_fk" FOREIGN KEY ("wrapup_draft_id") REFERENCES "public"."wrapup_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_corrections" ADD CONSTRAINT "ai_corrections_corrected_by_id_users_id_fk" FOREIGN KEY ("corrected_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_intents" ADD CONSTRAINT "call_intents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_intents" ADD CONSTRAINT "call_intents_wrapup_draft_id_wrapup_drafts_id_fk" FOREIGN KEY ("wrapup_draft_id") REFERENCES "public"."wrapup_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_intents" ADD CONSTRAINT "call_intents_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_intents" ADD CONSTRAINT "call_intents_ticket_id_service_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."service_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_baseline_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("baseline_prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_triggered_by_id_users_id_fk" FOREIGN KEY ("triggered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_activated_by_id_users_id_fk" FOREIGN KEY ("activated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_corrections_tenant_idx" ON "ai_corrections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_corrections_wrapup_idx" ON "ai_corrections" USING btree ("wrapup_draft_id");--> statement-breakpoint
CREATE INDEX "ai_corrections_field_idx" ON "ai_corrections" USING btree ("tenant_id","field_name");--> statement-breakpoint
CREATE INDEX "ai_corrections_date_idx" ON "ai_corrections" USING btree ("tenant_id","corrected_at");--> statement-breakpoint
CREATE INDEX "ai_corrections_eval_idx" ON "ai_corrections" USING btree ("used_in_evaluation");--> statement-breakpoint
CREATE INDEX "call_intents_tenant_idx" ON "call_intents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "call_intents_wrapup_idx" ON "call_intents" USING btree ("wrapup_draft_id");--> statement-breakpoint
CREATE INDEX "call_intents_call_idx" ON "call_intents" USING btree ("call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "call_intents_wrapup_intent_unique" ON "call_intents" USING btree ("wrapup_draft_id","intent_number");--> statement-breakpoint
CREATE INDEX "evaluation_runs_tenant_idx" ON "evaluation_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "evaluation_runs_prompt_idx" ON "evaluation_runs" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "evaluation_runs_status_idx" ON "evaluation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prompt_versions_tenant_idx" ON "prompt_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_type_status_idx" ON "prompt_versions" USING btree ("prompt_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_type_version_unique" ON "prompt_versions" USING btree ("tenant_id","prompt_type","version");--> statement-breakpoint
CREATE INDEX "system_cache_expires_idx" ON "system_cache" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wrapup_drafts_priority_idx" ON "wrapup_drafts" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "wrapup_drafts_assigned_idx" ON "wrapup_drafts" USING btree ("assigned_to_id");