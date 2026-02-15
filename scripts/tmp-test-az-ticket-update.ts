import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();

  const ticketId = 9271444;

  // Test 1: Try GET service ticket
  console.log('--- Test 1: GET service ticket ---');
  try {
    const ticket = await azClient.getServiceTicket(ticketId);
    console.log('Success! Ticket:', JSON.stringify(ticket, null, 2).slice(0, 500));
  } catch (err: any) {
    console.log('Failed:', err.message?.slice(0, 200));
  }

  // Test 2: Try PUT update with description
  console.log('\n--- Test 2: PUT update description ---');
  try {
    const result = await azClient.updateServiceTicket(ticketId, {
      description: 'Test append - quote intake details here',
    });
    console.log('Success! Result:', result);
  } catch (err: any) {
    console.log('Failed:', err.message?.slice(0, 200));
  }

  // Test 3: Try listing tickets to find it
  console.log('\n--- Test 3: Search tickets list ---');
  try {
    const result = await azClient.getServiceTickets({ searchText: 'Dennis', limit: 5 });
    console.log(`Found ${result.data?.length || 0} tickets`);
    for (const t of (result.data || []).slice(0, 3)) {
      console.log(`  #${(t as any).id}: ${(t as any).subject?.slice(0, 80)}`);
    }
  } catch (err: any) {
    console.log('Failed:', err.message?.slice(0, 200));
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
