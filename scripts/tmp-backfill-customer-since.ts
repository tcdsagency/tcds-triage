require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { customers, riskMonitorPolicies, policies } = await import('../src/db/schema');
  const { eq, and, sql, isNotNull } = await import('drizzle-orm');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // Get all risk monitor policies with their azContactId
  const rmPolicies = await db.select({
    id: riskMonitorPolicies.id,
    contactName: riskMonitorPolicies.contactName,
    azContactId: riskMonitorPolicies.azContactId,
    currentSince: riskMonitorPolicies.customerSinceDate,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  console.log(`Total risk monitor policies: ${rmPolicies.length}\n`);

  let updated = 0;
  let notFound = 0;
  let unchanged = 0;

  for (const rmp of rmPolicies) {
    // Find the customer by azContactId
    let customer;
    if (rmp.azContactId) {
      [customer] = await db.select({
        id: customers.id,
        createdAt: customers.createdAt,
      }).from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          eq(customers.agencyzoomId, rmp.azContactId)
        ))
        .limit(1);
    }

    if (!customer) {
      // Try name match
      const nameParts = (rmp.contactName || '').split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      if (firstName && lastName) {
        [customer] = await db.select({
          id: customers.id,
          createdAt: customers.createdAt,
        }).from(customers)
          .where(and(
            eq(customers.tenantId, tenantId),
            sql`lower(${customers.firstName}) = lower(${firstName})`,
            sql`lower(${customers.lastName}) = lower(${lastName})`
          ))
          .limit(1);
      }
    }

    if (!customer) {
      notFound++;
      continue;
    }

    // Get earliest policy inception date for this customer
    const [earliest] = await db.select({
      earliestInception: sql<string>`min(${policies.effectiveDate})`,
    }).from(policies)
      .where(eq(policies.customerId, customer.id));

    const customerSince = earliest?.earliestInception
      ? new Date(earliest.earliestInception)
      : customer.createdAt;

    if (!customerSince) {
      notFound++;
      continue;
    }

    // Check if it's actually different from current value
    const currentMs = rmp.currentSince?.getTime() || 0;
    const newMs = customerSince.getTime();
    if (Math.abs(currentMs - newMs) < 1000) {
      unchanged++;
      continue;
    }

    await db.update(riskMonitorPolicies)
      .set({ customerSinceDate: customerSince })
      .where(eq(riskMonitorPolicies.id, rmp.id));
    updated++;
  }

  console.log('========================================');
  console.log('BACKFILL RESULTS');
  console.log('========================================');
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Not found: ${notFound}`);

  // Verify tenure distribution after backfill
  const [tenure] = await db.select({
    over12mo: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} < now() - interval '12 months')::int`,
    under12mo: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} >= now() - interval '12 months')::int`,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  console.log(`\nTenure after backfill:`);
  console.log(`  > 12 months: ${tenure?.over12mo}`);
  console.log(`  < 12 months: ${tenure?.under12mo}`);

  // Check sold properties specifically
  const [soldTenure] = await db.select({
    total: sql<number>`count(*)::int`,
    over12mo: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} < now() - interval '12 months')::int`,
    under12mo: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} >= now() - interval '12 months')::int`,
  }).from(riskMonitorPolicies)
    .where(sql`${riskMonitorPolicies.tenantId} = ${tenantId} AND ${riskMonitorPolicies.currentStatus} = 'sold'`);

  console.log(`\nSold properties after backfill:`);
  console.log(`  Total: ${soldTenure?.total}`);
  console.log(`  > 12 months (would create alert): ${soldTenure?.over12mo}`);
  console.log(`  < 12 months (would be filtered): ${soldTenure?.under12mo}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
