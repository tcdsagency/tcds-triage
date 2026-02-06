require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls } = await import('../src/db/schema');
  const { or, like, desc } = await import('drizzle-orm');

  const phone = '2565252134';

  const results = await db.select().from(calls)
    .where(or(
      like(calls.fromNumber, '%' + phone + '%'),
      like(calls.toNumber, '%' + phone + '%')
    ))
    .orderBy(desc(calls.startedAt))
    .limit(5);

  if (results.length === 0) {
    console.log('No calls found for', phone);
    return;
  }

  for (const c of results) {
    console.log('=== CALL', c.id.slice(0,8), '===');
    console.log('From:', c.fromNumber, '-> To:', c.toNumber);
    console.log('Started:', c.startedAt);
    console.log('Status:', c.status);
    console.log('Direction:', c.direction);
    console.log('Duration:', c.duration, 'sec');
    console.log('Customer ID:', c.customerId || 'NOT MATCHED');
    console.log('AZ Activity ID:', c.agencyzoomActivityId || 'NOT SYNCED TO AZ');
    console.log('Transcription:', c.transcriptionStatus);
    console.log('');
  }
}

run().catch(e => console.error(e));
