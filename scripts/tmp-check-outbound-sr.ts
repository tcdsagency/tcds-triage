import { db } from '../src/db';
import { calls, wrapupDrafts } from '../src/db/schema';
import { sql, eq, and, isNotNull, desc } from 'drizzle-orm';

async function main() {
  // All outbound wrapups that got tickets
  const outboundWithTickets = await db.select({
    id: wrapupDrafts.id,
    callId: wrapupDrafts.callId,
    direction: wrapupDrafts.direction,
    agentName: wrapupDrafts.agentName,
    customerName: wrapupDrafts.customerName,
    customerPhone: wrapupDrafts.customerPhone,
    summary: wrapupDrafts.summary,
    outcome: wrapupDrafts.outcome,
    completionAction: wrapupDrafts.completionAction,
    agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
    ticketType: wrapupDrafts.ticketType,
    requestType: wrapupDrafts.requestType,
    status: wrapupDrafts.status,
    isAutoVoided: wrapupDrafts.isAutoVoided,
    autoVoidReason: wrapupDrafts.autoVoidReason,
    noteAutoPosted: wrapupDrafts.noteAutoPosted,
    createdAt: wrapupDrafts.createdAt,
    completedAt: wrapupDrafts.completedAt,
  }).from(wrapupDrafts).where(
    and(
      eq(wrapupDrafts.direction, 'Outbound'),
      isNotNull(wrapupDrafts.agencyzoomTicketId),
    )
  ).orderBy(desc(wrapupDrafts.createdAt));

  console.log(`Total outbound wrapups with tickets: ${outboundWithTickets.length}\n`);

  for (const w of outboundWithTickets) {
    // Get the call's direction info
    const [callData] = await db.select({
      direction: calls.direction,
      directionLive: calls.directionLive,
      directionFinal: calls.directionFinal,
      fromNumber: calls.fromNumber,
      toNumber: calls.toNumber,
      externalNumber: calls.externalNumber,
      extension: calls.extension,
      disposition: calls.disposition,
      durationSeconds: calls.durationSeconds,
    }).from(calls).where(eq(calls.id, w.callId)).limit(1);

    console.log('─'.repeat(80));
    console.log(`Customer: ${w.customerName || 'Unknown'} | Phone: ${w.customerPhone}`);
    console.log(`Agent: ${w.agentName} | Created: ${w.createdAt}`);
    console.log(`Wrapup direction: ${w.direction} | Outcome: ${w.outcome} | Action: ${w.completionAction}`);
    console.log(`AZ Ticket: ${w.agencyzoomTicketId} | Request: ${w.requestType}`);
    console.log(`AutoVoided: ${w.isAutoVoided} | VoidReason: ${w.autoVoidReason}`);
    if (callData) {
      console.log(`Call direction: ${callData.direction} | Live: ${callData.directionLive} | Final: ${callData.directionFinal}`);
      console.log(`From: ${callData.fromNumber} → To: ${callData.toNumber} | Ext: ${callData.extension} | Disposition: ${callData.disposition} | Duration: ${callData.durationSeconds}s`);
    }
    console.log(`Summary: ${(w.summary || '').substring(0, 150)}`);
    console.log('');
  }

  process.exit(0);
}

main().catch(console.error);
