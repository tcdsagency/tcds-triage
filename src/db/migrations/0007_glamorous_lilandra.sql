CREATE TYPE "public"."commission_agent_role" AS ENUM('owner', 'producer', 'csr', 'house');--> statement-breakpoint
CREATE TYPE "public"."commission_anomaly_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."commission_anomaly_type" AS ENUM('missing_policy', 'duplicate_transaction', 'rate_deviation', 'negative_commission', 'missing_agent', 'unresolved_carrier', 'split_mismatch', 'other');--> statement-breakpoint
CREATE TYPE "public"."commission_audit_action" AS ENUM('create', 'update', 'delete', 'import', 'reconcile', 'allocate', 'month_close', 'month_reopen', 'draw_payment');--> statement-breakpoint
CREATE TYPE "public"."commission_import_status" AS ENUM('pending', 'parsing', 'mapping', 'previewing', 'importing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."commission_month_close_status_type" AS ENUM('open', 'in_review', 'locked');--> statement-breakpoint
CREATE TYPE "public"."commission_reconciliation_status" AS ENUM('unmatched', 'partial_match', 'matched', 'discrepancy', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."commission_transaction_type" AS ENUM('new_business', 'renewal', 'cancellation', 'endorsement', 'return_premium', 'bonus', 'override', 'contingency', 'other');--> statement-breakpoint
CREATE TYPE "public"."policy_creator_lob" AS ENUM('Personal Auto', 'Homeowners', 'Dwelling Fire', 'Renters', 'Umbrella', 'Flood', 'Motorcycle', 'Recreational Vehicle', 'Mobile Home', 'Commercial Auto', 'General Liability', 'BOP', 'Commercial Property', 'Workers Comp', 'Professional Liability', 'Inland Marine');--> statement-breakpoint
CREATE TYPE "public"."policy_creator_status" AS ENUM('uploaded', 'extracting', 'extracted', 'reviewed', 'generated', 'error');--> statement-breakpoint
CREATE TYPE "public"."weather_alert_severity" AS ENUM('Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown');--> statement-breakpoint
CREATE TABLE "commission_agent_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"carrier_id" uuid,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"role" "commission_agent_role" DEFAULT 'producer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" uuid,
	"has_draw_account" boolean DEFAULT false NOT NULL,
	"monthly_draw_amount" numeric(10, 2),
	"default_split_percent" numeric(5, 2) DEFAULT '100',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"split_percent" numeric(5, 2) NOT NULL,
	"split_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "commission_anomaly_type" NOT NULL,
	"severity" "commission_anomaly_severity" DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"transaction_id" uuid,
	"import_batch_id" uuid,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_by_user_id" uuid,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" "commission_audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"user_id" uuid,
	"details" jsonb,
	"previous_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_bank_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deposit_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"carrier_id" uuid,
	"carrier_name" text,
	"reference_number" text,
	"reporting_month" varchar(7),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_carrier_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_carrier_reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"carrier_id" uuid NOT NULL,
	"reporting_month" varchar(7) NOT NULL,
	"carrier_statement_total" numeric(12, 2),
	"bank_deposit_total" numeric(12, 2),
	"system_transaction_total" numeric(12, 2),
	"statement_vs_deposit" numeric(12, 2),
	"statement_vs_system" numeric(12, 2),
	"deposit_vs_system" numeric(12, 2),
	"status" "commission_reconciliation_status" DEFAULT 'unmatched' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"carrier_code" varchar(20),
	"default_new_business_rate" numeric(5, 2),
	"default_renewal_rate" numeric(5, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_draw_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"reporting_month" varchar(7) NOT NULL,
	"balance_forward" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_commissions_earned" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_draw_payments" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ending_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_draw_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reporting_month" varchar(7) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_field_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"carrier_id" uuid,
	"mapping" jsonb NOT NULL,
	"csv_headers" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_help_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" varchar(50),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"status" "commission_import_status" DEFAULT 'pending' NOT NULL,
	"carrier_id" uuid,
	"field_mapping_id" uuid,
	"total_rows" integer DEFAULT 0,
	"imported_rows" integer DEFAULT 0,
	"skipped_rows" integer DEFAULT 0,
	"error_rows" integer DEFAULT 0,
	"duplicate_rows" integer DEFAULT 0,
	"raw_data" jsonb,
	"parsed_headers" jsonb,
	"imported_by_user_id" uuid,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"field" text,
	"value" text,
	"error_message" text NOT NULL,
	"raw_row" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_month_close_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reporting_month" varchar(7) NOT NULL,
	"status" "commission_month_close_status_type" DEFAULT 'open' NOT NULL,
	"locked_by_user_id" uuid,
	"locked_at" timestamp,
	"unlocked_by_user_id" uuid,
	"unlocked_at" timestamp,
	"validation_results" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_number" text NOT NULL,
	"carrier_id" uuid,
	"carrier_name" text,
	"insured_name" text,
	"line_of_business" text,
	"effective_date" date,
	"expiration_date" date,
	"premium" numeric(12, 2),
	"primary_agent_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid,
	"carrier_id" uuid,
	"import_batch_id" uuid,
	"policy_number" text NOT NULL,
	"carrier_name" text,
	"insured_name" text,
	"transaction_type" "commission_transaction_type" DEFAULT 'other',
	"line_of_business" text,
	"effective_date" date,
	"statement_date" date,
	"agent_paid_date" date,
	"gross_premium" numeric(12, 2),
	"commission_rate" numeric(5, 4),
	"commission_amount" numeric(12, 2) NOT NULL,
	"reporting_month" varchar(7),
	"dedupe_hash" varchar(64),
	"notes" text,
	"is_manual_entry" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_creator_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uploaded_by_id" uuid,
	"original_file_name" text NOT NULL,
	"file_size" integer,
	"policy_number" text,
	"carrier" text,
	"carrier_naic" text,
	"line_of_business" "policy_creator_lob",
	"effective_date" date,
	"expiration_date" date,
	"total_premium" real,
	"transaction_type" text,
	"insured_first_name" text,
	"insured_last_name" text,
	"insured_name" text,
	"insured_entity_type" text,
	"insured_address" text,
	"insured_city" text,
	"insured_state" text,
	"insured_zip" text,
	"insured_phone" text,
	"insured_email" text,
	"insured_dob" date,
	"coverages" jsonb,
	"vehicles" jsonb,
	"drivers" jsonb,
	"properties" jsonb,
	"mortgagees" jsonb,
	"discounts" jsonb,
	"status" "policy_creator_status" DEFAULT 'uploaded',
	"confidence_scores" jsonb,
	"extraction_error" text,
	"raw_extraction" jsonb,
	"generated_al3_raw" text,
	"generated_al3_xml" text,
	"validation_errors" jsonb,
	"validation_warnings" jsonb,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_name" varchar(200),
	"email" varchar(200),
	"phone" varchar(20),
	"company" varchar(200),
	"type" varchar(50) DEFAULT 'other' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
DROP INDEX "renewal_comparisons_policy_date_unique";--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "prior_term_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "agent1" varchar(50);--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "agent2" varchar(50);--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "agent3" varchar(50);--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "producer_id" uuid;--> statement-breakpoint
ALTER TABLE "property_lookups" ADD COLUMN "property_api_data" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "call_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "az_ticket_note_posted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "az_ticket_note_error" text;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD COLUMN "baseline_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "renewal_candidates" ADD COLUMN "baseline_captured_at" timestamp;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD COLUMN "check_results" jsonb;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD COLUMN "check_summary" jsonb;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD COLUMN "assigned_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "cost_new" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "estimated_value" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "primary_driver" varchar(100);--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "lienholder" varchar(200);--> statement-breakpoint
ALTER TABLE "commission_agent_codes" ADD CONSTRAINT "commission_agent_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_agent_codes" ADD CONSTRAINT "commission_agent_codes_agent_id_commission_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."commission_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_agent_codes" ADD CONSTRAINT "commission_agent_codes_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_agents" ADD CONSTRAINT "commission_agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_agents" ADD CONSTRAINT "commission_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_allocations" ADD CONSTRAINT "commission_allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_allocations" ADD CONSTRAINT "commission_allocations_transaction_id_commission_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."commission_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_allocations" ADD CONSTRAINT "commission_allocations_agent_id_commission_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."commission_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_anomalies" ADD CONSTRAINT "commission_anomalies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_anomalies" ADD CONSTRAINT "commission_anomalies_transaction_id_commission_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."commission_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_anomalies" ADD CONSTRAINT "commission_anomalies_import_batch_id_commission_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."commission_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_anomalies" ADD CONSTRAINT "commission_anomalies_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_audit_log" ADD CONSTRAINT "commission_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_audit_log" ADD CONSTRAINT "commission_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_bank_deposits" ADD CONSTRAINT "commission_bank_deposits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_bank_deposits" ADD CONSTRAINT "commission_bank_deposits_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_carrier_aliases" ADD CONSTRAINT "commission_carrier_aliases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_carrier_aliases" ADD CONSTRAINT "commission_carrier_aliases_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_carrier_reconciliation" ADD CONSTRAINT "commission_carrier_reconciliation_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_carrier_reconciliation" ADD CONSTRAINT "commission_carrier_reconciliation_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_carrier_reconciliation" ADD CONSTRAINT "commission_carrier_reconciliation_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_carriers" ADD CONSTRAINT "commission_carriers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_draw_balances" ADD CONSTRAINT "commission_draw_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_draw_balances" ADD CONSTRAINT "commission_draw_balances_agent_id_commission_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."commission_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_draw_payments" ADD CONSTRAINT "commission_draw_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_draw_payments" ADD CONSTRAINT "commission_draw_payments_agent_id_commission_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."commission_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_field_mappings" ADD CONSTRAINT "commission_field_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_field_mappings" ADD CONSTRAINT "commission_field_mappings_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_help_content" ADD CONSTRAINT "commission_help_content_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_import_batches" ADD CONSTRAINT "commission_import_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_import_batches" ADD CONSTRAINT "commission_import_batches_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_import_batches" ADD CONSTRAINT "commission_import_batches_field_mapping_id_commission_field_mappings_id_fk" FOREIGN KEY ("field_mapping_id") REFERENCES "public"."commission_field_mappings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_import_batches" ADD CONSTRAINT "commission_import_batches_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_import_errors" ADD CONSTRAINT "commission_import_errors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_import_errors" ADD CONSTRAINT "commission_import_errors_batch_id_commission_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."commission_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_month_close_status" ADD CONSTRAINT "commission_month_close_status_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_month_close_status" ADD CONSTRAINT "commission_month_close_status_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_month_close_status" ADD CONSTRAINT "commission_month_close_status_unlocked_by_user_id_users_id_fk" FOREIGN KEY ("unlocked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_policies" ADD CONSTRAINT "commission_policies_primary_agent_id_commission_agents_id_fk" FOREIGN KEY ("primary_agent_id") REFERENCES "public"."commission_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_policy_id_commission_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."commission_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_carrier_id_commission_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."commission_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_import_batch_id_commission_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."commission_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_creator_documents" ADD CONSTRAINT "policy_creator_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_creator_documents" ADD CONSTRAINT "policy_creator_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_sources" ADD CONSTRAINT "referral_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_weather_alerts" ADD CONSTRAINT "sent_weather_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_weather_alerts" ADD CONSTRAINT "sent_weather_alerts_subscription_id_weather_alert_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."weather_alert_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_alert_log" ADD CONSTRAINT "weather_alert_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_alert_settings" ADD CONSTRAINT "weather_alert_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_alert_subscriptions" ADD CONSTRAINT "weather_alert_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_alert_subscriptions" ADD CONSTRAINT "weather_alert_subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_agent_codes_tenant_idx" ON "commission_agent_codes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_agent_codes_agent_idx" ON "commission_agent_codes" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agent_codes_unique" ON "commission_agent_codes" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "commission_agents_tenant_idx" ON "commission_agents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_agents_active_idx" ON "commission_agents" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "commission_agents_user_idx" ON "commission_agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "commission_allocations_tenant_idx" ON "commission_allocations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_allocations_transaction_idx" ON "commission_allocations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "commission_allocations_agent_idx" ON "commission_allocations" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "commission_anomalies_tenant_idx" ON "commission_anomalies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_anomalies_type_idx" ON "commission_anomalies" USING btree ("type","is_resolved");--> statement-breakpoint
CREATE INDEX "commission_anomalies_transaction_idx" ON "commission_anomalies" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "commission_audit_log_tenant_idx" ON "commission_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_audit_log_entity_idx" ON "commission_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "commission_audit_log_action_idx" ON "commission_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "commission_bank_deposits_tenant_idx" ON "commission_bank_deposits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_bank_deposits_month_idx" ON "commission_bank_deposits" USING btree ("tenant_id","reporting_month");--> statement-breakpoint
CREATE INDEX "commission_bank_deposits_carrier_idx" ON "commission_bank_deposits" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "commission_carrier_aliases_tenant_idx" ON "commission_carrier_aliases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_carrier_aliases_carrier_idx" ON "commission_carrier_aliases" USING btree ("carrier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_carrier_aliases_unique" ON "commission_carrier_aliases" USING btree ("tenant_id","alias");--> statement-breakpoint
CREATE INDEX "commission_recon_tenant_idx" ON "commission_carrier_reconciliation" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_recon_unique" ON "commission_carrier_reconciliation" USING btree ("tenant_id","carrier_id","reporting_month");--> statement-breakpoint
CREATE INDEX "commission_carriers_tenant_idx" ON "commission_carriers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_carriers_name_unique" ON "commission_carriers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "commission_draw_balances_tenant_idx" ON "commission_draw_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_draw_balances_unique" ON "commission_draw_balances" USING btree ("tenant_id","agent_id","reporting_month");--> statement-breakpoint
CREATE INDEX "commission_draw_payments_tenant_idx" ON "commission_draw_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_draw_payments_agent_idx" ON "commission_draw_payments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "commission_draw_payments_month_idx" ON "commission_draw_payments" USING btree ("tenant_id","reporting_month");--> statement-breakpoint
CREATE INDEX "commission_field_mappings_tenant_idx" ON "commission_field_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_help_content_tenant_idx" ON "commission_help_content" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_import_batches_tenant_idx" ON "commission_import_batches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_import_batches_status_idx" ON "commission_import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_import_errors_batch_idx" ON "commission_import_errors" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "commission_month_close_tenant_idx" ON "commission_month_close_status" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_month_close_unique" ON "commission_month_close_status" USING btree ("tenant_id","reporting_month");--> statement-breakpoint
CREATE INDEX "commission_policies_tenant_idx" ON "commission_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_policies_unique" ON "commission_policies" USING btree ("tenant_id","policy_number","carrier_id");--> statement-breakpoint
CREATE INDEX "commission_policies_carrier_idx" ON "commission_policies" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "commission_policies_agent_idx" ON "commission_policies" USING btree ("primary_agent_id");--> statement-breakpoint
CREATE INDEX "commission_transactions_tenant_idx" ON "commission_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_transactions_policy_idx" ON "commission_transactions" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "commission_transactions_carrier_idx" ON "commission_transactions" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "commission_transactions_month_idx" ON "commission_transactions" USING btree ("tenant_id","reporting_month");--> statement-breakpoint
CREATE INDEX "commission_transactions_batch_idx" ON "commission_transactions" USING btree ("import_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_transactions_dedupe_idx" ON "commission_transactions" USING btree ("tenant_id","dedupe_hash");--> statement-breakpoint
CREATE INDEX "policy_creator_docs_tenant_idx" ON "policy_creator_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "policy_creator_docs_status_idx" ON "policy_creator_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "policy_creator_docs_carrier_idx" ON "policy_creator_documents" USING btree ("carrier");--> statement-breakpoint
CREATE INDEX "policy_creator_docs_lob_idx" ON "policy_creator_documents" USING btree ("line_of_business");--> statement-breakpoint
CREATE INDEX "policy_creator_docs_insured_name_idx" ON "policy_creator_documents" USING btree ("insured_name");--> statement-breakpoint
CREATE INDEX "policy_creator_docs_created_at_idx" ON "policy_creator_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "referral_sources_tenant_idx" ON "referral_sources" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "referral_sources_name_idx" ON "referral_sources" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "sent_weather_tenant_idx" ON "sent_weather_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sent_weather_dedup_idx" ON "sent_weather_alerts" USING btree ("nws_alert_id","subscription_id");--> statement-breakpoint
CREATE INDEX "weather_log_tenant_idx" ON "weather_alert_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "weather_log_run_idx" ON "weather_alert_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "weather_sub_tenant_idx" ON "weather_alert_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "weather_sub_zip_idx" ON "weather_alert_subscriptions" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "weather_sub_zone_idx" ON "weather_alert_subscriptions" USING btree ("nws_zone");--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_producer_id_users_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD CONSTRAINT "renewal_comparisons_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "policies_producer_idx" ON "policies" USING btree ("tenant_id","producer_id");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_assigned_agent_idx" ON "renewal_comparisons" USING btree ("tenant_id","assigned_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "renewal_comparisons_dedup_unique" ON "renewal_comparisons" USING btree ("tenant_id","policy_number","carrier_name","renewal_effective_date");