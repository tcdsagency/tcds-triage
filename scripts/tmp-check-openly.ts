import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const [c] = await db.select().from(renewalCandidates).where(eq(renewalCandidates.policyNumber, 'BQ01-AVMZJK'));
  if (!c) { console.log('Not found'); process.exit(0); }

  console.log('Policy:', c.policyNumber);
  console.log('Carrier:', c.carrierName);
  console.log('Raw length:', c.rawAl3Content?.length);
  console.log('');
  console.log('=== FULL RAW AL3 ===');
  console.log(c.rawAl3Content);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
