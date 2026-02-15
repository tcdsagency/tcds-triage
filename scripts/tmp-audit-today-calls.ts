import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { calls, wrapupDrafts, customers, serviceTickets, users } = await import('../src/db/schema');
  const { eq, gte, desc, and, sql } = await import('drizzle-orm');

  // Today at midnight CT (UTC-6)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('=== TODAY\'S CALL AUDIT ===');
  console.log('Since:', today.toISOString());
  console.log('');

  const todaysCalls = await db.select().from(calls)
    .where(gte(calls.startedAt, today))
    .orderBy(desc(calls.startedAt));

  console.log(`Total calls: ${todaysCalls.length}\n`);

  const stats = {
    total: todaysCalls.length,
    matched: 0,
    unmatched: 0,
    multipleMatches: 0,
    withWrapup: 0,
    withTicket: 0,
    autoVoided: 0,
    notePosted: 0,
    inbound: 0,
    outbound: 0,
    noTranscript: 0,
  };

  const unmatchedCalls: any[] = [];
  const noTicketCalls: any[] = [];
  const issues: string[] = [];

  for (const call of todaysCalls) {
    const time = new Date(call.startedAt!).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
    const phone = call.direction === 'inbound' ? call.fromNumber : call.toNumber;
    const duration = call.duration || 0;

    if (call.direction === 'inbound') stats.inbound++;
    else stats.outbound++;

    // Get customer info
    let customerName = 'NOT MATCHED';
    let customerAzId: string | null = null;
    if (call.customerId) {
      const [cust] = await db.select({
        firstName: customers.firstName,
        lastName: customers.lastName,
        azId: customers.agencyzoomId,
      }).from(customers).where(eq(customers.id, call.customerId));
      if (cust) {
        customerName = `${cust.firstName} ${cust.lastName}`;
        customerAzId = cust.azId;
      }
    }

    // Get agent info
    let agentName = 'Unknown';
    if (call.agentId) {
      const [agent] = await db.select({
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, call.agentId));
      if (agent) agentName = `${agent.firstName} ${agent.lastName}`;
    }

    // Get wrapup
    const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.callId, call.id));

    // Get ticket
    let ticket: any = null;
    if (wrapup) {
      const [t] = await db.select().from(serviceTickets).where(eq(serviceTickets.wrapupDraftId, wrapup.id));
      ticket = t;
    }

    // Tally stats
    if (wrapup) {
      stats.withWrapup++;
      if (wrapup.matchStatus === 'matched') stats.matched++;
      else if (wrapup.matchStatus === 'multiple_matches') stats.multipleMatches++;
      else stats.unmatched++;

      if (wrapup.isAutoVoided) stats.autoVoided++;
      if (wrapup.noteAutoPosted) stats.notePosted++;
    } else {
      if (call.customerId) stats.matched++;
      else stats.unmatched++;
    }
    if (ticket) stats.withTicket++;

    // Print each call
    console.log('─'.repeat(80));
    console.log(`${time}  ${(call.direction || '').padEnd(8)}  ${(phone || 'no-phone').padEnd(14)}  ${duration}s  Agent: ${agentName}`);
    console.log(`  Customer: ${customerName}${customerAzId ? ` (AZ: ${customerAzId})` : call.customerId ? ' (NO AZ ID)' : ''}`);

    if (wrapup) {
      const matchIcon = wrapup.matchStatus === 'matched' ? '✓' : wrapup.matchStatus === 'multiple_matches' ? '?' : '✗';
      console.log(`  Wrapup: ${wrapup.status}  Match: ${matchIcon} ${wrapup.matchStatus}  AutoVoid: ${wrapup.isAutoVoided ? 'YES (' + wrapup.autoVoidReason + ')' : 'no'}`);
      console.log(`  Note: ${wrapup.noteAutoPosted ? 'posted' : 'NOT posted'}  Ticket: ${ticket ? ticket.azTicketId : 'NONE'}  Sentiment: ${(wrapup as any).sentiment || 'n/a'}`);
      if (wrapup.summary) {
        console.log(`  Summary: ${wrapup.summary.substring(0, 120)}${wrapup.summary.length > 120 ? '...' : ''}`);
      }
    } else {
      console.log(`  Wrapup: NONE (no transcript processed)`);
      stats.noTranscript++;
    }

    // Collect problem calls
    if (!call.customerId && !wrapup?.isAutoVoided) {
      unmatchedCalls.push({ time, phone, duration, agentName, wrapupStatus: wrapup?.status, matchStatus: wrapup?.matchStatus, summary: wrapup?.summary?.substring(0, 80) });
    }

    if (wrapup && !wrapup.isAutoVoided && !ticket && call.direction === 'inbound' && wrapup.matchStatus !== 'unmatched') {
      noTicketCalls.push({ time, phone, customerName, agentName, wrapupStatus: wrapup.status, matchStatus: wrapup.matchStatus, notePosted: wrapup.noteAutoPosted });
    }

    // Flag issues
    if (wrapup?.matchStatus === 'unmatched' && call.customerId) {
      issues.push(`${time} ${phone} - Has customerId but wrapup says unmatched`);
    }
    if (wrapup?.status === 'completed' && !wrapup.noteAutoPosted && wrapup.matchStatus === 'matched' && !wrapup.isAutoVoided) {
      issues.push(`${time} ${phone} ${customerName} - Completed+matched but note NOT posted`);
    }
    if (call.customerId && !customerAzId && wrapup && !wrapup.isAutoVoided) {
      issues.push(`${time} ${phone} ${customerName} - Customer has no AgencyZoom ID (can't post note/ticket)`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('STATISTICS');
  console.log('═'.repeat(80));
  console.log(`Total calls:         ${stats.total} (${stats.inbound} inbound, ${stats.outbound} outbound)`);
  console.log(`Customer matched:    ${stats.matched}`);
  console.log(`Multiple matches:    ${stats.multipleMatches}`);
  console.log(`Unmatched:           ${stats.unmatched}`);
  console.log(`With wrapup:         ${stats.withWrapup}`);
  console.log(`Auto-voided:         ${stats.autoVoided}`);
  console.log(`Notes posted:        ${stats.notePosted}`);
  console.log(`Tickets created:     ${stats.withTicket}`);
  console.log(`No transcript:       ${stats.noTranscript}`);

  if (unmatchedCalls.length > 0) {
    console.log('\n' + '═'.repeat(80));
    console.log(`UNMATCHED CALLS (${unmatchedCalls.length}) - Not auto-voided`);
    console.log('═'.repeat(80));
    for (const c of unmatchedCalls) {
      console.log(`  ${c.time}  ${(c.phone || 'no-phone').padEnd(14)}  ${c.duration}s  Agent: ${c.agentName}`);
      console.log(`    Wrapup: ${c.wrapupStatus || 'none'}  Match: ${c.matchStatus || 'n/a'}`);
      if (c.summary) console.log(`    Summary: ${c.summary}`);
    }
  }

  if (noTicketCalls.length > 0) {
    console.log('\n' + '═'.repeat(80));
    console.log(`MATCHED INBOUND WITHOUT TICKET (${noTicketCalls.length})`);
    console.log('═'.repeat(80));
    for (const c of noTicketCalls) {
      console.log(`  ${c.time}  ${(c.phone || '').padEnd(14)}  ${c.customerName}  Agent: ${c.agentName}`);
      console.log(`    Wrapup: ${c.wrapupStatus}  Match: ${c.matchStatus}  Note: ${c.notePosted ? 'yes' : 'NO'}`);
    }
  }

  if (issues.length > 0) {
    console.log('\n' + '═'.repeat(80));
    console.log(`ISSUES (${issues.length})`);
    console.log('═'.repeat(80));
    for (const issue of issues) {
      console.log(`  ⚠  ${issue}`);
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
