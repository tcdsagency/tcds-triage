require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts } = await import('../src/db/schema');
  const { eq, like, desc } = await import('drizzle-orm');

  // Get the call
  const [call] = await db.select().from(calls)
    .where(like(calls.fromNumber, '%2052663492%'))
    .orderBy(desc(calls.startedAt))
    .limit(1);

  if (!call) {
    console.log('Call not found');
    return;
  }

  console.log('=== FULL CALL DATA ===');
  console.log('ID:', call.id);
  console.log('Direction:', call.direction);
  console.log('Status:', call.status);
  console.log('From:', call.fromNumber);
  console.log('To:', call.toNumber);
  console.log('Customer ID:', call.customerId);
  console.log('Agent ID:', call.agentId);
  console.log('Tenant ID:', call.tenantId);
  console.log('AZ Activity ID:', call.agencyzoomActivityId);
  console.log('Disposition:', call.disposition);
  console.log('Started:', call.startedAt);
  console.log('Ended:', call.endedAt);

  // Get wrapup
  const [wrapup] = await db.select().from(wrapupDrafts)
    .where(eq(wrapupDrafts.callId, call.id));

  if (wrapup) {
    console.log('\n=== FULL WRAPUP DATA ===');
    console.log('ID:', wrapup.id);
    console.log('Status:', wrapup.status);
    console.log('Match Status:', wrapup.matchStatus);
    console.log('Customer Name:', wrapup.customerName);
    console.log('Agent Name:', wrapup.agentName);
    console.log('Is Auto Voided:', wrapup.isAutoVoided);
    console.log('Note Auto Posted:', wrapup.noteAutoPosted);
    console.log('AZ Note ID:', wrapup.agencyzoomNoteId);
    console.log('AZ Ticket ID:', wrapup.agencyzoomTicketId);
    console.log('Summary:', wrapup.summary?.slice(0, 200));
    console.log('Created:', wrapup.createdAt);
  }
}

run().catch(e => console.error(e));
