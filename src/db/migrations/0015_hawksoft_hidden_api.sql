ALTER TABLE "customers" ADD COLUMN "hawksoft_cloud_uuid" varchar(36);--> statement-breakpoint
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
CREATE INDEX "hs_attachment_log_tenant_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hs_attachment_log_dedup_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id","hawksoft_attachment_id");--> statement-breakpoint
CREATE INDEX "hs_attachment_log_policy_idx" ON "hawksoft_attachment_log" USING btree ("tenant_id","policy_number");--> statement-breakpoint
ALTER TABLE "hawksoft_attachment_log" ADD CONSTRAINT "hawksoft_attachment_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hawksoft_attachment_log" ADD CONSTRAINT "hawksoft_attachment_log_batch_id_renewal_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."renewal_batches"("id") ON DELETE set null ON UPDATE no action;
