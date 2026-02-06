import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, renewalComparisons, renewalNotes } = await import('../src/db/schema');

  console.log('Clearing renewal data...');

  try {
    await db.delete(renewalNotes);
    console.log('  Deleted renewal notes');
  } catch (e) {
    console.log('  No renewal_notes table or already empty');
  }

  await db.delete(renewalComparisons);
  console.log('  Deleted renewal comparisons');

  await db.delete(renewalCandidates);
  console.log('  Deleted renewal candidates');

  console.log('Done - renewal data cleared');
  process.exit(0);
}

run().catch(err => { console.error('Error:', err); process.exit(1); });
