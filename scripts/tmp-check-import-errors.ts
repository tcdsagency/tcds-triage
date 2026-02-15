import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { desc, eq } = await import('drizzle-orm');
  const { db } = await import('../src/db');
  const { commissionImportErrors, commissionImportBatches } = await import('../src/db/schema');

  const errors = await db.select().from(commissionImportErrors).orderBy(desc(commissionImportErrors.createdAt)).limit(5);
  console.log('Recent import errors:');
  for (const e of errors) {
    console.log('  Row:', e.rowNumber, 'Error:', e.errorMessage);
    console.log('  Raw row:', JSON.stringify(e.rawRow).substring(0, 500));
    console.log();
  }

  const batches = await db.select().from(commissionImportBatches).orderBy(desc(commissionImportBatches.createdAt)).limit(3);
  console.log('Recent batches:');
  for (const b of batches) {
    console.log('  ID:', b.id, 'Status:', b.status, 'Total:', b.totalRows, 'Imported:', b.importedRows, 'Errors:', b.errorRows);
    console.log('  Mapping ID:', b.fieldMappingId);
    console.log('  Raw data sample:', JSON.stringify((b.rawData as any[])?.[0]).substring(0, 300));
    console.log();
  }

  process.exit(0);
}
main();
