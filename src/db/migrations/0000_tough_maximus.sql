CREATE TYPE "public"."agent_assist_action" AS ENUM('shown', 'used', 'dismissed', 'expanded', 'collapsed');--> statement-breakpoint
CREATE TYPE "public"."agent_assist_feedback" AS ENUM('helpful', 'not_helpful', 'too_basic', 'incorrect');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic', 'google');--> statement-breakpoint
CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('ringing', 'in_progress', 'completed', 'missed', 'voicemail', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."embedding_type" AS ENUM('customer', 'policy', 'call', 'document', 'note', 'knowledge');--> statement-breakpoint
CREATE TYPE "public"."match_confidence" AS ENUM('exact', 'high', 'medium', 'low', 'manual');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('sms', 'mms', 'email');--> statement-breakpoint
CREATE TYPE "public"."payment_advance_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_advance_type" AS ENUM('card', 'checking');--> statement-breakpoint
CREATE TYPE "public"."policy_status" AS ENUM('active', 'pending', 'cancelled', 'expired', 'non_renewed');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('off_market', 'active', 'pending', 'sold', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."quote_document_status" AS ENUM('uploaded', 'extracting', 'extracted', 'posted', 'error');--> statement-breakpoint
CREATE TYPE "public"."quote_document_type" AS ENUM('auto', 'home', 'renters', 'umbrella', 'recreational', 'commercial_auto', 'general_liability', 'bop', 'workers_comp', 'other');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'submitted', 'quoted', 'presented', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."quote_type" AS ENUM('personal_auto', 'homeowners', 'renters', 'umbrella', 'mobile_home', 'recreational_vehicle', 'motorcycle', 'commercial_auto', 'general_liability', 'bop', 'workers_comp', 'professional_liability', 'flood');--> statement-breakpoint
CREATE TYPE "public"."review_request_status" AS ENUM('pending_approval', 'pending', 'sent', 'failed', 'cancelled', 'opted_out', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."risk_alert_priority" AS ENUM('1', '2', '3', '4', '5');--> statement-breakpoint
CREATE TYPE "public"."risk_alert_status" AS ENUM('new', 'acknowledged', 'in_progress', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."risk_alert_type" AS ENUM('listing_detected', 'pending_sale', 'sold', 'price_change', 'status_change');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."triage_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."triage_status" AS ENUM('pending', 'in_progress', 'completed', 'escalated', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."triage_type" AS ENUM('call', 'quote', 'claim', 'service', 'lead', 'after_hours');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'supervisor', 'agent', 'trainee');--> statement-breakpoint
CREATE TYPE "public"."webhook_event" AS ENUM('call.started', 'call.ended', 'call.missed', 'message.received', 'message.sent', 'lead.created', 'lead.updated', 'quote.created', 'quote.updated', 'customer.created', 'customer.updated');--> statement-breakpoint
CREATE TYPE "public"."wrapup_status" AS ENUM('pending_ai_processing', 'pending_review', 'completed', 'posted');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"call_id" uuid,
	"quote_id" uuid,
	"policy_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"created_by_id" uuid,
	"ai_generated" boolean DEFAULT false,
	"synced_to_az" boolean DEFAULT false,
	"az_activity_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_assist_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"call_id" uuid,
	"suggestion_type" varchar(50) NOT NULL,
	"suggestion_id" varchar(100),
	"playbook_id" varchar(100),
	"content" text,
	"action" "agent_assist_action" NOT NULL,
	"feedback" "agent_assist_feedback",
	"feedback_note" text,
	"call_transcript_snippet" text,
	"form_section" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"prediction" jsonb NOT NULL,
	"confidence" real,
	"actual_outcome" jsonb,
	"was_accurate" boolean,
	"context" jsonb,
	"model" text,
	"tokens_used" integer,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_token_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0,
	"endpoint" varchar(200),
	"user_id" uuid,
	"request_duration_ms" integer,
	"success" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_token_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" date NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" varchar(100) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_cents" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"avg_duration_ms" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_prefix" varchar(8) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"permissions" jsonb,
	"allowed_ips" jsonb,
	"rate_limit" integer DEFAULT 1000,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "call_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"call_id" uuid,
	"external_call_id" text,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_notes_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"call_id" uuid,
	"external_call_id" text,
	"history_id" text,
	"caller_phone" text NOT NULL,
	"caller_name" text,
	"called_phone" text,
	"agent_extension" text,
	"agent_name" text,
	"direction" text NOT NULL,
	"call_start_time" timestamp,
	"call_end_time" timestamp,
	"duration" integer,
	"match_status" text DEFAULT 'pending' NOT NULL,
	"match_confidence" numeric(3, 2),
	"match_method" text,
	"suggested_matches" jsonb,
	"customer_id" text,
	"customer_type" text,
	"customer_name" text,
	"customer_email" text,
	"transcript_url" text,
	"recording_url" text,
	"transcript" text,
	"ai_summary" text,
	"ai_call_type" text,
	"az_note_status" text DEFAULT 'pending' NOT NULL,
	"az_note_id" text,
	"az_note_error" text,
	"az_note_posted_at" timestamp,
	"az_ticket_id" text,
	"az_ticket_status" text,
	"az_ticket_stage_name" text,
	"az_ticket_status_updated_at" timestamp,
	"az_ticket_url" text,
	"is_hangup" boolean DEFAULT false NOT NULL,
	"hangup_category" text,
	"needs_customer_match" boolean DEFAULT false NOT NULL,
	"needs_contact_update" boolean DEFAULT false NOT NULL,
	"extracted_contact_info" jsonb,
	"source" text DEFAULT 'zapier' NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"agent_id" uuid,
	"direction_live" "call_direction",
	"direction" "call_direction" NOT NULL,
	"direction_final" "call_direction",
	"status" "call_status" DEFAULT 'ringing',
	"from_number" varchar(20) NOT NULL,
	"to_number" varchar(20) NOT NULL,
	"external_call_id" varchar(100),
	"started_at" timestamp DEFAULT now(),
	"answered_at" timestamp,
	"ended_at" timestamp,
	"duration_seconds" integer,
	"recording_url" text,
	"recording_duration_seconds" integer,
	"transcription" text,
	"transcription_segments" jsonb,
	"ai_summary" text,
	"ai_sentiment" jsonb,
	"predicted_reason" varchar(100),
	"detected_entities" jsonb,
	"quality_score" numeric(3, 2),
	"notes" text,
	"disposition" varchar(50),
	"follow_up_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agencyzoom_id" varchar(100),
	"hawksoft_client_code" varchar(50),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" varchar(20),
	"phone_alt" varchar(20),
	"address" jsonb,
	"date_of_birth" timestamp,
	"ssn_last4" varchar(4),
	"producer_id" uuid,
	"csr_id" uuid,
	"pipeline_stage" varchar(50),
	"lead_source" varchar(100),
	"is_lead" boolean DEFAULT false,
	"lead_status" varchar(50),
	"converted_to_customer_at" timestamp,
	"ai_summary" text,
	"ai_memories" jsonb DEFAULT '[]'::jsonb,
	"churn_risk_score" numeric(3, 2),
	"health_score" numeric(3, 2),
	"cross_sell_opportunities" jsonb DEFAULT '[]'::jsonb,
	"last_synced_from_az" timestamp,
	"last_synced_from_hs" timestamp,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" timestamp,
	"license_number" varchar(50),
	"license_state" varchar(2),
	"relationship" varchar(50),
	"is_excluded" boolean DEFAULT false,
	"violations" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "embedding_type" NOT NULL,
	"source_id" text NOT NULL,
	"source_table" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"metadata" jsonb,
	"embedding_json" jsonb,
	"model" text DEFAULT 'text-embedding-3-small',
	"dimensions" integer DEFAULT 1536,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_id_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" text NOT NULL,
	"contact_type" text NOT NULL,
	"contact_name" text NOT NULL,
	"hawksoft_client_number" text,
	"policy_number" text NOT NULL,
	"carrier" text NOT NULL,
	"carrier_naic" text,
	"effective_date" text NOT NULL,
	"expiration_date" text NOT NULL,
	"vehicle_count" integer DEFAULT 1 NOT NULL,
	"vehicles" jsonb,
	"pdf_base64" text,
	"delivery_method" text,
	"delivered_to" text,
	"delivered_at" timestamp,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"google_review_id" text,
	"reviewer_name" text NOT NULL,
	"reviewer_name_normalized" text,
	"reviewer_profile_url" text,
	"rating" integer NOT NULL,
	"comment" text,
	"review_timestamp" timestamp,
	"matched_customer_id" text,
	"matched_customer_name" text,
	"matched_customer_phone" text,
	"match_confidence" "match_confidence",
	"matched_at" timestamp,
	"matched_by" uuid,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"import_source" varchar(20),
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_reviews_google_review_id_unique" UNIQUE("google_review_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" text NOT NULL,
	"slug" varchar(200) NOT NULL,
	"category" varchar(50) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"content" text NOT NULL,
	"search_vector" text,
	"is_published" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_claim_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_queue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_reference" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"contact_address" text,
	"insurance_type" text,
	"lead_notes" text,
	"raw_payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_user_id" uuid,
	"notified_at" timestamp,
	"expires_at" timestamp,
	"escalated_at" timestamp,
	"claimed_by" uuid,
	"claimed_at" timestamp,
	"agencyzoom_lead_id" text,
	"agencyzoom_sync_status" text,
	"agencyzoom_sync_error" text,
	"agencyzoom_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_round_robin_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"team_id" text DEFAULT 'default',
	"last_user_id" uuid,
	"handoff_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_transcript_segments" (
	"id" varchar(12) PRIMARY KEY NOT NULL,
	"call_id" uuid NOT NULL,
	"speaker" varchar(20) NOT NULL,
	"text" text NOT NULL,
	"confidence" real DEFAULT 0.9,
	"sequence_number" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_final" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wrapup_draft_id" uuid NOT NULL,
	"source" text NOT NULL,
	"contact_type" text NOT NULL,
	"contact_id" text,
	"contact_name" text,
	"contact_phone" text,
	"contact_email" text,
	"confidence" numeric(3, 2),
	"match_reason" text,
	"recommended_action" text,
	"is_selected" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"type" "message_type" NOT NULL,
	"direction" "message_direction" NOT NULL,
	"from_number" varchar(100),
	"to_number" varchar(100),
	"from_email" text,
	"to_email" text,
	"body" text NOT NULL,
	"media_urls" jsonb DEFAULT '[]'::jsonb,
	"external_id" varchar(100),
	"status" varchar(20) DEFAULT 'sent',
	"delivered_at" timestamp,
	"read_at" timestamp,
	"sent_by_id" uuid,
	"ai_generated" boolean DEFAULT false,
	"ai_draft" text,
	"contact_id" varchar(100),
	"contact_name" text,
	"contact_type" varchar(20),
	"is_acknowledged" boolean DEFAULT false,
	"acknowledged_by_id" uuid,
	"acknowledged_at" timestamp,
	"scheduled_at" timestamp,
	"schedule_status" varchar(20),
	"is_after_hours" boolean DEFAULT false,
	"after_hours_auto_reply_sent" boolean DEFAULT false,
	"synced_to_az" boolean DEFAULT false,
	"az_activity_id" varchar(100),
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"policy_number" text NOT NULL,
	"amount" real NOT NULL,
	"processing_fee" real NOT NULL,
	"convenience_fee" real DEFAULT 0,
	"convenience_fee_waived" boolean DEFAULT false,
	"total_amount" real NOT NULL,
	"payment_type" "payment_advance_type" NOT NULL,
	"payment_info" text NOT NULL,
	"draft_date" text NOT NULL,
	"submitted_date" text NOT NULL,
	"status" "payment_advance_status" DEFAULT 'pending',
	"processed_at" timestamp,
	"notes" text,
	"reason" text,
	"reason_details" text,
	"agencyzoom_id" text,
	"agencyzoom_type" text,
	"submitter_email" text,
	"submitter_user_id" uuid,
	"reminder_sent" boolean DEFAULT false,
	"reminder_sent_at" timestamp,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"hawksoft_policy_id" varchar(100),
	"policy_number" varchar(50) NOT NULL,
	"line_of_business" varchar(50) NOT NULL,
	"carrier" varchar(100),
	"effective_date" timestamp NOT NULL,
	"expiration_date" timestamp NOT NULL,
	"premium" numeric(12, 2),
	"status" "policy_status" DEFAULT 'active',
	"coverages" jsonb,
	"last_synced_at" timestamp,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"policy_id" uuid,
	"address" jsonb NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"year_built" integer,
	"square_feet" integer,
	"stories" integer,
	"construction_type" varchar(50),
	"roof_type" varchar(50),
	"roof_age" integer,
	"nearmap_data" jsonb,
	"historical_images" jsonb DEFAULT '[]'::jsonb,
	"risk_score" numeric(3, 2),
	"hazard_exposure" jsonb,
	"ai_underwriting_summary" text,
	"last_nearmap_sync" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"address" text NOT NULL,
	"formatted_address" text,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"nearmap_data" jsonb,
	"rpr_data" jsonb,
	"ai_analysis" jsonb,
	"historical_surveys" jsonb DEFAULT '[]'::jsonb,
	"historical_comparison" jsonb,
	"oblique_views" jsonb,
	"lookup_source" varchar(20) DEFAULT 'manual',
	"linked_quote_id" uuid,
	"linked_property_id" uuid,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uploaded_by_id" uuid,
	"original_file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text DEFAULT 'application/pdf',
	"storage_path" text,
	"source" text DEFAULT 'upload',
	"email_message_id" text,
	"email_subject" text,
	"email_from" text,
	"carrier_name" text,
	"quote_type" "quote_document_type",
	"quoted_premium" real,
	"term_months" integer,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"quote_number" text,
	"customer_name" text,
	"customer_address" text,
	"customer_city" text,
	"customer_state" text,
	"customer_zip" text,
	"customer_phone" text,
	"customer_email" text,
	"coverage_details" jsonb,
	"vehicle_info" jsonb,
	"property_info" jsonb,
	"driver_info" jsonb,
	"status" "quote_document_status" DEFAULT 'uploaded',
	"extraction_error" text,
	"raw_extraction" jsonb,
	"extracted_at" timestamp,
	"az_lead_id" text,
	"az_customer_id" text,
	"az_posted_at" timestamp,
	"az_pipeline_id" integer,
	"az_stage_name" text,
	"az_note_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"type" "quote_type" NOT NULL,
	"status" "quote_status" DEFAULT 'draft',
	"created_by_id" uuid,
	"contact_info" jsonb,
	"quote_data" jsonb,
	"vehicles" jsonb,
	"drivers" jsonb,
	"property" jsonb,
	"carrier_quotes" jsonb DEFAULT '[]'::jsonb,
	"selected_carrier" varchar(100),
	"selected_premium" numeric(12, 2),
	"uploaded_documents" jsonb DEFAULT '[]'::jsonb,
	"ai_extracted_data" jsonb,
	"ai_suggestions" jsonb DEFAULT '[]'::jsonb,
	"follow_up_date" timestamp,
	"notes" text,
	"converted_to_policy_id" uuid,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"call_session_id" text,
	"call_id" uuid,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_id" text,
	"sentiment" varchar(20),
	"scheduled_for" timestamp NOT NULL,
	"status" "review_request_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"twilio_message_id" text,
	"error_message" text,
	"suppressed" boolean DEFAULT false,
	"suppression_reason" varchar(50),
	"google_review_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "risk_monitor_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid,
	"policy_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"description" text,
	"api_source" varchar(20),
	"api_endpoint" text,
	"api_response_time_ms" integer,
	"api_status_code" integer,
	"api_success" boolean,
	"previous_status" "property_status",
	"new_status" "property_status",
	"request_data" jsonb,
	"response_data" jsonb,
	"error_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_monitor_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"run_type" varchar(20) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"policies_checked" integer DEFAULT 0 NOT NULL,
	"alerts_created" integer DEFAULT 0 NOT NULL,
	"errors_encountered" integer DEFAULT 0 NOT NULL,
	"rpr_calls_made" integer DEFAULT 0 NOT NULL,
	"mmi_calls_made" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_monitor_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"alert_type" "risk_alert_type" NOT NULL,
	"priority" "risk_alert_priority" DEFAULT '3' NOT NULL,
	"status" "risk_alert_status" DEFAULT 'new' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"previous_status" "property_status",
	"new_status" "property_status" NOT NULL,
	"listing_price" integer,
	"sale_price" integer,
	"data_source" varchar(20),
	"raw_data" jsonb,
	"assigned_to_user_id" uuid,
	"assigned_at" timestamp,
	"acknowledged_at" timestamp,
	"acknowledged_by_user_id" uuid,
	"resolved_at" timestamp,
	"resolved_by_user_id" uuid,
	"resolution" text,
	"resolution_type" varchar(50),
	"email_sent_at" timestamp,
	"email_recipients" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_monitor_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"az_contact_id" varchar(100),
	"az_policy_id" varchar(100),
	"contact_name" text NOT NULL,
	"contact_email" text,
	"contact_phone" varchar(20),
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" varchar(100) NOT NULL,
	"state" varchar(2) NOT NULL,
	"zip_code" varchar(10) NOT NULL,
	"policy_number" varchar(50),
	"carrier" varchar(100),
	"policy_type" varchar(50),
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"current_status" "property_status" DEFAULT 'off_market' NOT NULL,
	"previous_status" "property_status",
	"last_status_change" timestamp,
	"listing_price" integer,
	"listing_date" timestamp,
	"listing_agent" text,
	"days_on_market" integer,
	"mls_number" varchar(50),
	"last_sale_price" integer,
	"last_sale_date" timestamp,
	"rpr_property_id" varchar(100),
	"mmi_property_id" varchar(100),
	"owner_name" text,
	"owner_occupied" boolean,
	"estimated_value" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp,
	"last_check_source" varchar(20),
	"check_error_count" integer DEFAULT 0,
	"last_check_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_monitor_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"paused_at" timestamp,
	"paused_by_user_id" uuid,
	"pause_reason" text,
	"schedule_start_hour" integer DEFAULT 21 NOT NULL,
	"schedule_end_hour" integer DEFAULT 4 NOT NULL,
	"check_interval_minutes" integer DEFAULT 15 NOT NULL,
	"daily_request_budget" integer DEFAULT 100 NOT NULL,
	"requests_today" integer DEFAULT 0 NOT NULL,
	"last_budget_reset_at" timestamp,
	"recheck_days" integer DEFAULT 3 NOT NULL,
	"delay_between_calls_ms" integer DEFAULT 5000 NOT NULL,
	"last_scheduler_run_at" timestamp,
	"last_scheduler_completed_at" timestamp,
	"last_scheduler_error" text,
	"scheduler_run_count" integer DEFAULT 0 NOT NULL,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"email_recipients" jsonb,
	"rpr_credentials_valid" boolean DEFAULT false,
	"mmi_credentials_valid" boolean DEFAULT false,
	"last_credentials_check_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "risk_monitor_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50),
	"content" text NOT NULL,
	"variables" jsonb,
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration" varchar(50) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"request_data" jsonb,
	"response_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_metadata" (
	"tenant_id" uuid NOT NULL,
	"integration" varchar(50) NOT NULL,
	"last_incremental_sync_at" timestamp,
	"last_full_sync_at" timestamp,
	"last_sync_status" varchar(20),
	"last_sync_records_processed" integer,
	"last_sync_error_message" text,
	"incremental_sync_cursor" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_metadata_tenant_id_integration_pk" PRIMARY KEY("tenant_id","integration")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"assigned_to_id" uuid,
	"created_by_id" uuid,
	"status" varchar(20) DEFAULT 'pending',
	"priority" "triage_priority" DEFAULT 'medium',
	"due_at" timestamp,
	"completed_at" timestamp,
	"synced_to_az" boolean DEFAULT false,
	"az_task_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(63) NOT NULL,
	"logo_url" text,
	"primary_color" varchar(7) DEFAULT '#10B981',
	"accent_color" varchar(7) DEFAULT '#3B82F6',
	"phone" varchar(20),
	"email" text,
	"website" text,
	"address" jsonb,
	"timezone" varchar(50) DEFAULT 'America/Chicago',
	"business_hours" jsonb,
	"subscription_tier" "subscription_tier" DEFAULT 'starter',
	"subscription_status" varchar(20) DEFAULT 'active',
	"trial_ends_at" timestamp,
	"max_users" integer DEFAULT 3,
	"ai_tokens_limit" integer DEFAULT 100000,
	"transcription_minutes_limit" integer DEFAULT 60,
	"sms_limit" integer DEFAULT 500,
	"storage_gb_limit" integer DEFAULT 5,
	"ai_tokens_used" integer DEFAULT 0,
	"transcription_minutes_used" integer DEFAULT 0,
	"sms_used" integer DEFAULT 0,
	"storage_gb_used" numeric(10, 2) DEFAULT '0',
	"integrations" jsonb,
	"features" jsonb DEFAULT '{"aiAssistant":true,"voiceTranscription":true,"propertyIntelligence":false,"commercialQuotes":false,"trainingSystem":true,"riskMonitor":false,"reviewAutoSend":true}'::jsonb,
	"ai_personality" text DEFAULT 'professional and friendly',
	"ai_custom_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "training_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"content" jsonb,
	"required_skill_level" integer DEFAULT 1,
	"prerequisite_module_ids" jsonb DEFAULT '[]'::jsonb,
	"estimated_minutes" integer,
	"skill_points_awarded" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "triage_type" NOT NULL,
	"status" "triage_status" DEFAULT 'pending',
	"priority" "triage_priority" DEFAULT 'medium',
	"customer_id" uuid,
	"call_id" uuid,
	"quote_id" uuid,
	"assigned_to_id" uuid,
	"assigned_at" timestamp,
	"title" text NOT NULL,
	"description" text,
	"ai_summary" text,
	"ai_priority_score" numeric(5, 2),
	"ai_priority_reason" text,
	"due_at" timestamp,
	"sla_breached" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by_id" uuid,
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_training_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'not_started',
	"progress_percent" integer DEFAULT 0,
	"quiz_score" numeric(5, 2),
	"quiz_attempts" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"auth_id" uuid,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" varchar(20),
	"avatar_url" text,
	"role" "user_role" DEFAULT 'agent',
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"extension" varchar(10),
	"is_available" boolean DEFAULT true,
	"current_status" varchar(20) DEFAULT 'available',
	"agencyzoom_id" varchar(50),
	"agent_code" varchar(20),
	"direct_dial" varchar(20),
	"cell_phone" varchar(20),
	"skill_level" integer DEFAULT 1,
	"completed_modules" jsonb DEFAULT '[]'::jsonb,
	"certifications" jsonb DEFAULT '[]'::jsonb,
	"mentor_id" uuid,
	"in_lead_rotation" boolean DEFAULT true,
	"lead_rotation_order" integer,
	"preferences" jsonb,
	"is_active" boolean DEFAULT true,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_id_unique" UNIQUE("auth_id")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"vin" varchar(17),
	"year" integer,
	"make" varchar(50),
	"model" varchar(50),
	"use" varchar(50),
	"annual_miles" integer,
	"coverages" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(64),
	"events" jsonb NOT NULL,
	"headers" jsonb,
	"is_active" boolean DEFAULT true,
	"last_triggered_at" timestamp,
	"success_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wrapup_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"direction" text DEFAULT 'Inbound' NOT NULL,
	"agent_extension" text,
	"agent_name" text,
	"status" "wrapup_status" DEFAULT 'pending_ai_processing' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_email" text,
	"policy_numbers" text[],
	"insurance_type" text,
	"request_type" text,
	"summary" text,
	"ai_cleaned_summary" text,
	"ai_processing_status" text DEFAULT 'pending',
	"ai_processed_at" timestamp,
	"ai_extraction" jsonb,
	"ai_confidence" numeric(3, 2),
	"match_status" text DEFAULT 'unprocessed',
	"trestle_data" jsonb,
	"ai_recommendation" jsonb,
	"reviewer_decision" text,
	"reviewer_id" uuid,
	"reviewed_at" timestamp,
	"outcome" text,
	"agencyzoom_note_id" text,
	"agencyzoom_ticket_id" text,
	"note_auto_posted" boolean DEFAULT false,
	"note_auto_posted_at" timestamp,
	"needs_phone_update" boolean DEFAULT false,
	"phone_update_acknowledged_at" timestamp,
	"phone_update_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_assist_telemetry" ADD CONSTRAINT "agent_assist_telemetry_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_assist_telemetry" ADD CONSTRAINT "agent_assist_telemetry_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_assist_telemetry" ADD CONSTRAINT "agent_assist_telemetry_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_predictions" ADD CONSTRAINT "ai_predictions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_token_usage" ADD CONSTRAINT "ai_token_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_token_usage" ADD CONSTRAINT "ai_token_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_token_usage_daily" ADD CONSTRAINT "ai_token_usage_daily_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_notes_log" ADD CONSTRAINT "call_notes_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_notes_log" ADD CONSTRAINT "call_notes_log_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_producer_id_users_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_csr_id_users_id_fk" FOREIGN KEY ("csr_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_id_cards" ADD CONSTRAINT "generated_id_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_id_cards" ADD CONSTRAINT "generated_id_cards_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_reviews" ADD CONSTRAINT "google_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_reviews" ADD CONSTRAINT "google_reviews_matched_by_users_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_claim_activity" ADD CONSTRAINT "lead_claim_activity_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_claim_activity" ADD CONSTRAINT "lead_claim_activity_lead_id_lead_queue_entries_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead_queue_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_claim_activity" ADD CONSTRAINT "lead_claim_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queue_entries" ADD CONSTRAINT "lead_queue_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queue_entries" ADD CONSTRAINT "lead_queue_entries_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queue_entries" ADD CONSTRAINT "lead_queue_entries_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_round_robin_state" ADD CONSTRAINT "lead_round_robin_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_round_robin_state" ADD CONSTRAINT "lead_round_robin_state_last_user_id_users_id_fk" FOREIGN KEY ("last_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_transcript_segments" ADD CONSTRAINT "live_transcript_segments_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_suggestions" ADD CONSTRAINT "match_suggestions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_suggestions" ADD CONSTRAINT "match_suggestions_wrapup_draft_id_wrapup_drafts_id_fk" FOREIGN KEY ("wrapup_draft_id") REFERENCES "public"."wrapup_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_acknowledged_by_id_users_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD CONSTRAINT "payment_advances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD CONSTRAINT "payment_advances_submitter_user_id_users_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_lookups" ADD CONSTRAINT "property_lookups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_lookups" ADD CONSTRAINT "property_lookups_linked_quote_id_quotes_id_fk" FOREIGN KEY ("linked_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_lookups" ADD CONSTRAINT "property_lookups_linked_property_id_properties_id_fk" FOREIGN KEY ("linked_property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_documents" ADD CONSTRAINT "quote_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_to_policy_id_policies_id_fk" FOREIGN KEY ("converted_to_policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_activity_events" ADD CONSTRAINT "risk_monitor_activity_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_activity_events" ADD CONSTRAINT "risk_monitor_activity_events_policy_id_risk_monitor_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."risk_monitor_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_activity_log" ADD CONSTRAINT "risk_monitor_activity_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_alerts" ADD CONSTRAINT "risk_monitor_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_alerts" ADD CONSTRAINT "risk_monitor_alerts_policy_id_risk_monitor_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."risk_monitor_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_alerts" ADD CONSTRAINT "risk_monitor_alerts_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_alerts" ADD CONSTRAINT "risk_monitor_alerts_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_alerts" ADD CONSTRAINT "risk_monitor_alerts_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_policies" ADD CONSTRAINT "risk_monitor_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_settings" ADD CONSTRAINT "risk_monitor_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_monitor_settings" ADD CONSTRAINT "risk_monitor_settings_paused_by_user_id_users_id_fk" FOREIGN KEY ("paused_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_items" ADD CONSTRAINT "triage_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_items" ADD CONSTRAINT "triage_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_items" ADD CONSTRAINT "triage_items_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_items" ADD CONSTRAINT "triage_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_items" ADD CONSTRAINT "triage_items_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_items" ADD CONSTRAINT "triage_items_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_training_progress" ADD CONSTRAINT "user_training_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_training_progress" ADD CONSTRAINT "user_training_progress_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrapup_drafts" ADD CONSTRAINT "wrapup_drafts_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_tenant_idx" ON "activities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "activities_customer_idx" ON "activities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "activities_type_idx" ON "activities" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "agent_assist_telemetry_tenant_idx" ON "agent_assist_telemetry" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agent_assist_telemetry_user_idx" ON "agent_assist_telemetry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_assist_telemetry_call_idx" ON "agent_assist_telemetry" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "agent_assist_telemetry_type_idx" ON "agent_assist_telemetry" USING btree ("suggestion_type");--> statement-breakpoint
CREATE INDEX "agent_assist_telemetry_playbook_idx" ON "agent_assist_telemetry" USING btree ("playbook_id");--> statement-breakpoint
CREATE INDEX "agent_assist_telemetry_created_at_idx" ON "agent_assist_telemetry" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_predictions_tenant_idx" ON "ai_predictions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_predictions_type_idx" ON "ai_predictions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_predictions_subject_idx" ON "ai_predictions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "ai_predictions_created_at_idx" ON "ai_predictions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_token_usage_tenant_idx" ON "ai_token_usage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_token_usage_provider_idx" ON "ai_token_usage" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "ai_token_usage_created_idx" ON "ai_token_usage" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_token_usage_model_idx" ON "ai_token_usage" USING btree ("tenant_id","model");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_token_daily_tenant_date_idx" ON "ai_token_usage_daily" USING btree ("tenant_id","date","provider","model");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "api_keys_prefix_idx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "api_keys_active_idx" ON "api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "call_events_call_idx" ON "call_events" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_events_external_idx" ON "call_events" USING btree ("external_call_id");--> statement-breakpoint
CREATE INDEX "call_events_timestamp_idx" ON "call_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "call_events_type_idx" ON "call_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "call_notes_log_caller_idx" ON "call_notes_log" USING btree ("caller_phone");--> statement-breakpoint
CREATE INDEX "call_notes_log_customer_idx" ON "call_notes_log" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "call_notes_log_created_idx" ON "call_notes_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "call_notes_log_match_idx" ON "call_notes_log" USING btree ("tenant_id","match_status");--> statement-breakpoint
CREATE INDEX "call_notes_log_az_idx" ON "call_notes_log" USING btree ("tenant_id","az_note_status");--> statement-breakpoint
CREATE INDEX "calls_tenant_idx" ON "calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "calls_customer_idx" ON "calls" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "calls_agent_idx" ON "calls" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "calls_from_idx" ON "calls" USING btree ("tenant_id","from_number");--> statement-breakpoint
CREATE INDEX "calls_started_idx" ON "calls" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "customers_az_idx" ON "customers" USING btree ("tenant_id","agencyzoom_id");--> statement-breakpoint
CREATE INDEX "customers_hs_idx" ON "customers" USING btree ("tenant_id","hawksoft_client_code");--> statement-breakpoint
CREATE INDEX "customers_archived_idx" ON "customers" USING btree ("tenant_id","is_archived");--> statement-breakpoint
CREATE INDEX "customers_lead_idx" ON "customers" USING btree ("tenant_id","is_lead");--> statement-breakpoint
CREATE INDEX "drivers_tenant_idx" ON "drivers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "drivers_policy_idx" ON "drivers" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "embeddings_tenant_idx" ON "embeddings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "embeddings_type_idx" ON "embeddings" USING btree ("type");--> statement-breakpoint
CREATE INDEX "embeddings_source_idx" ON "embeddings" USING btree ("source_id","source_table");--> statement-breakpoint
CREATE UNIQUE INDEX "embeddings_content_hash_idx" ON "embeddings" USING btree ("tenant_id","content_hash");--> statement-breakpoint
CREATE INDEX "generated_id_cards_tenant_idx" ON "generated_id_cards" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "generated_id_cards_contact_idx" ON "generated_id_cards" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "generated_id_cards_policy_idx" ON "generated_id_cards" USING btree ("policy_number");--> statement-breakpoint
CREATE INDEX "generated_id_cards_created_idx" ON "generated_id_cards" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "google_reviews_tenant_idx" ON "google_reviews" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "google_reviews_google_id_idx" ON "google_reviews" USING btree ("google_review_id");--> statement-breakpoint
CREATE INDEX "google_reviews_reviewer_name_idx" ON "google_reviews" USING btree ("reviewer_name_normalized");--> statement-breakpoint
CREATE INDEX "google_reviews_matched_customer_idx" ON "google_reviews" USING btree ("matched_customer_id");--> statement-breakpoint
CREATE INDEX "google_reviews_rating_idx" ON "google_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "google_reviews_timestamp_idx" ON "google_reviews" USING btree ("review_timestamp");--> statement-breakpoint
CREATE INDEX "knowledge_tenant_idx" ON "knowledge_articles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "knowledge_category_idx" ON "knowledge_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "lead_claim_activity_lead_idx" ON "lead_claim_activity" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_claim_activity_user_idx" ON "lead_claim_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lead_claim_activity_timestamp_idx" ON "lead_claim_activity" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "lead_queue_status_idx" ON "lead_queue_entries" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "lead_queue_source_idx" ON "lead_queue_entries" USING btree ("tenant_id","source");--> statement-breakpoint
CREATE INDEX "lead_queue_assigned_idx" ON "lead_queue_entries" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "lead_queue_expires_idx" ON "lead_queue_entries" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "lead_queue_created_idx" ON "lead_queue_entries" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_round_robin_tenant_team_idx" ON "lead_round_robin_state" USING btree ("tenant_id","team_id");--> statement-breakpoint
CREATE INDEX "live_segments_call_idx" ON "live_transcript_segments" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "live_segments_seq_idx" ON "live_transcript_segments" USING btree ("call_id","sequence_number");--> statement-breakpoint
CREATE INDEX "match_suggestions_wrapup_idx" ON "match_suggestions" USING btree ("wrapup_draft_id");--> statement-breakpoint
CREATE INDEX "match_suggestions_confidence_idx" ON "match_suggestions" USING btree ("wrapup_draft_id","confidence");--> statement-breakpoint
CREATE INDEX "messages_tenant_idx" ON "messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "messages_customer_idx" ON "messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "messages_phone_idx" ON "messages" USING btree ("tenant_id","from_number");--> statement-breakpoint
CREATE INDEX "messages_acknowledged_idx" ON "messages" USING btree ("tenant_id","is_acknowledged");--> statement-breakpoint
CREATE INDEX "messages_scheduled_idx" ON "messages" USING btree ("tenant_id","scheduled_at","schedule_status");--> statement-breakpoint
CREATE INDEX "payment_advances_tenant_idx" ON "payment_advances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_advances_policy_idx" ON "payment_advances" USING btree ("policy_number");--> statement-breakpoint
CREATE INDEX "payment_advances_status_idx" ON "payment_advances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_advances_draft_date_idx" ON "payment_advances" USING btree ("draft_date");--> statement-breakpoint
CREATE INDEX "payment_advances_created_at_idx" ON "payment_advances" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "policies_tenant_idx" ON "policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "policies_customer_idx" ON "policies" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "policies_number_idx" ON "policies" USING btree ("tenant_id","policy_number");--> statement-breakpoint
CREATE INDEX "properties_tenant_idx" ON "properties" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "properties_customer_idx" ON "properties" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "property_lookups_tenant_idx" ON "property_lookups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "property_lookups_address_idx" ON "property_lookups" USING btree ("tenant_id","address");--> statement-breakpoint
CREATE INDEX "property_lookups_coords_idx" ON "property_lookups" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "quote_documents_tenant_idx" ON "quote_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quote_documents_status_idx" ON "quote_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quote_documents_carrier_idx" ON "quote_documents" USING btree ("carrier_name");--> statement-breakpoint
CREATE INDEX "quote_documents_customer_name_idx" ON "quote_documents" USING btree ("customer_name");--> statement-breakpoint
CREATE INDEX "quote_documents_created_at_idx" ON "quote_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quotes_tenant_idx" ON "quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quotes_customer_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "quotes_type_idx" ON "quotes" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "review_requests_tenant_idx" ON "review_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "review_requests_status_idx" ON "review_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_requests_scheduled_for_idx" ON "review_requests" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "review_requests_customer_phone_idx" ON "review_requests" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "review_requests_customer_id_idx" ON "review_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "risk_events_tenant_idx" ON "risk_monitor_activity_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "risk_events_run_id_idx" ON "risk_monitor_activity_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "risk_events_policy_id_idx" ON "risk_monitor_activity_events" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "risk_events_type_idx" ON "risk_monitor_activity_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "risk_events_created_at_idx" ON "risk_monitor_activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "risk_activity_log_tenant_idx" ON "risk_monitor_activity_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "risk_activity_log_run_id_idx" ON "risk_monitor_activity_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "risk_activity_log_started_at_idx" ON "risk_monitor_activity_log" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "risk_alerts_tenant_idx" ON "risk_monitor_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "risk_alerts_policy_idx" ON "risk_monitor_alerts" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "risk_alerts_status_idx" ON "risk_monitor_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "risk_alerts_priority_idx" ON "risk_monitor_alerts" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "risk_alerts_created_at_idx" ON "risk_monitor_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "risk_policies_tenant_idx" ON "risk_monitor_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "risk_policies_status_idx" ON "risk_monitor_policies" USING btree ("current_status");--> statement-breakpoint
CREATE INDEX "risk_policies_last_checked_idx" ON "risk_monitor_policies" USING btree ("last_checked_at");--> statement-breakpoint
CREATE INDEX "risk_policies_address_idx" ON "risk_monitor_policies" USING btree ("address_line1","city","state");--> statement-breakpoint
CREATE INDEX "sms_templates_tenant_idx" ON "sms_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sms_templates_category_idx" ON "sms_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "sync_logs_tenant_idx" ON "sync_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_logs_integration_idx" ON "sync_logs" USING btree ("tenant_id","integration");--> statement-breakpoint
CREATE INDEX "sync_logs_created_idx" ON "sync_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_tenant_idx" ON "tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tasks_assigned_idx" ON "tasks" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "training_modules_tenant_idx" ON "training_modules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "training_modules_category_idx" ON "training_modules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "triage_tenant_idx" ON "triage_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "triage_status_idx" ON "triage_items" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "triage_assigned_idx" ON "triage_items" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "triage_priority_idx" ON "triage_items" USING btree ("tenant_id","priority","status");--> statement-breakpoint
CREATE INDEX "triage_ai_score_idx" ON "triage_items" USING btree ("tenant_id","ai_priority_score","created_at");--> statement-breakpoint
CREATE INDEX "training_progress_user_idx" ON "user_training_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "training_progress_module_idx" ON "user_training_progress" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_auth_idx" ON "users" USING btree ("auth_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "users_az_idx" ON "users" USING btree ("tenant_id","agencyzoom_id");--> statement-breakpoint
CREATE INDEX "users_extension_idx" ON "users" USING btree ("tenant_id","extension");--> statement-breakpoint
CREATE INDEX "vehicles_tenant_idx" ON "vehicles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vehicles_policy_idx" ON "vehicles" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "vehicles_vin_idx" ON "vehicles" USING btree ("tenant_id","vin");--> statement-breakpoint
CREATE INDEX "webhooks_tenant_idx" ON "webhooks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "webhooks_active_idx" ON "webhooks" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "wrapup_drafts_call_unique" ON "wrapup_drafts" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "wrapup_drafts_status_idx" ON "wrapup_drafts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "wrapup_drafts_match_idx" ON "wrapup_drafts" USING btree ("tenant_id","match_status");--> statement-breakpoint
CREATE INDEX "wrapup_drafts_created_idx" ON "wrapup_drafts" USING btree ("tenant_id","created_at");