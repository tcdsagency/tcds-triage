/**
 * One-time backfill: link unlinked renewal baselines to their HawkSoft policies.
 * Matches by exact policy_number + tenant_id.
 *
 * Usage: npx tsx scripts/tmp-link-baselines.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { renewalBaselines, policies } = await import('../src/db/schema');
  const { eq, and, isNull, sql } = await import('drizzle-orm');

  console.log('=== Link Unlinked Baselines ===\n');

  // Count unlinked before
  const [{ count: beforeCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(renewalBaselines)
    .where(isNull(renewalBaselines.policyId));
  console.log(`Unlinked baselines before: ${beforeCount}`);

  // Exact match: update baselines where policy_number matches
  const result = await db.execute(sql`
    UPDATE renewal_baselines rb
    SET policy_id = p.id,
        customer_id = p.customer_id,
        updated_at = NOW()
    FROM policies p
    WHERE rb.policy_number = p.policy_number
      AND rb.tenant_id = p.tenant_id
      AND rb.policy_id IS NULL
  `);
  console.log(`Exact match linked: ${(result as any).rowCount ?? '(check count below)'}`);

  // Suffix fallback: try stripping term suffix (-01, -2, etc.)
  const suffixResult = await db.execute(sql`
    UPDATE renewal_baselines rb
    SET policy_id = p.id,
        customer_id = p.customer_id,
        updated_at = NOW()
    FROM policies p
    WHERE rb.policy_id IS NULL
      AND rb.tenant_id = p.tenant_id
      AND rb.policy_number ~ '-\d{1,2}$'
      AND p.policy_number LIKE regexp_replace(rb.policy_number, '-\d{1,2}$', '') || '%'
  `);
  console.log(`Suffix fallback linked: ${(suffixResult as any).rowCount ?? '(check count below)'}`);

  // Reverse suffix: AL3 has base number, HawkSoft has suffixed version
  const reverseResult = await db.execute(sql`
    UPDATE renewal_baselines rb
    SET policy_id = p.id,
        customer_id = p.customer_id,
        updated_at = NOW()
    FROM policies p
    WHERE rb.policy_id IS NULL
      AND rb.tenant_id = p.tenant_id
      AND rb.policy_number NOT LIKE '%-_'
      AND rb.policy_number NOT LIKE '%-__'
      AND p.policy_number LIKE rb.policy_number || '-%'
  `);
  console.log(`Reverse suffix linked: ${(reverseResult as any).rowCount ?? '(check count below)'}`);

  // Count unlinked after
  const [{ count: afterCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(renewalBaselines)
    .where(isNull(renewalBaselines.policyId));
  console.log(`\nUnlinked baselines after: ${afterCount}`);
  console.log(`Total linked: ${Number(beforeCount) - Number(afterCount)}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
