import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { commissionTransactions, commissionImportErrors, commissionImportBatches, commissionFieldMappings } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const tenantId = process.env.DEFAULT_TENANT_ID!;

  await db.delete(commissionTransactions).where(eq(commissionTransactions.tenantId, tenantId));
  console.log('Cleared transactions');
  await db.delete(commissionImportErrors).where(eq(commissionImportErrors.tenantId, tenantId));
  console.log('Cleared import errors');
  await db.delete(commissionImportBatches).where(eq(commissionImportBatches.tenantId, tenantId));
  console.log('Cleared batches');
  await db.delete(commissionFieldMappings).where(eq(commissionFieldMappings.tenantId, tenantId));
  console.log('Cleared field mappings');
  console.log('\nAll commission data cleared.');
  process.exit(0);
}
main();
