require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const baseUrl = 'https://tcds-triage.vercel.app';
  console.log('Fetching profile...');
  const res = await fetch(`${baseUrl}/api/customers/97/merged-profile?hsId=97`);
  const data = await res.json();

  if (!data.success) {
    console.log('Error:', data.error);
    return;
  }

  const profile = data.profile;
  console.log('Customer:', profile.name);

  // Find the specific policy with good data
  const homePolicy = profile.policies?.find((p: any) => p.policyNumber === '7701HR044894');
  if (!homePolicy) {
    console.log('Policy 7701HR044894 not found');
    console.log('Available policies:', profile.policies?.map((p: any) => p.policyNumber + ' (' + p.type + ')').join(', '));
    return;
  }

  console.log('\n=== POLICY:', homePolicy.policyNumber, '===');
  console.log('Type:', homePolicy.type);
  console.log('Status:', homePolicy.status);
  console.log('Premium:', homePolicy.premium);

  console.log('\n=== PROPERTY ===');
  const prop = homePolicy.property;
  console.log(JSON.stringify(prop, null, 2));

  console.log('\n=== COVERAGES ===');
  for (const cov of (homePolicy.coverages || []).slice(0, 12)) {
    if (cov.limit || cov.deductible) {
      console.log(`  ${cov.type}: limit=${cov.limit} ded=${cov.deductible}`);
    }
  }

  // Test Gaya transform
  const { transformProfileToGayaEntities } = await import('../src/lib/transformers/profile-to-gaya');
  const filteredProfile = { ...profile, policies: [homePolicy] };
  const result = transformProfileToGayaEntities(filteredProfile);

  console.log('\n=== GAYA PROPERTY ENTITY ===');
  const propEntity = result.entities.find(e => e.entity === 'property');
  if (propEntity) {
    for (const field of propEntity.fields) {
      console.log(`  ${field.name}: ${field.value}`);
    }
  }
}

run().catch(e => console.error(e));
