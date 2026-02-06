require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, serviceTickets } = await import('../src/db/schema');
  const { eq, or, like, desc } = await import('drizzle-orm');

  const phones = ['2565252134', '2052663492'];

  for (const phone of phones) {
    console.log('\n========================================');
    console.log('PHONE:', phone);
    console.log('========================================');

    // Get calls
    const callResults = await db.select().from(calls)
      .where(or(
        like(calls.fromNumber, '%' + phone + '%'),
        like(calls.toNumber, '%' + phone + '%')
      ))
      .orderBy(desc(calls.startedAt))
      .limit(3);

    for (const call of callResults) {
      console.log('\n--- Call', call.id.slice(0, 8), '---');
      console.log('Time:', call.startedAt);
      console.log('Status:', call.status);
      console.log('Direction:', call.direction);
      console.log('Customer ID:', call.customerId || 'NONE');
      console.log('AZ Activity ID:', call.agencyzoomActivityId || 'NONE');
      console.log('Transcription Status:', call.transcriptionStatus);
      console.log('VM Session ID:', call.vmSessionId || 'NONE');
      console.log('External Call ID:', call.externalCallId || 'NONE');

      // Check for wrapup draft
      const wrapups = await db.select({
        id: wrapupDrafts.id,
        status: wrapupDrafts.status,
        agentName: wrapupDrafts.agentName,
        summary: wrapupDrafts.summary,
        azNoteId: wrapupDrafts.agencyzoomNoteId,
        azTicketId: wrapupDrafts.agencyzoomTicketId,
        noteAutoPosted: wrapupDrafts.noteAutoPosted,
      }).from(wrapupDrafts)
        .where(eq(wrapupDrafts.callId, call.id));

      if (wrapups.length > 0) {
        console.log('\nWRAPUP DRAFT:');
        for (const w of wrapups) {
          console.log('  Status:', w.status);
          console.log('  Agent:', w.agentName);
          console.log('  AZ Note ID:', w.azNoteId || 'NOT POSTED');
          console.log('  AZ Ticket ID:', w.azTicketId || 'NONE');
          console.log('  Auto-posted:', w.noteAutoPosted);
          console.log('  Summary:', (w.summary || '').slice(0, 100) + '...');
        }
      } else {
        console.log('\n⚠️ NO WRAPUP DRAFT - call-completed webhook never processed this call');
      }

      // Check service tickets
      const tickets = await db.select({
        id: serviceTickets.id,
        azTicketId: serviceTickets.azTicketId,
        subject: serviceTickets.subject,
        status: serviceTickets.status,
      }).from(serviceTickets)
        .where(eq(serviceTickets.wrapupDraftId, wrapups[0]?.id || ''));

      if (tickets.length > 0) {
        console.log('\nSERVICE TICKETS:');
        for (const t of tickets) {
          console.log('  AZ Ticket:', t.azTicketId);
          console.log('  Subject:', t.subject);
          console.log('  Status:', t.status);
        }
      }
    }
  }
}

run().catch(e => console.error(e));
