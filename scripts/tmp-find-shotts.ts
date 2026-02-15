import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { quotes, customers, wrapupDrafts, calls, serviceTickets } = await import('../src/db/schema');
  const { sql, ilike, or, eq } = await import('drizzle-orm');

  console.log('=== Searching for Dennis Shotts across tables ===\n');

  // 1. Search quotes table - JSONB contactInfo containing "shotts" or "dennis"
  console.log('--- QUOTES (contactInfo JSONB search) ---');
  const quoteResults = await db.select({
    id: quotes.id,
    type: quotes.type,
    status: quotes.status,
    contactInfo: quotes.contactInfo,
    customerId: quotes.customerId,
    createdAt: quotes.createdAt,
    notes: quotes.notes,
    selectedCarrier: quotes.selectedCarrier,
    selectedPremium: quotes.selectedPremium,
  }).from(quotes).where(
    or(
      sql`${quotes.contactInfo}::text ILIKE ${'%shotts%'}`,
      sql`${quotes.contactInfo}::text ILIKE ${'%dennis%'}`
    )
  );
  if (quoteResults.length === 0) {
    console.log('  No quotes found.');
  } else {
    for (const q of quoteResults) {
      console.log(`  Quote ID: ${q.id}`);
      console.log(`    Type: ${q.type} | Status: ${q.status}`);
      console.log(`    Contact Info: ${JSON.stringify(q.contactInfo)}`);
      console.log(`    Customer ID: ${q.customerId || 'none'}`);
      console.log(`    Carrier: ${q.selectedCarrier || 'none'} | Premium: ${q.selectedPremium || 'none'}`);
      console.log(`    Notes: ${q.notes || 'none'}`);
      console.log(`    Created: ${q.createdAt}`);
      console.log();
    }
  }

  // 2. Search customers table for name "Shotts" or "Dennis Shotts"
  console.log('\n--- CUSTOMERS (name search) ---');
  const customerResults = await db.select().from(customers).where(
    or(
      ilike(customers.lastName, '%shotts%'),
      ilike(customers.firstName, '%dennis%')
    )
  );
  if (customerResults.length === 0) {
    console.log('  No customers found.');
  } else {
    for (const c of customerResults) {
      console.log(`  Customer ID: ${c.id}`);
      console.log(`    Name: ${c.firstName} ${c.lastName}`);
      console.log(`    Email: ${c.email || 'none'} | Phone: ${c.phone || 'none'}`);
      console.log(`    AZ ID: ${c.agencyzoomId || 'none'} | HawkSoft: ${c.hawksoftClientCode || 'none'}`);
      console.log(`    Created: ${c.createdAt}`);
      console.log();
    }
  }

  // 3. Search wrapup_drafts table for customerName containing "shotts" or "dennis"
  console.log('\n--- WRAPUP DRAFTS (customerName search) ---');
  const wrapupResults = await db.select().from(wrapupDrafts).where(
    or(
      ilike(wrapupDrafts.customerName, '%shotts%'),
      ilike(wrapupDrafts.customerName, '%dennis%')
    )
  );
  if (wrapupResults.length === 0) {
    console.log('  No wrapup drafts found.');
  } else {
    for (const w of wrapupResults) {
      console.log(`  Wrapup ID: ${w.id}`);
      console.log(`    Customer: ${w.customerName || 'none'} | Phone: ${w.customerPhone || 'none'}`);
      console.log(`    Call ID: ${w.callId}`);
      console.log(`    Status: ${w.status} | Direction: ${w.direction}`);
      console.log(`    Agent: ${w.agentName || 'none'}`);
      console.log(`    Created: ${w.createdAt}`);
      console.log();
    }
  }

  // 4. Search calls table - join with customers to find calls for customer with last name "shotts"
  console.log('\n--- CALLS (linked to customer with last name "shotts") ---');
  const callResults = await db.select({
    callId: calls.id,
    direction: calls.direction,
    directionFinal: calls.directionFinal,
    status: calls.status,
    fromNumber: calls.fromNumber,
    toNumber: calls.toNumber,
    createdAt: calls.createdAt,
    customerId: calls.customerId,
    customerFirst: customers.firstName,
    customerLast: customers.lastName,
  }).from(calls)
    .innerJoin(customers, eq(calls.customerId, customers.id))
    .where(ilike(customers.lastName, '%shotts%'));
  if (callResults.length === 0) {
    console.log('  No calls found.');
  } else {
    for (const c of callResults) {
      console.log(`  Call ID: ${c.callId}`);
      console.log(`    Customer: ${c.customerFirst} ${c.customerLast}`);
      console.log(`    Direction: ${c.direction} (final: ${c.directionFinal || 'n/a'}) | Status: ${c.status}`);
      console.log(`    From: ${c.fromNumber} -> To: ${c.toNumber}`);
      console.log(`    Created: ${c.createdAt}`);
      console.log();
    }
  }

  // 5. Search service_tickets table for subject or description mentioning "shotts"
  console.log('\n--- SERVICE TICKETS (subject/description search) ---');
  const ticketResults = await db.select().from(serviceTickets).where(
    or(
      ilike(serviceTickets.subject, '%shotts%'),
      ilike(serviceTickets.description, '%shotts%')
    )
  );
  if (ticketResults.length === 0) {
    console.log('  No service tickets found.');
  } else {
    for (const t of ticketResults) {
      console.log(`  Ticket ID: ${t.id}`);
      console.log(`    AZ Ticket ID: ${t.azTicketId}`);
      console.log(`    Subject: ${t.subject}`);
      console.log(`    Description: ${(t.description || 'none').substring(0, 200)}`);
      console.log(`    Status: ${t.status} | Pipeline: ${t.pipelineName || 'none'} | Stage: ${t.stageName || 'none'}`);
      console.log(`    Category: ${t.categoryName || 'none'} | Priority: ${t.priorityName || 'none'}`);
      console.log(`    CSR: ${t.csrName || 'none'}`);
      console.log(`    Customer ID: ${t.customerId || 'none'}`);
      console.log(`    Wrapup Draft ID: ${t.wrapupDraftId || 'none'}`);
      console.log(`    Due: ${t.dueDate || 'none'} | AZ Created: ${t.azCreatedAt || 'none'}`);
      console.log();
    }
  }

  // 6. Search service_tickets for "shots" (misspelling found in wrapup) and by wrapup draft IDs
  console.log('\n--- SERVICE TICKETS (expanded search: "shots" + wrapup draft linkage) ---');
  const wrapupIds = wrapupResults.map(w => w.id);
  const ticketResults2 = await db.select().from(serviceTickets).where(
    or(
      ilike(serviceTickets.subject, '%shots%'),
      ilike(serviceTickets.description, '%shots%'),
      ilike(serviceTickets.subject, '%dennis%'),
      ilike(serviceTickets.description, '%dennis%'),
      ...(wrapupIds.length > 0 ? wrapupIds.map(wid => eq(serviceTickets.wrapupDraftId, wid)) : [])
    )
  );
  if (ticketResults2.length === 0) {
    console.log('  No service tickets found.');
  } else {
    for (const t of ticketResults2) {
      console.log(`  Ticket ID: ${t.id}`);
      console.log(`    AZ Ticket ID: ${t.azTicketId}`);
      console.log(`    Subject: ${t.subject}`);
      console.log(`    Description: ${(t.description || 'none').substring(0, 300)}`);
      console.log(`    Status: ${t.status} | Pipeline: ${t.pipelineName || 'none'} | Stage: ${t.stageName || 'none'}`);
      console.log(`    Category: ${t.categoryName || 'none'} | Priority: ${t.priorityName || 'none'}`);
      console.log(`    CSR: ${t.csrName || 'none'}`);
      console.log(`    Customer ID: ${t.customerId || 'none'}`);
      console.log(`    Wrapup Draft ID: ${t.wrapupDraftId || 'none'}`);
      console.log(`    Due: ${t.dueDate || 'none'} | AZ Created: ${t.azCreatedAt || 'none'}`);
      console.log();
    }
  }

  // 7. Also look at the call details for the Shotts wrapup
  console.log('\n--- CALL DETAILS for Shotts wrapup (callId: 4fe6d032-e2ac-4b26-a6b5-ae1b8cd2b43f) ---');
  const shottsCallId = '4fe6d032-e2ac-4b26-a6b5-ae1b8cd2b43f';
  const callDetail = await db.select().from(calls).where(eq(calls.id, shottsCallId));
  if (callDetail.length === 0) {
    console.log('  No call found.');
  } else {
    for (const c of callDetail) {
      console.log(`  Call ID: ${c.id}`);
      console.log(`    Direction: ${c.direction} (final: ${c.directionFinal || 'n/a'}) | Status: ${c.status}`);
      console.log(`    From: ${c.fromNumber} -> To: ${c.toNumber}`);
      console.log(`    Customer ID: ${c.customerId || 'none'}`);
      console.log(`    Agent ID: ${c.agentId || 'none'}`);
      console.log(`    External Call ID: ${c.externalCallId || 'none'}`);
      console.log(`    Created: ${c.createdAt}`);
      console.log();
    }
  }

  console.log('=== Search complete ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
