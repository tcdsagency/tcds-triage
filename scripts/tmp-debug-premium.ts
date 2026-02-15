import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  // Check a Progressive policy
  const [c] = await db.select({
    rawAl3Content: renewalCandidates.rawAl3Content,
  })
  .from(renewalCandidates)
  .where(eq(renewalCandidates.policyNumber, '862267823'))
  .limit(1);

  if (!c?.rawAl3Content) {
    console.log('Not found');
    process.exit(0);
  }

  const lines = c.rawAl3Content.split(/\r?\n/);
  const bpiLines = lines.filter(l => l.startsWith('5BPI'));

  console.log('=== 5BPI Lines for Progressive ===\n');
  for (const line of bpiLines) {
    console.log('Length:', line.length);
    console.log('Line:', line.substring(0, 150));
    console.log('');

    // Check positions 98-120 (premium area)
    console.log('Positions 98-120:', JSON.stringify(line.substring(98, 120)));

    // Look for premium patterns
    const matches = line.match(/(\d{8,12})[+-]/g);
    console.log('Premium patterns found:', matches);
    console.log('---');
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
