import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();
  const token = await (azClient as any).getToken();

  // Check for tags API endpoint
  const endpoints = [
    '/v1/api/serviceTicket/tags',
    '/v1/api/tags',
    '/v1/api/serviceTicket/service-tickets/tags',
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(`https://api.agencyzoom.com${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const text = await resp.text();
      console.log(`${ep}: ${resp.status} | ${text.substring(0, 300)}`);
    } catch (e) {
      console.log(`${ep}: error`);
    }
  }

  // Also check a ticket with tags to see the format
  const result = await azClient.getServiceTickets({ limit: 50 });
  for (const ticket of result.data) {
    const t = ticket as any;
    if (t.tags || t.tagIds || t.tagNames) {
      console.log(`\nTicket #${t.id} has tags:`, JSON.stringify({ tags: t.tags, tagIds: t.tagIds, tagNames: t.tagNames }));
    }
  }

  // Dump all fields from one ticket to see tag-related fields
  const sample = result.data[0] as any;
  const tagFields = Object.entries(sample).filter(([k]) => k.toLowerCase().includes('tag'));
  console.log('\nTag-related fields on ticket:', tagFields);

  // Check all field names
  console.log('\nAll fields:', Object.keys(sample).sort().join(', '));

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
