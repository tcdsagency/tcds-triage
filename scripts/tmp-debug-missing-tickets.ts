import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();

  const ticketIds = [9271712, 9271256, 9270933, 9270919, 9270664, 9269907, 9269462];

  // Try fetching all at once
  console.log('Fetching all missing tickets at once...');
  const result = await azClient.getServiceTickets({ serviceTicketIds: ticketIds, limit: 50 });
  console.log(`Returned: ${result.total} total, ${result.data.length} in data`);

  for (const t of result.data) {
    console.log(`  Found: #${(t as any).id} - ${(t as any).subject?.substring(0, 60)}`);
  }

  // Try fetching individually
  console.log('\nFetching individually...');
  for (const id of ticketIds) {
    try {
      const r = await azClient.getServiceTickets({ serviceTicketIds: [id] });
      if (r.data.length > 0) {
        const t = r.data[0] as any;
        console.log(`  #${id}: FOUND - "${t.subject?.substring(0, 50)}" | status: ${t.status}/${t.statusDesc}`);
      } else {
        console.log(`  #${id}: NOT FOUND (0 results)`);
      }
    } catch (err) {
      console.log(`  #${id}: ERROR - ${err}`);
    }
  }

  // Try without status filter - maybe they're completed/closed
  console.log('\nFetching with status=0 (inactive)...');
  const token = await (azClient as any).getToken();
  for (const id of ticketIds.slice(0, 3)) {
    const resp = await fetch('https://api.agencyzoom.com/v1/api/serviceTicket/service-tickets/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ serviceTicketIds: [id], pageSize: 5, page: 0, sort: 'id', order: 'desc' }),
    });
    const data = await resp.json();
    console.log(`  #${id}: ${data.totalCount || 0} results`);
    if (data.serviceTickets?.[0]) {
      const t = data.serviceTickets[0];
      console.log(`    Status: ${t.status}/${t.statusDesc} | Subject: ${t.subject?.substring(0, 50)}`);
    }
  }

  // Also try status filter explicitly
  console.log('\nFetching with status=2 (completed)...');
  for (const id of ticketIds.slice(0, 3)) {
    const resp = await fetch('https://api.agencyzoom.com/v1/api/serviceTicket/service-tickets/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ serviceTicketIds: [id], status: '2', pageSize: 5, page: 0, sort: 'id', order: 'desc' }),
    });
    const data = await resp.json();
    console.log(`  #${id}: ${data.totalCount || 0} results`);
    if (data.serviceTickets?.[0]) {
      const t = data.serviceTickets[0];
      console.log(`    Status: ${t.status}/${t.statusDesc} | Subject: ${t.subject?.substring(0, 50)}`);
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
