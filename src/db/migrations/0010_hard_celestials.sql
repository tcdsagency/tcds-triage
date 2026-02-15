ALTER TYPE "public"."mortgagee_payment_status" ADD VALUE 'not_in_mci';--> statement-breakpoint
ALTER TABLE "property_lookups" ADD COLUMN "orion180_data" jsonb;