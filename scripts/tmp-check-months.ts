import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { commissionTransactions } = await import('../src/db/schema');
  const { eq, sql } = await import('drizzle-orm');
  const tenantId = process.env.DEFAULT_TENANT_ID!;

  const months = await db.select({
    month: commissionTransactions.reportingMonth,
    count: sql<number>`COUNT(*)::int`,
    total: sql<string>`COALESCE(SUM(CAST(${commissionTransactions.commissionAmount} AS DECIMAL(12,2))), 0)`,
  }).from(commissionTransactions)
    .where(eq(commissionTransactions.tenantId, tenantId))
    .groupBy(commissionTransactions.reportingMonth)
    .orderBy(commissionTransactions.reportingMonth);

  console.log('Reporting months in DB:');
  for (const m of months) {
    console.log(`  ${m.month}  txns=${String(m.count).padStart(5)}  total=$${parseFloat(m.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  }
  console.log(`\nTotal: ${months.reduce((s, m) => s + m.count, 0)} transactions`);

  process.exit(0);
}
main();
