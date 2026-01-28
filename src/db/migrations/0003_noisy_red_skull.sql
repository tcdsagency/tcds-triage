CREATE TABLE "autofill_usage_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wrapup_draft_id" uuid NOT NULL,
	"extraction_id" uuid,
	"user_id" uuid,
	"field_name" text NOT NULL,
	"ai_suggested_value" text,
	"ai_confidence" real,
	"final_value" text,
	"was_accepted" boolean NOT NULL,
	"was_edited" boolean NOT NULL,
	"time_to_decision_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_request_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wrapup_draft_id" uuid NOT NULL,
	"summary" text,
	"summary_confidence" real,
	"category_id" integer,
	"category_confidence" real,
	"priority_id" integer,
	"priority_confidence" real,
	"description" text,
	"description_confidence" real,
	"request_type" text,
	"urgency" text,
	"action_items" jsonb,
	"model_used" text,
	"tokens_used" integer,
	"processing_ms" integer,
	"extraction_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "autofill_usage_stats" ADD CONSTRAINT "autofill_usage_stats_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autofill_usage_stats" ADD CONSTRAINT "autofill_usage_stats_wrapup_draft_id_wrapup_drafts_id_fk" FOREIGN KEY ("wrapup_draft_id") REFERENCES "public"."wrapup_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autofill_usage_stats" ADD CONSTRAINT "autofill_usage_stats_extraction_id_service_request_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."service_request_extractions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autofill_usage_stats" ADD CONSTRAINT "autofill_usage_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_extractions" ADD CONSTRAINT "service_request_extractions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_extractions" ADD CONSTRAINT "service_request_extractions_wrapup_draft_id_wrapup_drafts_id_fk" FOREIGN KEY ("wrapup_draft_id") REFERENCES "public"."wrapup_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "autofill_usage_stats_tenant_idx" ON "autofill_usage_stats" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "autofill_usage_stats_wrapup_idx" ON "autofill_usage_stats" USING btree ("wrapup_draft_id");--> statement-breakpoint
CREATE INDEX "autofill_usage_stats_field_idx" ON "autofill_usage_stats" USING btree ("tenant_id","field_name");--> statement-breakpoint
CREATE INDEX "autofill_usage_stats_date_idx" ON "autofill_usage_stats" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "service_request_extractions_tenant_idx" ON "service_request_extractions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_request_extractions_wrapup_unique" ON "service_request_extractions" USING btree ("wrapup_draft_id");