require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { riskMonitorPolicies } = await import('../src/db/schema');
  const { eq, sql } = await import('drizzle-orm');
  const { rprClient } = await import('../src/lib/rpr');
  const { mmiClient } = await import('../src/lib/mmi');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // Get several properties to test with
  const policies = await db.select({
    id: riskMonitorPolicies.id,
    address: riskMonitorPolicies.addressLine1,
    city: riskMonitorPolicies.city,
    state: riskMonitorPolicies.state,
    zip: riskMonitorPolicies.zipCode,
    contactName: riskMonitorPolicies.contactName,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId))
    .limit(10);

  console.log(`Found ${policies.length} policies to test with\n`);

  let rprOk = false;
  let mmiOk = false;

  for (const policy of policies) {
    const addr = `${policy.address}, ${policy.city}, ${policy.state} ${policy.zip}`;
    console.log(`Testing: ${addr} (${policy.contactName})`);

    if (!rprOk) {
      try {
        const rprResult = await rprClient.lookupProperty(addr);
        if (rprResult) {
          console.log(`  RPR: LIVE - status=${rprResult.currentStatus}, owner=${rprResult.ownerName}, value=$${rprResult.estimatedValue?.toLocaleString()}`);
          rprOk = true;
        } else {
          console.log(`  RPR: no data for this address`);
        }
      } catch (err: any) {
        console.log(`  RPR: error - ${err.message}`);
      }
    }

    if (!mmiOk) {
      try {
        const mmiResult = await mmiClient.lookupByAddress(addr);
        if (mmiResult.success && mmiResult.data) {
          console.log(`  MMI: LIVE - status=${mmiResult.data.currentStatus}, listings=${mmiResult.data.listingHistory.length}, deeds=${mmiResult.data.deedHistory.length}`);
          mmiOk = true;
        } else {
          console.log(`  MMI: no data for this address - ${mmiResult.error}`);
        }
      } catch (err: any) {
        console.log(`  MMI: error - ${err.message}`);
      }
    }

    if (rprOk && mmiOk) break;
    console.log('');
  }

  console.log('\n========================================');
  console.log(`RPR: ${rprOk ? 'LIVE' : 'NOT CONFIRMED'}`);
  console.log(`MMI: ${mmiOk ? 'LIVE' : 'NOT CONFIRMED'}`);
  console.log('========================================');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
