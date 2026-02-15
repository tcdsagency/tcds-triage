require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, serviceTickets, customers } = await import('../src/db/schema');
  const { eq, or, like, desc } = await import('drizzle-orm');

  const phones = ['2565952468', '2059993840'];

  for (const phone of phones) {
    console.log('========================================');
    console.log(`Phone: ${phone}`);
    console.log('========================================\n');

    // Find all calls from/to this number
    const phoneCalls = await db.select().from(calls)
      .where(or(
        like(calls.fromNumber, `%${phone}%`),
        like(calls.toNumber, `%${phone}%`),
        like(calls.externalNumber, `%${phone}%`)
      ))
      .orderBy(desc(calls.startedAt));

    console.log(`Total calls found: ${phoneCalls.length}\n`);

    for (const call of phoneCalls) {
      const time = call.startedAt ? new Date(call.startedAt).toLocaleString() : 'unknown';
      const duration = call.duration ? `${Math.round(call.duration)}s` : 'N/A';

      console.log('----------------------------------------');
      console.log(`Call: ${call.id.slice(0, 8)} | ${call.direction} | ${time} | ${duration}`);
      console.log(`From: ${call.fromNumber} -> To: ${call.toNumber}`);

      // Customer
      if (call.customerId) {
        const [cust] = await db.select({
          firstName: customers.firstName,
          lastName: customers.lastName,
          azId: customers.agencyzoomId,
        }).from(customers).where(eq(customers.id, call.customerId));
        if (cust) {
          console.log(`Customer: ${cust.firstName} ${cust.lastName} (AZ: ${cust.azId})`);
        }
      } else {
        console.log('Customer: NOT MATCHED');
      }

      // Wrapup
      const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, call.id));
      if (wrapup) {
        console.log(`Wrapup: ${wrapup.id.slice(0, 8)} | Status: ${wrapup.status} | Outcome: ${wrapup.outcome || 'none'}`);
        console.log(`Match: ${wrapup.matchStatus} | AZ Ticket: ${wrapup.agencyzoomTicketId || 'NONE'}`);
        if (wrapup.summary) {
          console.log(`Summary: ${wrapup.summary.substring(0, 150)}...`);
        }

        // Service tickets linked to this wrapup
        const tickets = await db.select().from(serviceTickets).where(eq(serviceTickets.wrapupDraftId, wrapup.id));
        if (tickets.length > 0) {
          console.log(`Service Tickets (${tickets.length}):`);
          for (const t of tickets) {
            console.log(`  - AZ#${t.azTicketId} | ${t.subject} | ${t.status} | ${t.pipelineName} > ${t.stageName} | Source: ${t.source}`);
          }
        }
      } else {
        console.log('Wrapup: NONE');
      }

      // Also check service tickets by customerId directly
      if (call.customerId) {
        const custTickets = await db.select().from(serviceTickets).where(eq(serviceTickets.customerId, call.customerId));
        if (custTickets.length > 1) {
          console.log(`\nAll tickets for this customer (${custTickets.length}):`);
          for (const t of custTickets) {
            const created = t.azCreatedAt ? new Date(t.azCreatedAt).toLocaleString() : 'unknown';
            console.log(`  - AZ#${t.azTicketId} | ${t.subject} | ${t.status} | Created: ${created} | Source: ${t.source}`);
          }
        }
      }

      console.log('');
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
