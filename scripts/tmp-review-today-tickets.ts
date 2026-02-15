import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { wrapupDrafts, calls } = await import('../src/db/schema');
  const { eq, gte, and, isNotNull, desc, sql } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');

  const azClient = getAgencyZoomClient();

  // Get today's start (UTC)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all wrapups from today that have AZ ticket IDs
  const wrapups = await db
    .select({
      id: wrapupDrafts.id,
      callId: wrapupDrafts.callId,
      customerName: wrapupDrafts.customerName,
      customerPhone: wrapupDrafts.customerPhone,
      direction: wrapupDrafts.direction,
      agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
      status: wrapupDrafts.status,
      createdAt: wrapupDrafts.createdAt,
      summary: wrapupDrafts.aiCleanedSummary,
    })
    .from(wrapupDrafts)
    .where(
      and(
        gte(wrapupDrafts.createdAt, today),
        isNotNull(wrapupDrafts.agencyzoomTicketId),
      )
    )
    .orderBy(desc(wrapupDrafts.createdAt));

  console.log(`Found ${wrapups.length} wrapups with AZ tickets today\n`);

  // Collect all ticket IDs to fetch from AZ
  const ticketIds = wrapups
    .map(w => parseInt(w.agencyzoomTicketId!, 10))
    .filter(id => !isNaN(id) && id > 0);

  // Fetch tickets from AZ in batches
  let azTickets: Record<number, any> = {};
  if (ticketIds.length > 0) {
    try {
      const result = await azClient.getServiceTickets({ serviceTicketIds: ticketIds, limit: 100 });
      for (const t of result.data) {
        azTickets[(t as any).id] = t;
      }
    } catch (err) {
      console.error('Failed to fetch AZ tickets:', err);
    }
  }

  // Review each wrapup and its AZ ticket
  for (const w of wrapups) {
    const azId = parseInt(w.agencyzoomTicketId!, 10);
    const azTicket = azTickets[azId];

    console.log(`${'='.repeat(70)}`);
    console.log(`Wrapup: ${w.id}`);
    console.log(`Customer: ${w.customerName || 'Unknown'} | Phone: ${w.customerPhone || 'N/A'}`);
    console.log(`Direction: ${w.direction} | Status: ${w.status}`);
    console.log(`Time: ${w.createdAt?.toLocaleTimeString()}`);
    console.log(`Summary: ${(w.summary || 'N/A').substring(0, 120)}`);
    console.log(`AZ Ticket: #${azId}`);

    if (azTicket) {
      const desc = azTicket.serviceDesc || '';
      const hasHtml = desc.includes('<br') || desc.includes('<b>');
      const hasEmoji = desc.includes('🛠️') || desc.includes('📞') || desc.includes('🗣️');
      const hasOldFormat = desc.includes('===') || (desc.includes('\n\n') && !hasHtml);

      console.log(`  Subject: ${azTicket.subject}`);
      console.log(`  Stage: ${azTicket.workflowStageName}`);
      console.log(`  Category: ${azTicket.categoryId}`);
      console.log(`  Format: ${hasHtml ? 'HTML ✓' : hasOldFormat ? 'OLD PLAIN TEXT ✗' : 'Plain text'} | Emojis: ${hasEmoji ? '✓' : '✗'}`);
      console.log(`  Desc preview: ${desc.substring(0, 200).replace(/\n/g, '\\n')}`);
    } else {
      console.log(`  ⚠️ Ticket not found in AZ`);
    }
    console.log('');
  }

  // Summary
  const htmlCount = Object.values(azTickets).filter((t: any) => t.serviceDesc?.includes('<br')).length;
  const oldCount = Object.values(azTickets).filter((t: any) => t.serviceDesc?.includes('===') && !t.serviceDesc?.includes('<br')).length;
  const plainCount = Object.values(azTickets).length - htmlCount - oldCount;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`SUMMARY: ${wrapups.length} tickets today`);
  console.log(`  New HTML format: ${htmlCount}`);
  console.log(`  Old plain text format: ${oldCount}`);
  console.log(`  Other/plain: ${plainCount}`);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
