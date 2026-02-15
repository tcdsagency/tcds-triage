import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();
  const token = await (azClient as any).getToken();

  // Try category endpoints
  const endpoints = [
    '/v1/api/serviceTicket/categories',
    '/v1/api/categories',
    '/v1/api/serviceTicket/service-tickets/categories',
    '/v1/api/serviceTicket/priorities',
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(`https://api.agencyzoom.com${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const text = await resp.text();
      console.log(`\n${ep}: ${resp.status}`);
      if (resp.status === 200) {
        try {
          const data = JSON.parse(text);
          console.log(JSON.stringify(data, null, 2).substring(0, 1000));
        } catch {
          console.log(text.substring(0, 500));
        }
      }
    } catch (e) {
      console.log(`${ep}: error`);
    }
  }

  // Also list unique categories from recent tickets
  const result = await azClient.getServiceTickets({ limit: 50 });
  const categories = new Map<number, string>();
  for (const t of result.data) {
    const ticket = t as any;
    if (ticket.categoryId && ticket.categoryName) {
      categories.set(ticket.categoryId, ticket.categoryName);
    }
  }
  console.log('\nCategories from recent tickets:');
  for (const [id, name] of categories) {
    console.log(`  ${id}: ${name}`);
  }

  // Check pipelines and stages
  try {
    const pipelines = await azClient.getPipelinesAndStages('service');
    console.log('\nService Pipelines:');
    for (const p of pipelines) {
      console.log(`  Pipeline ${p.id}: ${p.name}`);
      if (p.stages) {
        for (const s of p.stages) {
          console.log(`    Stage ${s.id}: ${s.name}`);
        }
      }
    }
  } catch (e) {
    console.log('Failed to get pipelines:', e);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
