import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();

  // Fetch a few recent tickets to see what format the good-looking ones use
  const result = await azClient.getServiceTickets({ limit: 10 });

  for (const ticket of result.data.slice(0, 5)) {
    const t = ticket as any;
    console.log(`\n===== AZ#${t.id} =====`);
    console.log(`Subject: ${t.subject}`);
    console.log(`Desc (first 500 chars):`);
    console.log(JSON.stringify((t.serviceDesc || '').substring(0, 500)));
    console.log('---');
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
