import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { wrapupDrafts, serviceTickets } = await import('../src/db/schema');
  const { eq, gte, and, isNotNull, desc, sql } = await import('drizzle-orm');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check wrapup drafts with AZ ticket IDs
  const wrapups = await db
    .select({
      id: wrapupDrafts.id,
      customerName: wrapupDrafts.customerName,
      customerPhone: wrapupDrafts.customerPhone,
      agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
      status: wrapupDrafts.status,
      outcome: wrapupDrafts.outcome,
      direction: wrapupDrafts.direction,
      createdAt: wrapupDrafts.createdAt,
    })
    .from(wrapupDrafts)
    .where(
      and(
        gte(wrapupDrafts.createdAt, today),
        isNotNull(wrapupDrafts.agencyzoomTicketId),
      )
    )
    .orderBy(desc(wrapupDrafts.createdAt));

  console.log(`${wrapups.length} wrapups with AZ ticket IDs today:\n`);
  for (const w of wrapups) {
    console.log(`${w.createdAt?.toLocaleTimeString()} | ${w.direction} | ${w.customerName} | ${w.customerPhone}`);
    console.log(`  AZ#${w.agencyzoomTicketId} | status: ${w.status} | outcome: ${w.outcome}`);
  }

  // Check local service_tickets table for today
  const localTickets = await db
    .select({
      id: serviceTickets.id,
      azTicketId: serviceTickets.azTicketId,
      subject: serviceTickets.subject,
      wrapupDraftId: serviceTickets.wrapupDraftId,
      createdAt: serviceTickets.createdAt,
    })
    .from(serviceTickets)
    .where(gte(serviceTickets.createdAt, today))
    .orderBy(desc(serviceTickets.createdAt));

  console.log(`\n${localTickets.length} local service tickets today:`);
  for (const t of localTickets) {
    console.log(`  AZ#${t.azTicketId}: "${t.subject?.substring(0, 60)}" | wrapup: ${t.wrapupDraftId || 'N/A'}`);
  }

  // Check what the most recent tickets are in AZ (to see if today's even exist)
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();
  const recent = await azClient.getServiceTickets({ limit: 15 });

  console.log(`\nMost recent ${recent.data.length} active AZ tickets:`);
  for (const t of recent.data) {
    const ticket = t as any;
    console.log(`  #${ticket.id}: "${ticket.subject?.substring(0, 60)}" | ${ticket.createDate} | by: ${ticket.createdBy}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
