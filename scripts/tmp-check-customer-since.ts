require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { riskMonitorPolicies } = await import('../src/db/schema');
  const { eq, sql, isNull, isNotNull } = await import('drizzle-orm');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    hasCustomerSince: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} is not null)::int`,
    missingCustomerSince: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} is null)::int`,
    hasEffectiveDate: sql<number>`count(*) filter (where ${riskMonitorPolicies.effectiveDate} is not null)::int`,
    missingEffectiveDate: sql<number>`count(*) filter (where ${riskMonitorPolicies.effectiveDate} is null)::int`,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  console.log('========================================');
  console.log('POLICY DATE FIELD COVERAGE');
  console.log('========================================');
  console.log(`Total policies: ${stats?.total}`);
  console.log(`customerSinceDate: ${stats?.hasCustomerSince} have it, ${stats?.missingCustomerSince} missing (${Math.round((stats?.missingCustomerSince || 0) / (stats?.total || 1) * 100)}%)`);
  console.log(`effectiveDate: ${stats?.hasEffectiveDate} have it, ${stats?.missingEffectiveDate} missing (${Math.round((stats?.missingEffectiveDate || 0) / (stats?.total || 1) * 100)}%)`);

  // Sample some with missing customerSinceDate
  const missing = await db.select({
    id: riskMonitorPolicies.id,
    contactName: riskMonitorPolicies.contactName,
    address: riskMonitorPolicies.addressLine1,
    effectiveDate: riskMonitorPolicies.effectiveDate,
    customerSinceDate: riskMonitorPolicies.customerSinceDate,
    currentStatus: riskMonitorPolicies.currentStatus,
  }).from(riskMonitorPolicies)
    .where(sql`${riskMonitorPolicies.tenantId} = ${tenantId} AND ${riskMonitorPolicies.customerSinceDate} IS NULL`)
    .limit(10);

  if (missing.length > 0) {
    console.log(`\nSample policies MISSING customerSinceDate:`);
    for (const p of missing) {
      console.log(`  ${p.contactName} | ${p.address} | effective: ${p.effectiveDate || 'null'} | status: ${p.currentStatus}`);
    }
  }

  // Check how many sold properties are being filtered by the customer-since check
  const [soldStats] = await db.select({
    totalSold: sql<number>`count(*) filter (where ${riskMonitorPolicies.currentStatus} = 'sold')::int`,
    soldWithCustomerSince: sql<number>`count(*) filter (where ${riskMonitorPolicies.currentStatus} = 'sold' and ${riskMonitorPolicies.customerSinceDate} is not null)::int`,
    soldMissingCustomerSince: sql<number>`count(*) filter (where ${riskMonitorPolicies.currentStatus} = 'sold' and ${riskMonitorPolicies.customerSinceDate} is null)::int`,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  console.log(`\n========================================`);
  console.log(`SOLD PROPERTIES SPECIFICALLY:`);
  console.log(`========================================`);
  console.log(`Total sold: ${soldStats?.totalSold}`);
  console.log(`With customerSinceDate: ${soldStats?.soldWithCustomerSince}`);
  console.log(`Missing customerSinceDate: ${soldStats?.soldMissingCustomerSince} (these would be FILTERED OUT by the sold alert check)`);

  // Also check tenure distribution for those that have it
  const [tenure] = await db.select({
    over12mo: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} < now() - interval '12 months')::int`,
    under12mo: sql<number>`count(*) filter (where ${riskMonitorPolicies.customerSinceDate} >= now() - interval '12 months')::int`,
  }).from(riskMonitorPolicies)
    .where(sql`${riskMonitorPolicies.tenantId} = ${tenantId} AND ${riskMonitorPolicies.customerSinceDate} IS NOT NULL`);

  console.log(`\nTENURE (of those with customerSinceDate):`);
  console.log(`  > 12 months (would pass filter): ${tenure?.over12mo}`);
  console.log(`  < 12 months (would be filtered): ${tenure?.under12mo}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
