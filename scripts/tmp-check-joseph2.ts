import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalCandidates, customers, policies } = await import('../src/db/schema');
  const { desc, eq, like, ilike } = await import('drizzle-orm');

  // 1. Find all customers with "Joseph" in their name
  console.log('=== Customers with "Joseph" ===');
  const josephCustomers = await db.select({
    id: customers.id,
    firstName: customers.firstName,
    lastName: customers.lastName,
  }).from(customers)
    .where(ilike(customers.firstName, '%joseph%'));
  
  for (const c of josephCustomers) {
    console.log(`  ID: ${c.id.substring(0,8)} | ${c.firstName} ${c.lastName}`);
    
    // Check their policies
    const pols = await db.select({
      id: policies.id,
      policyNumber: policies.policyNumber,
      carrier: policies.carrier,
      lineOfBusiness: policies.lineOfBusiness,
      status: policies.status,
    }).from(policies).where(eq(policies.customerId, c.id));
    
    for (const p of pols) {
      console.log(`    Policy: ${p.policyNumber} | ${p.carrier} | ${p.lineOfBusiness} | status: ${p.status}`);
    }
  }

  // 2. Find all candidates that reference Joseph customers  
  console.log('\n=== Renewal Candidates linked to Joseph ===');
  const allCandidates = await db.select({
    id: renewalCandidates.id,
    policyNumber: renewalCandidates.policyNumber,
    carrierName: renewalCandidates.carrierName,
    lineOfBusiness: renewalCandidates.lineOfBusiness,
    customerId: renewalCandidates.customerId,
    policyId: renewalCandidates.policyId,
    status: renewalCandidates.status,
    baselineSnapshot: renewalCandidates.baselineSnapshot,
  }).from(renewalCandidates)
    .orderBy(desc(renewalCandidates.createdAt))
    .limit(30);

  for (const cand of allCandidates) {
    if (!cand.customerId) continue;
    const [cust] = await db.select({
      firstName: customers.firstName,
      lastName: customers.lastName,
    }).from(customers).where(eq(customers.id, cand.customerId)).limit(1);
    
    if (cust && cust.firstName?.toLowerCase().includes('joseph')) {
      const hasBaseline = cand.baselineSnapshot ? 'YES' : 'NO';
      const hasPolicyId = cand.policyId ? cand.policyId.substring(0,8) : 'NULL';
      console.log(`  Candidate: ${cand.policyNumber} | ${cand.carrierName} | ${cand.lineOfBusiness}`);
      console.log(`    Customer: ${cust.firstName} ${cust.lastName}`);
      console.log(`    PolicyId: ${hasPolicyId} | HasBaseline: ${hasBaseline} | Status: ${cand.status}`);
    }
  }

  // 3. Check if policy number 992887537 exists in policies table
  console.log('\n=== Direct policy lookup: 992887537 ===');
  const directMatch = await db.select({
    id: policies.id,
    policyNumber: policies.policyNumber,
    carrier: policies.carrier,
    customerId: policies.customerId,
    status: policies.status,
    coverages: policies.coverages,
    premium: policies.premium,
  }).from(policies).where(eq(policies.policyNumber, '992887537'));
  
  if (directMatch.length === 0) {
    console.log('  NOT FOUND in policies table!');
    
    // Try partial match
    const partials = await db.select({
      policyNumber: policies.policyNumber,
      carrier: policies.carrier,
    }).from(policies).where(like(policies.policyNumber, '%99288%'));
    console.log(`  Partial matches for "99288": ${partials.length}`);
    for (const p of partials) {
      console.log(`    ${p.policyNumber} | ${p.carrier}`);
    }
  } else {
    for (const p of directMatch) {
      const covCount = Array.isArray(p.coverages) ? p.coverages.length : 0;
      console.log(`  Found: ${p.policyNumber} | ${p.carrier} | status: ${p.status} | covs: ${covCount} | premium: ${p.premium}`);
    }
  }

  // 4. Also check - are there candidates with customerId set but no policyId?
  console.log('\n=== All candidates: customerId vs policyId ===');
  for (const cand of allCandidates) {
    let custName = 'none';
    if (cand.customerId) {
      const [c] = await db.select({ firstName: customers.firstName, lastName: customers.lastName }).from(customers).where(eq(customers.id, cand.customerId)).limit(1);
      if (c) custName = `${c.firstName} ${c.lastName}`;
    }
    const hasBaseline = cand.baselineSnapshot ? 'HAS BASELINE' : 'NO BASELINE';
    console.log(`  ${(cand.policyNumber || '[blank]').padEnd(20)} | customer: ${custName.padEnd(25)} | policyId: ${cand.policyId ? 'YES' : 'NULL'} | ${hasBaseline}`);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
