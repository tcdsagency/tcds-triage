-- Add check engine result columns to renewal_comparisons
ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "check_results" jsonb;
ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "check_summary" jsonb;
