CREATE TYPE "public"."service_ticket_status" AS ENUM('active', 'completed', 'removed');--> statement-breakpoint
CREATE TABLE "service_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"az_ticket_id" integer NOT NULL,
	"az_household_id" integer,
	"wrapup_draft_id" uuid,
	"customer_id" uuid,
	"subject" text NOT NULL,
	"description" text,
	"status" "service_ticket_status" DEFAULT 'active' NOT NULL,
	"pipeline_id" integer,
	"pipeline_name" text,
	"stage_id" integer,
	"stage_name" text,
	"category_id" integer,
	"category_name" text,
	"priority_id" integer,
	"priority_name" text,
	"csr_id" integer,
	"csr_name" text,
	"due_date" date,
	"az_created_at" timestamp,
	"az_completed_at" timestamp,
	"resolution_id" integer,
	"resolution_desc" text,
	"source" text DEFAULT 'api' NOT NULL,
	"last_synced_from_az" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_tickets_az_ticket_id_unique" UNIQUE("az_ticket_id")
);
--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_wrapup_draft_id_wrapup_drafts_id_fk" FOREIGN KEY ("wrapup_draft_id") REFERENCES "public"."wrapup_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_tickets_tenant_idx" ON "service_tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "service_tickets_az_id_idx" ON "service_tickets" USING btree ("az_ticket_id");--> statement-breakpoint
CREATE INDEX "service_tickets_customer_idx" ON "service_tickets" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "service_tickets_status_idx" ON "service_tickets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "service_tickets_wrapup_idx" ON "service_tickets" USING btree ("wrapup_draft_id");