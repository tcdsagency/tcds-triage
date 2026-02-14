-- Add policy-level agent fields from HawkSoft (Agent1/Agent2/Agent3)
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "agent1" varchar(50);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "agent2" varchar(50);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "agent3" varchar(50);
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "producer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "policies_producer_idx" ON "policies" ("tenant_id", "producer_id");

-- Add assigned agent to renewal_comparisons for per-agent filtering
ALTER TABLE "renewal_comparisons" ADD COLUMN IF NOT EXISTS "assigned_agent_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "renewal_comparisons_assigned_agent_idx" ON "renewal_comparisons" ("tenant_id", "assigned_agent_id");
