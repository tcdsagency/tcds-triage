-- Add ePayPolicy integration columns to payment_advances
ALTER TYPE "payment_advance_status" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "payment_advance_status" ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE "payment_advances" ADD COLUMN IF NOT EXISTS "epay_token_id" text;
ALTER TABLE "payment_advances" ADD COLUMN IF NOT EXISTS "epay_schedule_id" text;
ALTER TABLE "payment_advances" ADD COLUMN IF NOT EXISTS "epay_transaction_id" text;
ALTER TABLE "payment_advances" ADD COLUMN IF NOT EXISTS "epay_error" text;
ALTER TABLE "payment_advances" ADD COLUMN IF NOT EXISTS "epay_last_sync_at" timestamp;
