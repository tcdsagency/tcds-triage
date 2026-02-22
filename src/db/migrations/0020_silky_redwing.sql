CREATE TABLE "twilio_webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"call_sid" varchar(64) NOT NULL,
	"call_status" varchar(30) NOT NULL,
	"direction" varchar(30),
	"from_number" varchar(30),
	"to_number" varchar(30),
	"call_duration" integer,
	"caller_name" varchar(200),
	"matched_call_id" uuid,
	"processing_result" varchar(30) NOT NULL,
	"error_message" text,
	"raw_payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "twilio_call_sid" varchar(40);--> statement-breakpoint
ALTER TABLE "twilio_webhook_logs" ADD CONSTRAINT "twilio_webhook_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twilio_webhook_logs" ADD CONSTRAINT "twilio_webhook_logs_matched_call_id_calls_id_fk" FOREIGN KEY ("matched_call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "twilio_webhook_logs_tenant_received_idx" ON "twilio_webhook_logs" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE INDEX "twilio_webhook_logs_tenant_callsid_idx" ON "twilio_webhook_logs" USING btree ("tenant_id","call_sid");--> statement-breakpoint
CREATE INDEX "calls_twilio_sid_idx" ON "calls" USING btree ("tenant_id","twilio_call_sid");--> statement-breakpoint
CREATE INDEX "renewal_baselines_tenant_policy_idx" ON "renewal_baselines" USING btree ("tenant_id","policy_number","effective_date");--> statement-breakpoint
CREATE INDEX "renewal_comparisons_recommendation_idx" ON "renewal_comparisons" USING btree ("tenant_id","recommendation");