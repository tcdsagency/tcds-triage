import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, customers } = await import('../src/db/schema');
  const { desc, eq, like, sql, isNotNull } = await import('drizzle-orm');

  // Get all recent candidates with their customer info
  const candidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    lineOfBusiness: renewalCandidates.lineOfBusiness,
    customerId: renewalCandidates.customerId,
    status: renewalCandidates.status,
    rawAl3Content: renewalCandidates.rawAl3Content,
    renewalSnapshot: renewalCandidates.renewalSnapshot,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(30);

  console.log(`Total candidates: ${candidates.length}\n`);

  // For each candidate, look up the customer name
  for (const c of candidates) {
    let customerName = 'NO CUSTOMER';
    if (c.customerId) {
      const [cust] = await db.select({
        firstName: customers.firstName,
        lastName: customers.lastName,
      }).from(customers).where(eq(customers.id, c.customerId)).limit(1);
      if (cust) {
        customerName = `${cust.firstName} ${cust.lastName}`;
      }
    }

    // Try to get insured name from renewal snapshot
    const snapshot = c.renewalSnapshot as any;
    const insuredName = snapshot?.insuredName || snapshot?.namedInsured || '[none]';
    
    const isJoseph = customerName.toUpperCase().includes('JOSEPH');
    const marker = isJoseph ? ' <<<< JOSEPH' : '';
    console.log(`${(c.policyNumber || '[blank]').padEnd(20)} | ${(c.carrierName || '').padEnd(25)} | ${(c.lineOfBusiness || '-').padEnd(15)} | insured: ${String(insuredName).padEnd(30)} | customer: ${customerName}${marker}`);
    
    // For JOSEPH ones, show raw AL3 clues
    if (isJoseph && c.rawAl3Content) {
      const lines = c.rawAl3Content.split('\n');
      // Show 2TRG and 5NAM lines
      for (const line of lines) {
        const gc = line.substring(0, 4).trim();
        if (gc === '2TRG' || gc === '5NAM' || gc === '5BPI' || gc === '2TCG') {
          const clean = line.substring(0, 200).replace(/[\x00-\x1f\x80-\xff]/g, '?');
          console.log(`    ${gc}: ${clean}`);
        }
      }
      console.log('');
    }
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
