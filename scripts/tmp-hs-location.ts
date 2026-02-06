require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { getHawkSoftClient, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS } = await import('../src/lib/api/hawksoft');
  const api = getHawkSoftClient();
  const client = await api.getClient(97, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS);

  // Find home policy
  const homePolicy = client.policies?.find(p => p.loBs?.[0]?.code === 'HOME' || p.loBs?.[0]?.code === 'DFIRE');

  if (!homePolicy) {
    console.log('No home policy found');
    return;
  }

  console.log('Policy:', homePolicy.policyNumber);
  console.log('\n=== RAW LOCATION OBJECT ===');
  const loc = homePolicy.locations?.[0];
  if (loc) {
    console.log(JSON.stringify(loc, null, 2));
  }
}

run().catch(e => console.error(e));
