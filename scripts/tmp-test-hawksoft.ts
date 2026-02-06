import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { getHawkSoftClient, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS } = await import('../src/lib/api/hawksoft');

  const clientNumber = process.argv[2] || '97';
  const policyIdFilter = process.argv[3] || '19';

  console.log(`Fetching HawkSoft client ${clientNumber}...`);

  const api = getHawkSoftClient();
  const client = await api.getClient(
    parseInt(clientNumber),
    FULL_CLIENT_INCLUDES,
    FULL_CLIENT_EXPANDS
  );

  console.log('\n=== CLIENT ===');
  console.log(`Name: ${client.firstName} ${client.lastName}`);
  console.log(`Email: ${client.email}`);
  console.log(`Phone: ${client.phone}`);

  console.log('\n=== PEOPLE (for driver license data) ===');
  if (client.people?.length) {
    for (const p of client.people) {
      console.log(`  ${p.firstName} ${p.lastName}`);
      console.log(`    DOB: ${p.dateOfBirth || 'N/A'}`);
      console.log(`    License #: ${p.licenseNumber || 'N/A'}`);
      console.log(`    License State: ${p.licenseState || 'N/A'}`);
      console.log(`    Gender: ${p.gender || 'N/A'}`);
    }
  } else {
    console.log('  No people data');
  }

  console.log('\n=== POLICIES ===');
  for (const policy of client.policies || []) {
    // Filter to specific policy if requested
    if (policyIdFilter && String(policy.policyId) !== policyIdFilter) continue;

    console.log(`\nPolicy ${policy.policyNumber} (ID: ${policy.policyId})`);
    console.log(`  LOB: ${policy.loBs?.[0]?.code || policy.lineOfBusiness || 'Unknown'}`);
    console.log(`  Carrier: ${policy.carrier?.name || policy.carrier || 'Unknown'}`);
    console.log(`  Premium: $${policy.annualPremium || policy.premium || 0}`);
    console.log(`  Status: ${policy.status}`);

    // Drivers
    if (policy.drivers?.length) {
      console.log('\n  DRIVERS:');
      for (const d of policy.drivers) {
        console.log(`    ${d.firstName} ${d.lastName}`);
        console.log(`      License #: ${d.licenseNumber || 'N/A'}`);
        console.log(`      License State: ${d.licenseState || 'N/A'}`);
        console.log(`      DOB: ${d.dateOfBirth || 'N/A'}`);
        console.log(`      Raw keys: ${Object.keys(d).join(', ')}`);
      }
    }

    // Vehicles
    if (policy.autos?.length) {
      console.log('\n  VEHICLES:');
      for (const v of policy.autos) {
        console.log(`    ${v.year} ${v.make} ${v.model}`);
        console.log(`      VIN: ${v.vin || 'N/A'}`);
        console.log(`      Annual Miles: ${v.annualMiles || 'N/A'}`);
      }
    }

    // Locations (property)
    if (policy.locations?.length) {
      console.log('\n  LOCATIONS/PROPERTY:');
      for (const loc of policy.locations) {
        console.log(`    Address: ${loc.address1 || loc.street} ${loc.city}, ${loc.state} ${loc.zip}`);
        console.log(`      Year Built: ${loc.yearBuilt || 'N/A'}`);
        console.log(`      Sq Ft: ${loc.squareFeet || 'N/A'}`);
        console.log(`      Stories: ${loc.stories || 'N/A'}`);
        console.log(`      Construction: ${loc.constructionType || 'N/A'}`);
        console.log(`      Roof Type: ${loc.roofType || 'N/A'}`);
        console.log(`      Roof Age: ${loc.roofAge || 'N/A'}`);
        console.log(`      Protection Class: ${loc.protectionClass || 'N/A'}`);
        console.log(`      Heating: ${loc.heatingType || 'N/A'}`);
        console.log(`      Pool: ${loc.pool ?? loc.hasPool ?? 'N/A'}`);
        console.log(`      Raw keys: ${Object.keys(loc).join(', ')}`);
      }
    }

    // Coverages
    if (policy.coverages?.length) {
      console.log('\n  COVERAGES:');
      for (const cov of policy.coverages) {
        const desc = cov.description || cov.code || 'Unknown';
        console.log(`    ${desc}`);
        if (cov.limits) console.log(`      Limit: ${cov.limits}`);
        if (cov.deductibles) console.log(`      Deductible: ${cov.deductibles}`);
        if (cov.premium) console.log(`      Premium: $${cov.premium}`);
      }
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
