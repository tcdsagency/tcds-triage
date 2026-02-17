CREATE TABLE "renewal_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_number" varchar(50) NOT NULL,
	"carrier_code" varchar(20) NOT NULL,
	"carrier_name" varchar(100),
	"line_of_business" varchar(50),
	"insured_name" varchar(200),
	"effective_date" timestamp NOT NULL,
	"expiration_date" timestamp,
	"snapshot" jsonb,
	"raw_al3_content" text,
	"source_file_name" varchar(255),
	"batch_id" uuid,
	"policy_id" uuid,
	"customer_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "renewal_batches" ADD COLUMN "total_baselines_stored" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "renewal_baselines" ADD CONSTRAINT "renewal_baselines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_baselines" ADD CONSTRAINT "renewal_baselines_batch_id_renewal_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."renewal_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_baselines" ADD CONSTRAINT "renewal_baselines_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_baselines" ADD CONSTRAINT "renewal_baselines_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "renewal_baselines_tenant_idx" ON "renewal_baselines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "renewal_baselines_policy_idx" ON "renewal_baselines" USING btree ("policy_number");--> statement-breakpoint
CREATE INDEX "renewal_baselines_carrier_idx" ON "renewal_baselines" USING btree ("carrier_code");--> statement-breakpoint
CREATE INDEX "renewal_baselines_effective_idx" ON "renewal_baselines" USING btree ("effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "renewal_baselines_dedup_unique" ON "renewal_baselines" USING btree ("tenant_id","carrier_code","policy_number","effective_date");