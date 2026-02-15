require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts } = await import('../src/db/schema');
  const { eq, like, or, desc } = await import('drizzle-orm');

  const phone = '2052663492';

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
    console.log('Direction:', call.direction);

    const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, call.id));

    if (wrapup) {
      console.log('\n--- Wrapup ---');
      console.log('ID:', wrapup.id);
      console.log('Status:', wrapup.status);
      console.log('Match Status:', wrapup.matchStatus);
      console.log('Summary:', wrapup.summary);
      console.log('\nService Ticket Fields:');
      console.log('  serviceTicketType:', wrapup.serviceTicketType);
      console.log('  serviceTicketDescription:', wrapup.serviceTicketDescription);
      console.log('  serviceTicketCreated:', wrapup.serviceTicketCreated);
      console.log('  agencyzoomTicketId:', wrapup.agencyzoomTicketId);
      console.log('\nNote Fields:');
      console.log('  noteAutoPosted:', wrapup.noteAutoPosted);
      console.log('  agencyzoomNoteId:', wrapup.agencyzoomNoteId);
    } else {
      console.log('(no wrapup)');
    }
  }
}

run().catch(e => console.error(e));
