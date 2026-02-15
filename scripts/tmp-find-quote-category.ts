import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();
  const token = await (azClient as any).getToken();

  // Search for tickets with "quote" in the subject to find what category they use
  const result = await azClient.getServiceTickets({ fullName: '', limit: 50 });

  // Collect all unique categoryId + categoryName combos
  const cats = new Map<number, string>();
  for (const t of result.data) {
    const ticket = t as any;
    if (ticket.categoryId) {
      cats.set(ticket.categoryId, ticket.categoryName || 'unknown');
    }
  }

  console.log('All categories found on recent tickets:');
  for (const [id, name] of [...cats].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${id}: ${name}`);
  }

  // Also try to list all categories via the AZ API
  // Try fetching from settings/metadata endpoints
  const settingsEndpoints = [
    '/v1/api/serviceTicket/settings',
    '/v1/api/settings/service-ticket',
    '/v1/api/settings',
    '/v1/api/metadata/categories',
    '/v1/api/serviceTicket/metadata',
  ];

  for (const ep of settingsEndpoints) {
    try {
      const resp = await fetch(`https://api.agencyzoom.com${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.status === 200) {
        const text = await resp.text();
        console.log(`\n${ep}: 200`);
        console.log(text.substring(0, 800));
      }
    } catch (e) {}
  }

  // Try creating a ticket with a "New Quote Request" category to see if AZ has it
  // Actually let's just search for "quote" tickets
  const quoteTickets = result.data.filter((t: any) =>
    t.subject?.toLowerCase().includes('quote') ||
    t.categoryName?.toLowerCase().includes('quote')
  );

  console.log('\nTickets with "quote" in subject or category:');
  for (const t of quoteTickets) {
    const ticket = t as any;
    console.log(`  #${ticket.id}: "${ticket.subject}" | cat: ${ticket.categoryId}/${ticket.categoryName}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
