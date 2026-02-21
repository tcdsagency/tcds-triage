ALTER TYPE "public"."payment_advance_status" ADD VALUE 'scheduled' BEFORE 'processed';--> statement-breakpoint
ALTER TYPE "public"."payment_advance_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "is_recurring" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "number_of_payments" integer;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "payment_interval" text;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "epay_token_id" text;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "epay_schedule_id" text;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "epay_transaction_id" text;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "epay_error" text;--> statement-breakpoint
ALTER TABLE "payment_advances" ADD COLUMN "epay_last_sync_at" timestamp;