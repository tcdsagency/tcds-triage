import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const [c] = await db.select().from(renewalCandidates).where(eq(renewalCandidates.policyNumber, 'BQ01-AVMZJK'));
  const raw = c?.rawAl3Content || '';

  // Check for dwelling in 5BPI (business purpose info) which often has the total premium and dwelling
  const lines = raw.split(/\r?\n/);
  const bpiLine = lines.find(l => l.startsWith('5BPI'));
  if (bpiLine) {
    console.log('5BPI line (has premium/policy data):');
    console.log('  Length:', bpiLine.length);

    // Look for large numbers (potential dwelling values)
    const nums = [...bpiLine.matchAll(/(\d{6,})/g)];
    console.log('  Large numbers found:', nums.map(m => ({ pos: m.index, val: m[1] })).slice(0, 10));
  }

  // Check 5IIG record (insured interest group) - may have dwelling
  const iigLine = lines.find(l => l.startsWith('5IIG'));
  if (iigLine) {
    console.log('\n5IIG line (insured interest):');
    console.log('  Content:', iigLine.substring(30, 100));
    const nums = [...iigLine.matchAll(/(\d{5,})/g)];
    console.log('  Numbers:', nums.map(m => ({ pos: m.index, val: m[1] })));
  }

  // Check 5REP record (replacement cost) - definitely has dwelling
  const repLine = lines.find(l => l.startsWith('5REP'));
  if (repLine) {
    console.log('\n5REP line (replacement cost):');
    console.log('  Content:', repLine.substring(30, 150));
    const nums = [...repLine.matchAll(/(\d{5,})/g)];
    console.log('  Numbers:', nums.map(m => ({ pos: m.index, val: m[1] })));
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
