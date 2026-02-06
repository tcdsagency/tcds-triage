require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts } = await import('../src/db/schema');
  const { or, like, desc, gte, eq } = await import('drizzle-orm');

  // Today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('Looking for calls from today:', today.toISOString());

  const phones = ['2565252134', '2052663492'];

  for (const phone of phones) {
    console.log('\n========================================');
    console.log('PHONE:', phone);
    console.log('========================================');

    // Get ALL calls for this number, ordered by most recent
    const callResults = await db.select().from(calls)
      .where(or(
        like(calls.fromNumber, '%' + phone + '%'),
        like(calls.toNumber, '%' + phone + '%')
      ))
      .orderBy(desc(calls.startedAt))
      .limit(5);

    if (callResults.length === 0) {
      console.log('NO CALLS FOUND');
      continue;
    }

    for (const call of callResults) {
      const callDate = new Date(call.startedAt!);
      const isToday = callDate >= today;

      console.log(`\n${isToday ? '📞 TODAY' : '📅 OLD'} - Call ${call.id.slice(0, 8)}`);
      console.log('  Time:', call.startedAt);
      console.log('  From:', call.fromNumber, '-> To:', call.toNumber);
      console.log('  Status:', call.status);
      console.log('  Direction:', call.direction);
      console.log('  Customer ID:', call.customerId || 'NOT MATCHED');
      console.log('  AZ Activity:', call.agencyzoomActivityId || 'NOT SYNCED');
      console.log('  Transcription:', call.transcriptionStatus);

      // Check wrapup
      const wrapups = await db.select({
        id: wrapupDrafts.id,
        status: wrapupDrafts.status,
        azNoteId: wrapupDrafts.agencyzoomNoteId,
        azTicketId: wrapupDrafts.agencyzoomTicketId,
      }).from(wrapupDrafts)
        .where(eq(wrapupDrafts.callId, call.id));

      if (wrapups.length > 0) {
        console.log('  Wrapup:', wrapups[0].status);
        console.log('  AZ Note:', wrapups[0].azNoteId || 'NONE');
        console.log('  AZ Ticket:', wrapups[0].azTicketId || 'NONE');
      } else {
        console.log('  ⚠️ NO WRAPUP - webhook not processed');
      }
    }
  }
}

run().catch(e => console.error(e));
