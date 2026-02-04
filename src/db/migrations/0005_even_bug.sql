CREATE TABLE "al3_transaction_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"transaction_type" varchar(10),
	"policy_number" varchar(50),
	"carrier_code" varchar(20),
	"carrier_name" varchar(100),
	"line_of_business" varchar(50),
	"effective_date" timestamp,
	"insured_name" text,
	"al3_file_name" varchar(255),
	"raw_al3_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "renewal_batches" ADD COLUMN "total_archived_transactions" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "al3_transaction_archive" ADD CONSTRAINT "al3_transaction_archive_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "al3_transaction_archive" ADD CONSTRAINT "al3_transaction_archive_batch_id_renewal_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."renewal_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "al3_archive_tenant_idx" ON "al3_transaction_archive" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "al3_archive_batch_idx" ON "al3_transaction_archive" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "al3_archive_type_idx" ON "al3_transaction_archive" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "al3_archive_policy_idx" ON "al3_transaction_archive" USING btree ("policy_number");