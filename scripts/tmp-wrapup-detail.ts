require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { wrapupDrafts, calls } = await import('../src/db/schema');
  const { eq, like, desc } = await import('drizzle-orm');

  // Find call by phone
  const [call] = await db.select().from(calls)
    .where(like(calls.fromNumber, '%2052663492%'))
    .orderBy(desc(calls.startedAt))
    .limit(1);

  if (!call) {
    console.log('Call not found');
    return;
  }

  console.log('Call ID:', call.id);

  // Find wrapup
  const [wrapup] = await db.select().from(wrapupDrafts)
    .where(eq(wrapupDrafts.callId, call.id));

  if (!wrapup) {
    console.log('Wrapup not found for call', call.id);
    return;
  }

  console.log('\n=== WRAPUP ===');
  console.log('ID:', wrapup.id);
  console.log('Status:', wrapup.status);
  console.log('Customer Name:', wrapup.customerName);
  console.log('Agent:', wrapup.agentName);
  console.log('Summary:', wrapup.summary?.slice(0, 300));
  console.log('\n=== AZ SYNC ===');
  console.log('Note Auto-Posted:', wrapup.noteAutoPosted);
  console.log('AZ Note ID:', wrapup.agencyzoomNoteId || 'NONE');
  console.log('AZ Ticket ID:', wrapup.agencyzoomTicketId || 'NONE');
  console.log('Is Auto-Voided:', wrapup.isAutoVoided);
  console.log('\n=== TIMESTAMPS ===');
  console.log('Created:', wrapup.createdAt);
  console.log('Updated:', wrapup.updatedAt);
}

run().catch(e => console.error(e));
