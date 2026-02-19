-- 3CX XAPI Rebuild Migration
-- Adds 3CX XAPI fields to calls and wrapup_drafts tables
-- Creates threecx_polling_state table for recording poller

-- ============================================================
-- 1. Add 3CX columns to calls table
-- ============================================================

ALTER TABLE "calls" ADD COLUMN "threecx_recording_id" integer;
ALTER TABLE "calls" ADD COLUMN "threecx_sentiment_score" smallint;
ALTER TABLE "calls" ADD COLUMN "threecx_summary" text;
ALTER TABLE "calls" ADD COLUMN "threecx_transcription" text;
ALTER TABLE "calls" ADD COLUMN "threecx_recording_url" text;
ALTER TABLE "calls" ADD COLUMN "threecx_call_type" varchar(30);
ALTER TABLE "calls" ADD COLUMN "threecx_from_dn" varchar(10);
ALTER TABLE "calls" ADD COLUMN "threecx_to_dn" varchar(10);
ALTER TABLE "calls" ADD COLUMN "threecx_from_caller_number" varchar(20);
ALTER TABLE "calls" ADD COLUMN "threecx_to_caller_number" varchar(20);
ALTER TABLE "calls" ADD COLUMN "threecx_polled_at" timestamp;

-- Unique constraint on 3CX recording ID (prevents duplicate processing)
CREATE UNIQUE INDEX "calls_threecx_recording_id_unique" ON "calls" ("threecx_recording_id") WHERE "threecx_recording_id" IS NOT NULL;

-- ============================================================
-- 2. Add 3CX columns to wrapup_drafts table
-- ============================================================

ALTER TABLE "wrapup_drafts" ADD COLUMN "threecx_recording_id" integer;
ALTER TABLE "wrapup_drafts" ADD COLUMN "threecx_summary" text;
ALTER TABLE "wrapup_drafts" ADD COLUMN "threecx_sentiment_score" smallint;
ALTER TABLE "wrapup_drafts" ADD COLUMN "source" varchar(20) DEFAULT 'threecx';

-- ============================================================
-- 3. Create threecx_polling_state table
-- ============================================================

CREATE TABLE IF NOT EXISTS "threecx_polling_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "last_seen_id" integer NOT NULL DEFAULT 0,
  "last_polled_at" timestamp,
  "poll_errors" integer NOT NULL DEFAULT 0,
  "last_error" text
);

CREATE UNIQUE INDEX "threecx_polling_state_tenant_unique" ON "threecx_polling_state" ("tenant_id");
