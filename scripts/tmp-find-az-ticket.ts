import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();
  const token = await (azClient as any).getToken();

  // Get a few recent tickets to find one NOT created by AI Agent
  const listResp = await fetch('https://api.agencyzoom.com/v1/api/serviceTicket/service-tickets/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ pageSize: 20, page: 0, sort: 'id', order: 'desc', status: '1' }),
  });
  const listData = await listResp.json();

  for (const t of (listData.serviceTickets || []).slice(0, 10)) {
    console.log(`AZ#${t.id} | by: ${t.createdBy} | HH: ${t.householdId} | ${t.subject?.slice(0, 60)}`);
  }

  // Try PUT on a non-AI-Agent ticket
  const nonAiTicket = (listData.serviceTickets || []).find((t: any) => t.createdBy !== 'AI Agent');
  if (nonAiTicket) {
    console.log(`\n--- PUT on non-AI ticket #${nonAiTicket.id} (by ${nonAiTicket.createdBy}) ---`);
    const resp = await fetch(`https://api.agencyzoom.com/v1/api/serviceTicket/service-tickets/${nonAiTicket.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ description: nonAiTicket.serviceDesc || 'test' }),
    });
    const text = await resp.text();
    console.log(`Status: ${resp.status} | ${text.slice(0, 200)}`);
  }

  // Also try PUT on the Dennis ticket using the .org domain with .com token
  console.log('\n--- PUT Dennis ticket on .org domain ---');
  const resp2 = await fetch(`https://api.agencyzoom.org/v1/api/serviceTicket/service-tickets/9271444`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ description: 'test' }),
  });
  const text2 = await resp2.text();
  console.log(`Status: ${resp2.status} | ${text2.slice(0, 200)}`);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
