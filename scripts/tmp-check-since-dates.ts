require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { riskMonitorPolicies } = await import('../src/db/schema');
  const { eq, sql, desc } = await import('drizzle-orm');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // Check the actual customerSinceDate values
  const samples = await db.select({
    contactName: riskMonitorPolicies.contactName,
    address: riskMonitorPolicies.addressLine1,
    customerSinceDate: riskMonitorPolicies.customerSinceDate,
    currentStatus: riskMonitorPolicies.currentStatus,
    createdAt: riskMonitorPolicies.createdAt,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId))
    .orderBy(desc(riskMonitorPolicies.customerSinceDate))
    .limit(15);

  console.log('Most recent customerSinceDate values:');
  for (const p of samples) {
    console.log(`  ${p.customerSinceDate?.toISOString().slice(0, 10)} | created: ${p.createdAt?.toISOString().slice(0, 10)} | ${p.currentStatus?.padEnd(10)} | ${p.contactName} | ${p.address}`);
  }

  // Check sold properties specifically
  const sold = await db.select({
    contactName: riskMonitorPolicies.contactName,
    address: riskMonitorPolicies.addressLine1,
    customerSinceDate: riskMonitorPolicies.customerSinceDate,
    currentStatus: riskMonitorPolicies.currentStatus,
    lastSaleDate: riskMonitorPolicies.lastSaleDate,
    lastSalePrice: riskMonitorPolicies.lastSalePrice,
  }).from(riskMonitorPolicies)
    .where(sql`${riskMonitorPolicies.tenantId} = ${tenantId} AND ${riskMonitorPolicies.currentStatus} = 'sold'`)
    .limit(15);

  console.log(`\nSold properties (${sold.length}):`);
  for (const p of sold) {
    console.log(`  since: ${p.customerSinceDate?.toISOString().slice(0, 10)} | sold: ${p.lastSaleDate?.toISOString().slice(0, 10) || 'null'} | $${p.lastSalePrice?.toLocaleString() || '?'} | ${p.contactName} | ${p.address}`);
  }

  // Distribution of customerSinceDate
  const [dist] = await db.select({
    min: sql<string>`min(${riskMonitorPolicies.customerSinceDate})::text`,
    max: sql<string>`max(${riskMonitorPolicies.customerSinceDate})::text`,
    distinctCount: sql<number>`count(distinct ${riskMonitorPolicies.customerSinceDate}::date)::int`,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  console.log(`\nDate range: ${dist?.min} to ${dist?.max} (${dist?.distinctCount} distinct dates)`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
