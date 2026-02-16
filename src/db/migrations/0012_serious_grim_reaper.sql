ALTER TYPE "public"."renewal_comparison_status" ADD VALUE 'pending_manual_renewal';--> statement-breakpoint
ALTER TABLE "renewal_comparisons" ADD COLUMN "renewal_source" varchar(20);