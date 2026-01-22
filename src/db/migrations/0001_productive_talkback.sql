CREATE TYPE "public"."api_retry_queue_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."canopy_match_status" AS ENUM('pending', 'matched', 'created', 'needs_review', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."customer_intel_category" AS ENUM('family', 'occupation', 'life_event', 'vehicle', 'property', 'interest', 'preference', 'personality', 'concern', 'plan', 'other');--> statement-breakpoint
CREATE TYPE "public"."life_quote_status" AS ENUM('quoted', 'emailed', 'application_started', 'application_submitted', 'policy_issued', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."mortgagee_check_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'captcha_failed', 'not_found', 'site_blocked');--> statement-breakpoint
CREATE TYPE "public"."mortgagee_payment_status" AS ENUM('current', 'late', 'grace_period', 'lapsed', 'unknown', 'pending_check', 'error');--> statement-breakpoint
CREATE TYPE "public"."policy_change_status" AS ENUM('pending', 'in_review', 'submitted_to_carrier', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."policy_change_type" AS ENUM('add_vehicle', 'remove_vehicle', 'replace_vehicle', 'add_driver', 'remove_driver', 'address_change', 'add_mortgagee', 'remove_mortgagee', 'coverage_change', 'cancel_policy');--> statement-breakpoint
CREATE TYPE "public"."policy_notice_review_status" AS ENUM('pending', 'assigned', 'reviewed', 'flagged', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."policy_notice_type" AS ENUM('billing', 'policy', 'claim');--> statement-breakpoint
CREATE TYPE "public"."policy_notice_urgency" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."same_day_payment_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
ALTER TYPE "public"."triage_type" ADD VALUE 'message';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'csr' BEFORE 'trainee';--> statement-breakpoint
CREATE TABLE "agency_carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"products" text,
	"new_business_commission" text,
	"renewal_commission" text,
	"agency_support_phone" text,
	"agency_code" text,
	"marketing_rep_name" text,
	"marketing_rep_email" text,
	"marketing_rep_phone" text,
	"portal_url" text,
	"portal_username" text,
	"portal_password" text,
	"is_favorite" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_retry_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"operation_type" text NOT NULL,
	"target_service" text NOT NULL,
	"request_payload" jsonb NOT NULL,
	"wrapup_draft_id" uuid,
	"call_id" uuid,
	"customer_id" text,
	"status" "api_retry_queue_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp,
	"last_error" text,
	"error_history" jsonb,
	"result_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "canopy_connect_pulls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pull_id" varchar(100) NOT NULL,
	"pull_status" varchar(50),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(20),
	"date_of_birth" date,
	"address" jsonb,
	"secondary_insured" jsonb,
	"carrier_name" varchar(100),
	"carrier_friendly_name" varchar(100),
	"policies" jsonb DEFAULT '[]'::jsonb,
	"vehicles" jsonb DEFAULT '[]'::jsonb,
	"drivers" jsonb DEFAULT '[]'::jsonb,
	"dwellings" jsonb DEFAULT '[]'::jsonb,
	"coverages" jsonb DEFAULT '[]'::jsonb,
	"claims" jsonb DEFAULT '[]'::jsonb,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"canopy_link_used" varchar(255),
	"total_premium_cents" integer,
	"policy_count" integer DEFAULT 0,
	"vehicle_count" integer DEFAULT 0,
	"driver_count" integer DEFAULT 0,
	"match_status" "canopy_match_status" DEFAULT 'pending',
	"matched_customer_id" uuid,
	"matched_agencyzoom_id" varchar(50),
	"matched_agencyzoom_type" varchar(20),
	"matched_at" timestamp,
	"matched_by_user_id" uuid,
	"agencyzoom_note_synced" boolean DEFAULT false,
	"agencyzoom_note_id" varchar(50),
	"raw_payload" jsonb,
	"pulled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_phone_assist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"carrier_type" text,
	"primary_phone" text,
	"underwriting_phone" text,
	"claims_phone" text,
	"billing_phone" text,
	"website_url" text,
	"agent_portal_url" text,
	"agency_code" text,
	"phone_tree_maps" jsonb,
	"departments" jsonb,
	"tips_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_intel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"category" "customer_intel_category" NOT NULL,
	"fact" text NOT NULL,
	"keywords" jsonb,
	"confidence" numeric(3, 2) DEFAULT '0.8',
	"source_type" varchar(50) NOT NULL,
	"source_id" varchar(100),
	"source_date" timestamp,
	"is_active" boolean DEFAULT true,
	"last_verified_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_personality" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"dominance" integer,
	"influence" integer,
	"steadiness" integer,
	"conscientiousness" integer,
	"preferred_contact_method" varchar(20),
	"communication_style" varchar(50),
	"best_time_to_call" varchar(50),
	"ai_personality_summary" text,
	"analysis_call_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_personality_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "es_brokers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"website" text,
	"notes" text,
	"portal_url" text,
	"portal_username" text,
	"portal_password" text,
	"is_favorite" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"customer_phone" varchar(20),
	"customer_name" varchar(200),
	"call_date" timestamp NOT NULL,
	"direction" varchar(20),
	"agent_name" varchar(100),
	"duration_seconds" integer,
	"transcript" text NOT NULL,
	"ai_summary" text,
	"ai_topics" jsonb,
	"ai_life_events" jsonb,
	"import_source" varchar(50) DEFAULT 'spreadsheet',
	"external_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lien_holders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"address1" text NOT NULL,
	"address2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" text NOT NULL,
	"phone" text,
	"fax" text,
	"email" text,
	"notes" text,
	"is_favorite" boolean DEFAULT false,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"request_params" jsonb NOT NULL,
	"best_quote" jsonb NOT NULL,
	"all_quotes" jsonb NOT NULL,
	"status" "life_quote_status" DEFAULT 'quoted' NOT NULL,
	"emailed_to_customer" boolean DEFAULT false,
	"application_started" boolean DEFAULT false,
	"selected_quote_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgagee_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lien_holder_id" uuid,
	"display_name" text NOT NULL,
	"clause_text" text NOT NULL,
	"policy_types" jsonb,
	"is_active" boolean DEFAULT true,
	"upload_website" text,
	"phone" text,
	"fax" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgagee_payment_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_type" varchar(20) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"policies_checked" integer DEFAULT 0 NOT NULL,
	"late_payments_found" integer DEFAULT 0 NOT NULL,
	"lapsed_found" integer DEFAULT 0 NOT NULL,
	"errors_encountered" integer DEFAULT 0 NOT NULL,
	"captchas_solved" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgagee_payment_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mortgagee_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"run_id" uuid,
	"check_type" varchar(20) DEFAULT 'scheduled',
	"status" "mortgagee_check_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "mortgagee_payment_status",
	"paid_through_date" date,
	"next_due_date" date,
	"amount_due" numeric(12, 2),
	"premium_amount" numeric(12, 2),
	"mci_policy_number" varchar(100),
	"mci_carrier" varchar(200),
	"mci_effective_date" date,
	"mci_expiration_date" date,
	"mci_cancellation_date" date,
	"mci_reason" text,
	"screenshot_url" text,
	"raw_response" jsonb,
	"error_message" text,
	"error_code" varchar(50),
	"retry_count" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgagee_payment_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"paused_at" timestamp,
	"paused_by_user_id" uuid,
	"pause_reason" text,
	"schedule_start_hour" integer DEFAULT 22 NOT NULL,
	"schedule_end_hour" integer DEFAULT 5 NOT NULL,
	"daily_check_budget" integer DEFAULT 200 NOT NULL,
	"checks_today" integer DEFAULT 0 NOT NULL,
	"last_budget_reset_at" timestamp,
	"recheck_days" integer DEFAULT 7 NOT NULL,
	"delay_between_checks_ms" integer DEFAULT 30000 NOT NULL,
	"microservice_url" text,
	"microservice_api_key" varchar(64),
	"two_captcha_api_key" varchar(64),
	"two_captcha_balance" numeric(10, 4),
	"two_captcha_last_checked_at" timestamp,
	"alert_on_late_payment" boolean DEFAULT true NOT NULL,
	"alert_on_lapsed" boolean DEFAULT true NOT NULL,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"email_recipients" jsonb,
	"last_scheduler_run_at" timestamp,
	"last_scheduler_completed_at" timestamp,
	"last_scheduler_error" text,
	"scheduler_run_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mortgagee_payment_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "mortgagees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"customer_id" uuid,
	"name" text NOT NULL,
	"loan_number" varchar(100),
	"address_line1" text,
	"address_line2" text,
	"city" varchar(100),
	"state" varchar(2),
	"zip_code" varchar(10),
	"type" varchar(50) DEFAULT 'mortgagee',
	"position" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_payment_check_at" timestamp,
	"current_payment_status" "mortgagee_payment_status" DEFAULT 'unknown',
	"mci_last_found" boolean,
	"mci_policy_number" varchar(100),
	"paid_through_date" date,
	"next_due_date" date,
	"amount_due" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_transcript_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"call_id" uuid,
	"caller_number" varchar(20),
	"agent_extension" varchar(10),
	"call_started_at" timestamp NOT NULL,
	"call_ended_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0,
	"next_attempt_at" timestamp DEFAULT now(),
	"last_attempt_at" timestamp,
	"sql_record_id" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"failed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pending_vm_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"threecx_call_id" varchar(100) NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"external_number" varchar(20),
	"direction" varchar(10),
	"extension" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid,
	"policy_number" varchar(50) NOT NULL,
	"customer_id" uuid,
	"change_type" "policy_change_type" NOT NULL,
	"status" "policy_change_status" DEFAULT 'pending' NOT NULL,
	"effective_date" date NOT NULL,
	"form_data" jsonb NOT NULL,
	"notes" text,
	"agent_notes" text,
	"carrier_response" text,
	"submitted_by" uuid,
	"processed_by" uuid,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_notice_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_notice_id" uuid NOT NULL,
	"webhook_url" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending',
	"http_status" integer,
	"response_body" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"adapt_notice_id" varchar(100),
	"notice_type" "policy_notice_type" NOT NULL,
	"urgency" "policy_notice_urgency" DEFAULT 'medium',
	"policy_number" varchar(50),
	"insured_name" text,
	"carrier" varchar(100),
	"line_of_business" varchar(50),
	"customer_id" uuid,
	"policy_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"document_url" text,
	"document_file_name" varchar(255),
	"amount_due" numeric(12, 2),
	"due_date" date,
	"grace_period_end" date,
	"claim_number" varchar(50),
	"claim_date" date,
	"claim_status" varchar(50),
	"review_status" "policy_notice_review_status" DEFAULT 'pending',
	"assigned_to_id" uuid,
	"assigned_at" timestamp,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"action_taken" varchar(100),
	"action_details" text,
	"actioned_at" timestamp,
	"zapier_webhook_sent" boolean DEFAULT false,
	"zapier_webhook_sent_at" timestamp,
	"zapier_webhook_status" varchar(20),
	"raw_payload" jsonb,
	"priority_score" integer DEFAULT 50,
	"donna_context" jsonb,
	"customer_value" numeric(12, 2),
	"match_confidence" varchar(20),
	"notice_date" timestamp,
	"fetched_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_notices_adapt_notice_id_unique" UNIQUE("adapt_notice_id")
);
--> statement-breakpoint
CREATE TABLE "quick_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"category" text,
	"sort_order" integer DEFAULT 0,
	"is_favorite" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reported_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_type" varchar(50) NOT NULL,
	"item_id" varchar(100) NOT NULL,
	"issue_type" varchar(100),
	"description" text,
	"item_snapshot" jsonb,
	"user_corrections" jsonb,
	"error_message" text,
	"error_stack" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"is_resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by_id" uuid,
	"resolution_notes" text,
	"reported_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "same_day_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"policy_number" text NOT NULL,
	"amount" real NOT NULL,
	"payment_type" "payment_advance_type" NOT NULL,
	"payment_info" text NOT NULL,
	"submitted_date" text NOT NULL,
	"status" "same_day_payment_status" DEFAULT 'pending',
	"processed_at" timestamp,
	"notes" text,
	"agencyzoom_id" text,
	"agencyzoom_type" text,
	"submitter_email" text,
	"submitter_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "vm_session_id" varchar(100);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "extension" varchar(10);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "external_number" varchar(20);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "transcription_status" varchar(20);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "transcription_error" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "transcription_segment_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "ai_action_items" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "ai_topics" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "agencyzoom_note_id" varchar(100);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "agencyzoom_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pipeline_id" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pipeline_stage_id" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "stage_entered_at" timestamp;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "quoted_premium" real;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "donna_data" jsonb;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_synced_from_donna" timestamp;--> statement-breakpoint
ALTER TABLE "live_transcript_segments" ADD COLUMN "sentiment" varchar(20);--> statement-breakpoint
ALTER TABLE "live_transcript_segments" ADD COLUMN "entities" jsonb;--> statement-breakpoint
ALTER TABLE "property_lookups" ADD COLUMN "mmi_data" jsonb;--> statement-breakpoint
ALTER TABLE "risk_monitor_policies" ADD COLUMN "customer_since_date" timestamp;--> statement-breakpoint
ALTER TABLE "triage_items" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "feature_permissions" jsonb;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "is_auto_voided" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "auto_void_reason" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "completion_action" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "edited_summary" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "delete_notes" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "deleted_by_id" uuid;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "undo_token" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "undo_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "ticket_type" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "ticket_assigned_to_id" uuid;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "lead_type" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "lead_assigned_to_id" uuid;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "agencyzoom_lead_id" text;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_carriers" ADD CONSTRAINT "agency_carriers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_retry_queue" ADD CONSTRAINT "api_retry_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_retry_queue" ADD CONSTRAINT "api_retry_queue_wrapup_draft_id_wrapup_drafts_id_fk" FOREIGN KEY ("wrapup_draft_id") REFERENCES "public"."wrapup_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_retry_queue" ADD CONSTRAINT "api_retry_queue_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canopy_connect_pulls" ADD CONSTRAINT "canopy_connect_pulls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canopy_connect_pulls" ADD CONSTRAINT "canopy_connect_pulls_matched_customer_id_customers_id_fk" FOREIGN KEY ("matched_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canopy_connect_pulls" ADD CONSTRAINT "canopy_connect_pulls_matched_by_user_id_users_id_fk" FOREIGN KEY ("matched_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_phone_assist" ADD CONSTRAINT "carrier_phone_assist_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_intel" ADD CONSTRAINT "customer_intel_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_intel" ADD CONSTRAINT "customer_intel_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_personality" ADD CONSTRAINT "customer_personality_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_personality" ADD CONSTRAINT "customer_personality_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "es_brokers" ADD CONSTRAINT "es_brokers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_transcripts" ADD CONSTRAINT "historical_transcripts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_transcripts" ADD CONSTRAINT "historical_transcripts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lien_holders" ADD CONSTRAINT "lien_holders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_quotes" ADD CONSTRAINT "life_quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_quotes" ADD CONSTRAINT "life_quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_quotes" ADD CONSTRAINT "life_quotes_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_clauses" ADD CONSTRAINT "mortgagee_clauses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_clauses" ADD CONSTRAINT "mortgagee_clauses_lien_holder_id_lien_holders_id_fk" FOREIGN KEY ("lien_holder_id") REFERENCES "public"."lien_holders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_payment_activity_log" ADD CONSTRAINT "mortgagee_payment_activity_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_payment_checks" ADD CONSTRAINT "mortgagee_payment_checks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_payment_checks" ADD CONSTRAINT "mortgagee_payment_checks_mortgagee_id_mortgagees_id_fk" FOREIGN KEY ("mortgagee_id") REFERENCES "public"."mortgagees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_payment_checks" ADD CONSTRAINT "mortgagee_payment_checks_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_payment_settings" ADD CONSTRAINT "mortgagee_payment_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagee_payment_settings" ADD CONSTRAINT "mortgagee_payment_settings_paused_by_user_id_users_id_fk" FOREIGN KEY ("paused_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagees" ADD CONSTRAINT "mortgagees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagees" ADD CONSTRAINT "mortgagees_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgagees" ADD CONSTRAINT "mortgagees_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_transcript_jobs" ADD CONSTRAINT "pending_transcript_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_transcript_jobs" ADD CONSTRAINT "pending_transcript_jobs_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_requests" ADD CONSTRAINT "policy_change_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_requests" ADD CONSTRAINT "policy_change_requests_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_requests" ADD CONSTRAINT "policy_change_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_requests" ADD CONSTRAINT "policy_change_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_change_requests" ADD CONSTRAINT "policy_change_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notice_webhook_deliveries" ADD CONSTRAINT "policy_notice_webhook_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notice_webhook_deliveries" ADD CONSTRAINT "policy_notice_webhook_deliveries_policy_notice_id_policy_notices_id_fk" FOREIGN KEY ("policy_notice_id") REFERENCES "public"."policy_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notices" ADD CONSTRAINT "policy_notices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notices" ADD CONSTRAINT "policy_notices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notices" ADD CONSTRAINT "policy_notices_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notices" ADD CONSTRAINT "policy_notices_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_notices" ADD CONSTRAINT "policy_notices_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_links" ADD CONSTRAINT "quick_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_issues" ADD CONSTRAINT "reported_issues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_issues" ADD CONSTRAINT "reported_issues_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_issues" ADD CONSTRAINT "reported_issues_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "same_day_payments" ADD CONSTRAINT "same_day_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "same_day_payments" ADD CONSTRAINT "same_day_payments_submitter_user_id_users_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_carriers_tenant_idx" ON "agency_carriers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agency_carriers_favorite_idx" ON "agency_carriers" USING btree ("tenant_id","is_favorite");--> statement-breakpoint
CREATE INDEX "agency_carriers_name_idx" ON "agency_carriers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "api_retry_queue_status_idx" ON "api_retry_queue" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "api_retry_queue_next_attempt_idx" ON "api_retry_queue" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "api_retry_queue_service_idx" ON "api_retry_queue" USING btree ("tenant_id","target_service");--> statement-breakpoint
CREATE INDEX "api_retry_queue_wrapup_idx" ON "api_retry_queue" USING btree ("wrapup_draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "canopy_pull_id_idx" ON "canopy_connect_pulls" USING btree ("pull_id");--> statement-breakpoint
CREATE INDEX "canopy_phone_idx" ON "canopy_connect_pulls" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "canopy_match_status_idx" ON "canopy_connect_pulls" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "canopy_tenant_idx" ON "canopy_connect_pulls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "carrier_phone_assist_tenant_idx" ON "carrier_phone_assist" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "carrier_phone_assist_name_idx" ON "carrier_phone_assist" USING btree ("name");--> statement-breakpoint
CREATE INDEX "carrier_phone_assist_type_idx" ON "carrier_phone_assist" USING btree ("carrier_type");--> statement-breakpoint
CREATE INDEX "customer_intel_customer_idx" ON "customer_intel" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_intel_category_idx" ON "customer_intel" USING btree ("customer_id","category");--> statement-breakpoint
CREATE INDEX "customer_personality_customer_idx" ON "customer_personality" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "es_brokers_tenant_idx" ON "es_brokers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "es_brokers_favorite_idx" ON "es_brokers" USING btree ("tenant_id","is_favorite");--> statement-breakpoint
CREATE INDEX "es_brokers_name_idx" ON "es_brokers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "historical_transcripts_customer_idx" ON "historical_transcripts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "historical_transcripts_phone_idx" ON "historical_transcripts" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "historical_transcripts_date_idx" ON "historical_transcripts" USING btree ("call_date");--> statement-breakpoint
CREATE INDEX "lien_holders_tenant_idx" ON "lien_holders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lien_holders_type_idx" ON "lien_holders" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "lien_holders_favorite_idx" ON "lien_holders" USING btree ("tenant_id","is_favorite");--> statement-breakpoint
CREATE INDEX "lien_holders_name_idx" ON "lien_holders" USING btree ("name");--> statement-breakpoint
CREATE INDEX "life_quotes_customer_idx" ON "life_quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "life_quotes_agent_idx" ON "life_quotes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "life_quotes_status_idx" ON "life_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "life_quotes_created_at_idx" ON "life_quotes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "life_quotes_tenant_idx" ON "life_quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mortgagee_clauses_tenant_idx" ON "mortgagee_clauses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mortgagee_clauses_lien_holder_idx" ON "mortgagee_clauses" USING btree ("lien_holder_id");--> statement-breakpoint
CREATE INDEX "mortgagee_clauses_active_idx" ON "mortgagee_clauses" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "mpact_tenant_idx" ON "mortgagee_payment_activity_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mpact_run_id_idx" ON "mortgagee_payment_activity_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "mpact_started_at_idx" ON "mortgagee_payment_activity_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "mpc_tenant_idx" ON "mortgagee_payment_checks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mpc_mortgagee_idx" ON "mortgagee_payment_checks" USING btree ("mortgagee_id");--> statement-breakpoint
CREATE INDEX "mpc_policy_idx" ON "mortgagee_payment_checks" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "mpc_run_idx" ON "mortgagee_payment_checks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "mpc_status_idx" ON "mortgagee_payment_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mpc_created_at_idx" ON "mortgagee_payment_checks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mpc_payment_status_idx" ON "mortgagee_payment_checks" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "mortgagees_tenant_idx" ON "mortgagees" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mortgagees_policy_idx" ON "mortgagees" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "mortgagees_customer_idx" ON "mortgagees" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "mortgagees_status_idx" ON "mortgagees" USING btree ("current_payment_status");--> statement-breakpoint
CREATE INDEX "mortgagees_active_idx" ON "mortgagees" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "pending_transcript_jobs_status_idx" ON "pending_transcript_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "pending_vm_events_threecx_idx" ON "pending_vm_events" USING btree ("threecx_call_id");--> statement-breakpoint
CREATE INDEX "policy_change_requests_tenant_idx" ON "policy_change_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "policy_change_requests_policy_id_idx" ON "policy_change_requests" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "policy_change_requests_customer_id_idx" ON "policy_change_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "policy_change_requests_status_idx" ON "policy_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "policy_change_requests_change_type_idx" ON "policy_change_requests" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "policy_change_requests_created_at_idx" ON "policy_change_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pnwd_tenant_idx" ON "policy_notice_webhook_deliveries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pnwd_notice_idx" ON "policy_notice_webhook_deliveries" USING btree ("policy_notice_id");--> statement-breakpoint
CREATE INDEX "pnwd_status_idx" ON "policy_notice_webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pnwd_retry_idx" ON "policy_notice_webhook_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "policy_notices_tenant_idx" ON "policy_notices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "policy_notices_adapt_id_idx" ON "policy_notices" USING btree ("adapt_notice_id");--> statement-breakpoint
CREATE INDEX "policy_notices_status_idx" ON "policy_notices" USING btree ("tenant_id","review_status");--> statement-breakpoint
CREATE INDEX "policy_notices_type_idx" ON "policy_notices" USING btree ("tenant_id","notice_type");--> statement-breakpoint
CREATE INDEX "policy_notices_urgency_idx" ON "policy_notices" USING btree ("tenant_id","urgency","review_status");--> statement-breakpoint
CREATE INDEX "policy_notices_assigned_idx" ON "policy_notices" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "policy_notices_customer_idx" ON "policy_notices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "policy_notices_policy_idx" ON "policy_notices" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "policy_notices_due_date_idx" ON "policy_notices" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE INDEX "policy_notices_priority_idx" ON "policy_notices" USING btree ("tenant_id","priority_score","review_status");--> statement-breakpoint
CREATE INDEX "quick_links_tenant_idx" ON "quick_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quick_links_category_idx" ON "quick_links" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "quick_links_favorite_idx" ON "quick_links" USING btree ("tenant_id","is_favorite");--> statement-breakpoint
CREATE INDEX "reported_issues_tenant_idx" ON "reported_issues" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "reported_issues_item_idx" ON "reported_issues" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "reported_issues_resolved_idx" ON "reported_issues" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "same_day_payments_tenant_idx" ON "same_day_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "same_day_payments_policy_idx" ON "same_day_payments" USING btree ("policy_number");--> statement-breakpoint
CREATE INDEX "same_day_payments_status_idx" ON "same_day_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "same_day_payments_created_at_idx" ON "same_day_payments" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "triage_items" ADD CONSTRAINT "triage_items_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_ticket_assigned_to_id_users_id_fk" FOREIGN KEY ("ticket_assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_lead_assigned_to_id_users_id_fk" FOREIGN KEY ("lead_assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_extension_idx" ON "calls" USING btree ("tenant_id","extension");--> statement-breakpoint
CREATE INDEX "customers_pipeline_idx" ON "customers" USING btree ("tenant_id","pipeline_id","pipeline_stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_az_unique" ON "customers" USING btree ("tenant_id","agencyzoom_id");