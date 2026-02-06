import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { getHawkSoftClient, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS } = await import('../src/lib/api/hawksoft');

  // Test with a known client number that has auto policies
  const clientNumber = process.argv[2] || '39577'; // Default test client

  console.log(`Fetching HawkSoft client ${clientNumber}...`);

  const api = getHawkSoftClient();
  const client = await api.getClient(
    parseInt(clientNumber),
    FULL_CLIENT_INCLUDES,
    FULL_CLIENT_EXPANDS
  );

  console.log('\n=== PEOPLE (household) ===');
  if (client.people?.length) {
    for (const person of client.people) {
      console.log(`  ${person.firstName} ${person.lastName}`);
      console.log(`    DOB: ${person.dateOfBirth}`);
      console.log(`    License #: ${person.licenseNumber || 'N/A'}`);
      console.log(`    License State: ${person.licenseState || 'N/A'}`);
      console.log(`    Gender: ${person.gender || 'N/A'}`);
      console.log(`    Marital: ${person.maritalStatus || 'N/A'}`);
    }
  } else {
    console.log('  No people data');
  }

  console.log('\n=== POLICIES ===');
  for (const policy of client.policies || []) {
    if (policy.drivers?.length) {
      console.log(`\nPolicy ${policy.policyNumber} (${policy.loBs?.[0]?.code || policy.lineOfBusiness})`);
      console.log('  Drivers:');
      for (const drv of policy.drivers) {
        console.log(`    ${drv.firstName} ${drv.lastName}`);
        console.log(`      DOB: ${drv.dateOfBirth || 'N/A'}`);
        console.log(`      License #: ${drv.licenseNumber || 'N/A'}`);
        console.log(`      License State: ${drv.licenseState || 'N/A'}`);
        console.log(`      Gender: ${drv.gender || 'N/A'}`);
        console.log(`      Marital: ${drv.maritalStatus || 'N/A'}`);
        console.log(`      Raw keys: ${Object.keys(drv).join(', ')}`);
      }
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
