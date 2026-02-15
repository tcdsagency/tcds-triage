require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');

  const azClient = getAgencyZoomClient();

  // Test posting to Dwight Bronson (AZ: 25399083)
  const azCustomerId = 25399083;
  const noteText = 'Test note from script - please ignore';

  console.log('Testing addNote to customer', azCustomerId);

  try {
    const result = await azClient.addNote(azCustomerId, noteText);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

run().catch(e => console.error(e));
