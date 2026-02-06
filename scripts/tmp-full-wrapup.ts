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

  console.log('=== ALL WRAPUP FIELDS ===');
  for (const [key, value] of Object.entries(wrapup)) {
    if (value !== null && value !== undefined) {
      const display = typeof value === 'object'
        ? JSON.stringify(value).slice(0, 200)
        : String(value).slice(0, 200);
      console.log(`${key}: ${display}`);
    }
  }
}

run().catch(e => console.error(e));
