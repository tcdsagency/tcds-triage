require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts } = await import('../src/db/schema');
  const { eq, like, or, desc } = await import('drizzle-orm');

  const phone = '2565252134';

  const callList = await db.select().from(calls).where(
    or(
      like(calls.fromNumber, '%' + phone + '%'),
      like(calls.toNumber, '%' + phone + '%')
    )
  ).orderBy(desc(calls.startedAt));

  for (const call of callList) {
    console.log('\n========================================');
    console.log('Call:', call.id);
    console.log('Started:', call.startedAt);

    const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, call.id));

    if (wrapup) {
      console.log('\nWrapup ID:', wrapup.id);
      console.log('Summary:', wrapup.summary);
      console.log('Service Ticket Created:', wrapup.serviceTicketCreated);
      console.log('AZ Ticket ID:', wrapup.agencyzoomTicketId);
    } else {
      console.log('(no wrapup)');
    }
  }
}

run().catch(e => console.error(e));
