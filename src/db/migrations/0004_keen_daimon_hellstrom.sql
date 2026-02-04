CREATE TYPE "public"."renewal_audit_event_type" AS ENUM('ingested', 'compared', 'sr_created', 'sr_updated', 'agent_decision', 'note_posted', 'sr_moved', 'completed');--> statement-breakpoint
CREATE TYPE "public"."renewal_batch_status" AS ENUM('uploaded', 'extracting', 'filtering', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."renewal_candidate_status" AS ENUM('pending', 'fetching_baseline', 'comparing', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."renewal_comparison_status" AS ENUM('pending_ingestion', 'comparison_ready', 'waiting_agent_review', 'agent_reviewed', 'requote_requested', 'quote_ready', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."renewal_recommendation" AS ENUM('renew_as_is', 'reshop', 'needs_review');--> statement-breakpoint
CREATE TABLE "az_pipeline_stage_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pipeline_id" integer NOT NULL,
	"stage_id" integer NOT NULL,
	"stage_name" varchar(100) NOT NULL,
	"canonical_name" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier_name" varchar(100) NOT NULL,
	"carrier_code" varchar(20),
	"al3_company_code" varchar(20),
	"renewal_transaction_types" jsonb DEFAULT '["RWL","RWQ"]'::jsonb,
	"al3_parsing_rules" jsonb,
	"comparison_thresholds" jsonb,
	"premium_increase_threshold_percent" numeric(5, 2) DEFAULT '10',
	"auto_renew_threshold_percent" numeric(5, 2) DEFAULT '5',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"renewal_comparison_id" uuid NOT NULL,
	"event_type" "renewal_audit_event_type" NOT NULL,
	"event_data" jsonb,
	"performed_by" varchar(100),
	"performed_by_user_id" uuid,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uploaded_by_id" uuid,
	"original_file_name" text NOT NULL,
	"file_size" integer,
	"storage_path" text,
	"status" "renewal_batch_status" DEFAULT 'uploaded' NOT NULL,
	"total_al3_files_found" integer DEFAULT 0,
	"total_transactions_found" integer DEFAULT 0,
	"total_renewal_transactions" integer DEFAULT 0,
	"total_candidates_created" integer DEFAULT 0,
	"duplicates_removed" integer DEFAULT 0,
	"candidates_completed" integer DEFAULT 0,
	"candidates_failed" integer DEFAULT 0,
	"candidates_skipped" integer DEFAULT 0,
	"error_message" text,
	"processing_log" jsonb DEFAULT '[]'::jsonb,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"status" "renewal_candidate_status" DEFAULT 'pending' NOT NULL,
	"transaction_type" varchar(10),
	"policy_number" varchar(50),
	"carrier_code" varchar(20),
	"carrier_name" varchar(100),
	"line_of_business" varchar(50),
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"carrier_profile_id" uuid,
	"policy_id" uuid,
	"customer_id" uuid,
	"comparison_id" uuid,
	"raw_al3_content" text,
	"al3_file_name" varchar(255),
	"renewal_snapshot" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"policy_id" uuid,
	"renewal_effective_date" timestamp NOT NULL,
	"renewal_expiration_date" timestamp,
	"current_premium" numeric(12, 2),
	"renewal_premium" numeric(12, 2),
	"premium_change_amount" numeric(12, 2),
	"premium_change_percent" numeric(6, 2),
	"recommendation" "renewal_recommendation",
	"status" "renewal_comparison_status" DEFAULT 'pending_ingestion' NOT NULL,
	"verification_status" varchar(50),
	"agent_decision" varchar(50),
	"agent_decision_at" timestamp,
	"agent_decision_by" uuid,
	"agent_notes" text,
	"renewal_snapshot" jsonb,
	"baseline_snapshot" jsonb,
	"material_changes" jsonb DEFAULT '[]'::jsonb,
	"comparison_summary" jsonb,
	"agencyzoom_sr_id" integer,
	"agencyzoom_sr_created_at" timestamp,
	"carrier_name" varchar(100),
	"line_of_business" varchar(50),
	"policy_number" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "az_pipeline_stage_config" ADD CONSTRAINT "az_pipeline_stage_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_profiles" ADD CONSTRAINT "carrier_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_audit_log" ADD CONSTRAINT "renewal_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_audit_log" ADD CONSTRAINT "renewal_audit_log_renewal_comparison_id_renewal_comparisons_id_fk" FOREIGN KEY ("renewal_comparison_id") REFERENCES "public"."renewal_comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_audit_log" ADD CONSTRAINT "renewal_audit_log_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_batches" ADD CONSTRAINT "renewal_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_batches" ADD CONSTRAINT "renewal_batches_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD CONSTRAINT "renewal_candidates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD CONSTRAINT "renewal_candidates_batch_id_renewal_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."renewal_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD CONSTRAINT "renewal_candidates_carrier_profile_id_carrier_profiles_id_fk" FOREIGN KEY ("carrier_profile_id") REFERENCES "public"."carrier_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD CONSTRAINT "renewal_candidates_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD CONSTRAINT "renewal_candidates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD CONSTRAINT "renewal_candidates_comparison_id_renewal_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."renewal_comparisons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD CONSTRAINT "renewal_comparisons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD CONSTRAINT "renewal_comparisons_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD CONSTRAINT "renewal_comparisons_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD CONSTRAINT "renewal_comparisons_agent_decision_by_users_id_fk" FOREIGN KEY ("agent_decision_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "az_pipeline_stage_config_tenant_idx" ON "az_pipeline_stage_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "az_pipeline_stage_config_canonical_unique" ON "az_pipeline_stage_config" USING btree ("tenant_id","pipeline_id","canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "az_pipeline_stage_config_stage_unique" ON "az_pipeline_stage_config" USING btree ("tenant_id","pipeline_id","stage_id");--> statement-breakpoint
CREATE INDEX "carrier_profiles_tenant_idx" ON "carrier_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "carrier_profiles_code_idx" ON "carrier_profiles" USING btree ("tenant_id","carrier_code");--> statement-breakpoint
CREATE UNIQUE INDEX "carrier_profiles_name_unique" ON "carrier_profiles" USING btree ("tenant_id","carrier_name");--> statement-breakpoint
CREATE INDEX "renewal_audit_log_tenant_idx" ON "renewal_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "renewal_audit_log_comparison_idx" ON "renewal_audit_log" USING btree ("renewal_comparison_id");--> statement-breakpoint
CREATE INDEX "renewal_audit_log_type_idx" ON "renewal_audit_log" USING btree ("tenant_id","event_type");--> statement-breakpoint
CREATE INDEX "renewal_audit_log_date_idx" ON "renewal_audit_log" USING btree ("tenant_id","performed_at");--> statement-breakpoint
CREATE INDEX "renewal_batches_tenant_idx" ON "renewal_batches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "renewal_batches_status_idx" ON "renewal_batches" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "renewal_batches_created_idx" ON "renewal_batches" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "renewal_candidates_tenant_idx" ON "renewal_candidates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "renewal_candidates_batch_idx" ON "renewal_candidates" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "renewal_candidates_status_idx" ON "renewal_candidates" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "renewal_candidates_policy_idx" ON "renewal_candidates" USING btree ("policy_number");--> statement-breakpoint
CREATE UNIQUE INDEX "renewal_candidates_dedup_unique" ON "renewal_candidates" USING btree ("tenant_id","carrier_code","policy_number","effective_date");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_tenant_idx" ON "renewal_comparisons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_customer_idx" ON "renewal_comparisons" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_policy_idx" ON "renewal_comparisons" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_status_idx" ON "renewal_comparisons" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_date_idx" ON "renewal_comparisons" USING btree ("tenant_id","renewal_effective_date");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_carrier_idx" ON "renewal_comparisons" USING btree ("tenant_id","carrier_name");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_lob_idx" ON "renewal_comparisons" USING btree ("tenant_id","line_of_business");--> statement-breakpoint
CREATE UNIQUE INDEX "renewal_comparisons_policy_date_unique" ON "renewal_comparisons" USING btree ("policy_id","renewal_effective_date");