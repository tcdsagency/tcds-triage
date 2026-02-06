require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { wrapupDrafts } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const [wrapup] = await db.select().from(wrapupDrafts)
    .where(eq(wrapupDrafts.id, '15429c49-2791-47ef-b120-3b5adbc197ed'));

  if (!wrapup) {
    console.log('Wrapup not found');
    return;
  }

  console.log('=== EXTRACTED DATA ===');
  console.log(JSON.stringify(wrapup.extractedData, null, 2));

  console.log('\n=== KEY FIELDS ===');
  const extracted = wrapup.extractedData as any;
  console.log('Customer Name:', extracted?.customerName);
  console.log('Phone:', extracted?.phone);
  console.log('Policy Number:', extracted?.policyNumber);
}

run().catch(e => console.error(e));
