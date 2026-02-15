import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  // Get an auto policy candidate
  const candidates = await db.select().from(renewalCandidates)
    .where(eq(renewalCandidates.policyNumber, '955847785'));

  if (candidates.length === 0) {
    console.log('Candidate not found');
    process.exit(0);
  }

  const cand = candidates[0];
  const raw = cand.rawAl3Content || '';
  
  console.log('Policy:', cand.policyNumber, '-', cand.lineOfBusiness);
  console.log('');
  
  // Look for 6CVA records that might be discounts
  const lines = raw.split('\n');
  console.log('--- 6CVA records (looking for discount patterns) ---');
  
  let count = 0;
  for (const line of lines) {
    if (line.startsWith('6CVA')) {
      // Show the coverage code area (around position 50-60)
      const code = line.substring(48, 60).trim();
      const desc = line.substring(60, 100).trim();
      console.log('Code:', code, '| Desc:', desc);
      count++;
    }
  }
  console.log('Total 6CVA records:', count);
  
  console.log('');
  console.log('--- Looking for discount keywords ---');
  for (const line of lines) {
    if (/ACCFRE|HOMOWN|MULTIC|PAIDINF|PAPRLS|SAFDRV|AFR|EFT|HON|MC1|SMP|NP3|NP5|SD3|IPP/i.test(line)) {
      console.log(line.substring(0, 150));
    }
  }
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
