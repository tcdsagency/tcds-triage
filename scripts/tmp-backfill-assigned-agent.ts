/**
 * Backfill assignedAgentId on existing renewal_comparisons
 * ========================================================
 * Priority: policies.producerId (policy-level agent) > customers.producerId (customer-level)
 *
 * Usage: npx tsx scripts/tmp-backfill-assigned-agent.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const { db } = await import('../src/db');
  const { renewalComparisons, policies, customers } = await import('../src/db/schema');
  const { eq, isNull, sql } = await import('drizzle-orm');

  console.log('Backfilling assignedAgentId on renewal_comparisons...\n');

  // Find comparisons without assignedAgentId
  const unassigned = await db
    .select({
      id: renewalComparisons.id,
      policyId: renewalComparisons.policyId,
      customerId: renewalComparisons.customerId,
    })
    .from(renewalComparisons)
    .where(isNull(renewalComparisons.assignedAgentId));

  console.log(`Found ${unassigned.length} comparisons without assignedAgentId`);

  // Batch fetch policy producerIds
  const policyIds = [...new Set(unassigned.filter(r => r.policyId).map(r => r.policyId!))];
  const policyProducers = new Map<string, string>();
  for (let i = 0; i < policyIds.length; i += 100) {
    const batch = policyIds.slice(i, i + 100);
    const rows = await db
      .select({ id: policies.id, producerId: policies.producerId })
      .from(policies)
      .where(sql`${policies.id} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
    for (const row of rows) {
      if (row.producerId) {
        policyProducers.set(row.id, row.producerId);
      }
    }
  }
  console.log(`Policies with producerId: ${policyProducers.size}`);

  // Batch fetch customer producerIds (fallback)
  const customerIds = [...new Set(unassigned.filter(r => r.customerId).map(r => r.customerId!))];
  const customerProducers = new Map<string, string>();
  for (let i = 0; i < customerIds.length; i += 100) {
    const batch = customerIds.slice(i, i + 100);
    const rows = await db
      .select({ id: customers.id, producerId: customers.producerId })
      .from(customers)
      .where(sql`${customers.id} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
    for (const row of rows) {
      if (row.producerId) {
        customerProducers.set(row.id, row.producerId);
      }
    }
  }
  console.log(`Customers with producerId: ${customerProducers.size}`);

  // Update comparisons: prefer policy agent, fallback to customer producer
  let fromPolicy = 0;
  let fromCustomer = 0;
  let skipped = 0;
  for (const comparison of unassigned) {
    // Try policy-level agent first
    let agentId = comparison.policyId ? policyProducers.get(comparison.policyId) : undefined;
    let source = 'policy';

    // Fallback to customer-level producer
    if (!agentId && comparison.customerId) {
      agentId = customerProducers.get(comparison.customerId);
      source = 'customer';
    }

    if (!agentId) {
      skipped++;
      continue;
    }

    await db
      .update(renewalComparisons)
      .set({ assignedAgentId: agentId })
      .where(eq(renewalComparisons.id, comparison.id));

    if (source === 'policy') fromPolicy++;
    else fromCustomer++;
  }

  console.log(`\nDone!`);
  console.log(`  From policy.producerId:  ${fromPolicy}`);
  console.log(`  From customer.producerId: ${fromCustomer}`);
  console.log(`  Skipped (no agent):       ${skipped}`);
}

main().catch(console.error).finally(() => process.exit(0));
