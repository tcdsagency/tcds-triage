require('dotenv').config({ path: '.env.production.local' });

async function run() {
  // Fetch merged profile for client 97
  const baseUrl = 'https://tcds-triage.vercel.app';
  console.log('Fetching profile...');
  const res = await fetch(`${baseUrl}/api/customers/97/merged-profile?hsId=97`);
  const data = await res.json();

  if (!data.success) {
    console.log('Error:', data.error);
    return;
  }

  const profile = data.profile;
  console.log('=== CUSTOMER ===');
  console.log('Name:', profile.name);
  console.log('Email:', profile.contact?.email);

  // Find a home policy
  const homePolicy = profile.policies?.find((p: any) => p.type === 'home');
  if (homePolicy) {
    console.log('\n=== HOME POLICY ===');
    console.log('Policy #:', homePolicy.policyNumber);

    console.log('\n=== PROPERTY DATA ===');
    const prop = homePolicy.property;
    if (prop) {
      console.log('Year Built:', prop.yearBuilt || 'N/A');
      console.log('Sq Ft:', prop.squareFeet || 'N/A');
      console.log('Stories:', prop.stories || 'N/A');
      console.log('Construction:', prop.constructionType || 'N/A');
      console.log('Roof Type:', prop.roofType || 'N/A');
      console.log('Roof Year:', prop.roofAge || 'N/A');
      console.log('Pool:', prop.poolPresent);
    }

    console.log('\n=== COVERAGES (first 8) ===');
    for (const cov of (homePolicy.coverages || []).slice(0, 8)) {
      console.log(`  ${cov.type}: limit=${cov.limit || 'N/A'} ded=${cov.deductible || 'N/A'}`);
    }
  }

  // Test Gaya transform
  const { transformProfileToGayaEntities } = await import('../src/lib/transformers/profile-to-gaya');
  const filteredProfile = { ...profile, policies: homePolicy ? [homePolicy] : [] };
  const result = transformProfileToGayaEntities(filteredProfile);

  console.log('\n=== GAYA ENTITIES ===');
  console.log('Total:', result.entityCount);

  for (const entity of result.entities) {
    console.log(`\n[${entity.entity} #${entity.index}]`);
    for (const field of entity.fields) {
      console.log(`  ${field.name}: ${field.value}`);
    }
  }
}

run().catch(e => console.error(e));
