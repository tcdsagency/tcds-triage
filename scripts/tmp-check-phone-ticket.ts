import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, serviceTickets } = await import('../src/db/schema');
  const { sql, like, eq } = await import('drizzle-orm');

  const phoneFragment = '2055033555';

  // 1. Search calls table
  console.log('=== CALLS matching phone 2055033555 ===\n');
  const matchingCalls = await db.select({
    id: calls.id,
    direction: calls.direction,
    status: calls.status,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    externalNumber: calls.externalNumber,
    agentId: calls.agentId,
    startedAt: calls.startedAt,
    durationSeconds: calls.durationSeconds,
    customerId: calls.customerId,
  }).from(calls).where(
    sql`${calls.fromNumber} LIKE ${'%' + phoneFragment}
      OR ${calls.toNumber} LIKE ${'%' + phoneFragment}
      OR ${calls.externalNumber} LIKE ${'%' + phoneFragment}`
  );

  if (matchingCalls.length === 0) {
    console.log('No calls found.\n');
  } else {
    console.log(`Found ${matchingCalls.length} call(s):\n`);
    for (const c of matchingCalls) {
      console.log(`  id:             ${c.id}`);
      console.log(`  direction:      ${c.direction}`);
      console.log(`  status:         ${c.status}`);
      console.log(`  fromNumber:     ${c.fromNumber}`);
      console.log(`  toNumber:       ${c.toNumber}`);
      console.log(`  externalNumber: ${c.externalNumber}`);
      console.log(`  agentId:        ${c.agentId}`);
      console.log(`  startedAt:      ${c.startedAt}`);
      console.log(`  durationSeconds:${c.durationSeconds}`);
      console.log(`  customerId:     ${c.customerId}`);
      console.log('');
    }
  }

  // 2. Search wrapup_drafts table
  console.log('=== WRAPUP DRAFTS matching phone 2055033555 ===\n');
  const matchingWrapups = await db.select({
    id: wrapupDrafts.id,
    callId: wrapupDrafts.callId,
    status: wrapupDrafts.status,
    customerName: wrapupDrafts.customerName,
    customerPhone: wrapupDrafts.customerPhone,
    direction: wrapupDrafts.direction,
    requestType: wrapupDrafts.requestType,
    summary: wrapupDrafts.summary,
    agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
    createdAt: wrapupDrafts.createdAt,
  }).from(wrapupDrafts).where(
    like(wrapupDrafts.customerPhone, `%${phoneFragment}%`)
  );

  if (matchingWrapups.length === 0) {
    console.log('No wrapup drafts found.\n');
  } else {
    console.log(`Found ${matchingWrapups.length} wrapup draft(s):\n`);
    for (const w of matchingWrapups) {
      console.log(`  id:                  ${w.id}`);
      console.log(`  callId:              ${w.callId}`);
      console.log(`  status:              ${w.status}`);
      console.log(`  customerName:        ${w.customerName}`);
      console.log(`  customerPhone:       ${w.customerPhone}`);
      console.log(`  direction:           ${w.direction}`);
      console.log(`  requestType:         ${w.requestType}`);
      console.log(`  summary:             ${(w.summary || '').substring(0, 200)}`);
      console.log(`  agencyzoomTicketId:  ${w.agencyzoomTicketId}`);
      console.log(`  createdAt:           ${w.createdAt}`);
      console.log('');
    }
  }

  // 3. Search service_tickets joined with wrapup_drafts
  console.log('=== SERVICE TICKETS linked to wrapups with phone 2055033555 ===\n');
  const matchingTickets = await db.select({
    id: serviceTickets.id,
    azTicketId: serviceTickets.azTicketId,
    subject: serviceTickets.subject,
    status: serviceTickets.status,
    csrName: serviceTickets.csrName,
    source: serviceTickets.source,
    createdAt: serviceTickets.createdAt,
  }).from(serviceTickets)
    .innerJoin(wrapupDrafts, eq(serviceTickets.wrapupDraftId, wrapupDrafts.id))
    .where(like(wrapupDrafts.customerPhone, `%${phoneFragment}%`));

  if (matchingTickets.length === 0) {
    console.log('No service tickets found.\n');
  } else {
    console.log(`Found ${matchingTickets.length} service ticket(s):\n`);
    for (const t of matchingTickets) {
      console.log(`  id:          ${t.id}`);
      console.log(`  azTicketId:  ${t.azTicketId}`);
      console.log(`  subject:     ${t.subject}`);
      console.log(`  status:      ${t.status}`);
      console.log(`  csrName:     ${t.csrName}`);
      console.log(`  source:      ${t.source}`);
      console.log(`  createdAt:   ${t.createdAt}`);
      console.log('');
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
