import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';

async function main() {
  try {
    // Dynamic import after env is set
    const { parseCSV } = await import('../src/lib/commissions/csv-parser');
    const { db } = await import('../src/db');
    const { commissionImportBatches } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');

    const csvPath = 'C:\\Users\\ToddConn\\Downloads\\Export-02_07_2026.csv';
    const csvText = fs.readFileSync(csvPath, 'utf-8');

    console.log('=== Step 1: Parse CSV ===');
    const { headers, records } = parseCSV(csvText);
    console.log('Headers:', headers);
    console.log('Records count:', records.length);
    if (records.length > 0) {
      console.log('First record keys:', Object.keys(records[0]));
      console.log('First record:', JSON.stringify(records[0], null, 2));
    }

    console.log('\n=== Step 2: Insert into DB ===');
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      console.error('ERROR: DEFAULT_TENANT_ID not set');
      process.exit(1);
    }

    console.log('Tenant ID:', tenantId);

    const [batch] = await db
      .insert(commissionImportBatches)
      .values({
        tenantId,
        fileName: 'test-import.csv',
        status: 'parsing',
        carrierId: null,
        rawData: records,
        parsedHeaders: headers,
        totalRows: records.length,
        startedAt: new Date(),
      })
      .returning();

    console.log('Batch created:', batch.id);
    console.log('Batch status:', batch.status);
    console.log('Parsed headers from DB:', batch.parsedHeaders);

    // Clean up
    await db.delete(commissionImportBatches).where(eq(commissionImportBatches.id, batch.id));
    console.log('Test batch cleaned up');

    console.log('\n=== SUCCESS ===');
  } catch (err) {
    console.error('ERROR:', err);
  }
  process.exit(0);
}

main();
