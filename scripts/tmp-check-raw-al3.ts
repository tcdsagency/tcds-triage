import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  // Get the watercraft policy candidate
  const candidates = await db.select().from(renewalCandidates)
    .where(eq(renewalCandidates.policyNumber, '994572297'));

  if (candidates.length === 0) {
    console.log('Candidate not found');
    process.exit(0);
  }

  const cand = candidates[0];
  const raw = cand.rawAl3Content || '';
  
  console.log('Policy:', cand.policyNumber);
  console.log('Raw AL3 length:', raw.length);
  console.log('');
  
  // Look for discount-related records
  const lines = raw.split('\n');
  console.log('--- Looking for discount patterns ---');
  
  for (const line of lines) {
    // Look for 6DIS, 6DSC, or lines containing discount keywords
    if (line.includes('6DIS') || line.includes('6DSC') || 
        /discount/i.test(line) || /ACCFRE|HOMOWN|MULCAR|PAIDINF|PAPRLS|SAFDRI/i.test(line)) {
      console.log(line.substring(0, 120));
    }
  }
  
  console.log('');
  console.log('--- All 6-level record types found ---');
  const recordTypes = new Set();
  for (const line of lines) {
    const match = line.match(/^(\d[A-Z]{3})/);
    if (match) {
      recordTypes.add(match[1]);
    }
  }
  console.log(Array.from(recordTypes).sort().join(', '));
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
