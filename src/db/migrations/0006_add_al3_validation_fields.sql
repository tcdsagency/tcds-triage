-- Add AL3 validation fields to policy_creator_documents
-- These fields support the compiler validation layer (Gate E)

ALTER TABLE "policy_creator_documents"
ADD COLUMN IF NOT EXISTS "generated_al3_raw" text;

ALTER TABLE "policy_creator_documents"
ADD COLUMN IF NOT EXISTS "validation_errors" jsonb;

ALTER TABLE "policy_creator_documents"
ADD COLUMN IF NOT EXISTS "validation_warnings" jsonb;
