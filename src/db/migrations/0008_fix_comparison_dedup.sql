-- Fix: Replace NULL-unsafe unique index on renewal_comparisons.
-- The old index used (policy_id, renewal_effective_date) where policy_id is nullable.
-- In SQL, NULL != NULL, so rows with NULL policy_id bypassed the constraint entirely.
-- New index uses always-populated columns that mirror the candidate dedup pattern.

-- Step 1: Remove duplicates (keep the one with an agent decision, or the newest)
DELETE FROM renewal_comparisons
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id, policy_number, carrier_name, renewal_effective_date)
    id
  FROM renewal_comparisons
  ORDER BY tenant_id, policy_number, carrier_name, renewal_effective_date,
    CASE WHEN agent_decision IS NOT NULL THEN 0 ELSE 1 END,
    created_at DESC
);

-- Step 2: Drop old index
DROP INDEX IF EXISTS renewal_comparisons_policy_date_unique;

-- Step 3: Create new NULL-safe index
CREATE UNIQUE INDEX renewal_comparisons_dedup_unique
  ON renewal_comparisons (tenant_id, policy_number, carrier_name, renewal_effective_date);
