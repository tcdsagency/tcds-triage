require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { getHawkSoftClient, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS } = await import('../src/lib/api/hawksoft');
  const api = getHawkSoftClient();
  const client = await api.getClient(97, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS);

  console.log('Policies:', client.policies?.length);

  for (const p of client.policies || []) {
    console.log(`\nPolicy ${p.policyId}: ${p.policyNumber} (${p.loBs?.[0]?.code || 'Unknown'})`);

    if (p.locations?.length) {
      console.log('  Locations:');
      for (const loc of p.locations) {
        console.log(`    yearBuilt: ${loc.yearBuilt}`);
        console.log(`    sqFt: ${loc.squareFeet}`);
        console.log(`    roofType: ${loc.roofType}`);
        console.log(`    roofAge: ${loc.roofAge}`);
        console.log(`    construction: ${loc.constructionType}`);
        console.log(`    protClass: ${loc.protectionClass}`);
        console.log(`    pool: ${loc.pool || loc.hasPool}`);
        console.log(`    keys: ${Object.keys(loc).slice(0,15).join(',')}`);
      }
    }

    if (p.coverages?.length) {
      console.log('  Coverages:');
      for (const c of p.coverages.slice(0, 10)) {
        console.log(`    ${c.code || c.description}: limit=${c.limits} ded=${c.deductibles}`);
      }
      if (p.coverages.length > 10) console.log(`    ... and ${p.coverages.length - 10} more`);
    }
  }
}

run().catch(e => console.error(e));
