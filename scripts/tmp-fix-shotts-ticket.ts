import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();

  // Fetch current ticket
  const result = await azClient.getServiceTickets({ serviceTicketIds: [9271444] });
  const ticket = result.data?.[0] as any;
  if (!ticket) { console.log('Ticket not found'); process.exit(1); }

  let desc: string = ticket.serviceDesc || '';

  // 1. Remove the duplicate QUOTE INTAKE DETAILS block at the bottom
  const dupeMarker = '\n\n===================================\nQUOTE INTAKE DETAILS\n===================================\n';
  const dupeIdx = desc.indexOf(dupeMarker);
  if (dupeIdx !== -1) {
    desc = desc.substring(0, dupeIdx).trimEnd();
    console.log('Removed duplicate QUOTE INTAKE DETAILS section');
  }

  // 2. Clean up transcription - remove repeated "Okay." lines
  // The transcription has a block of ~38 "Okay.<br />\n" followed by actual text
  // Replace the repeated Okay block with a single [hold/silence] note
  desc = desc.replace(
    /<p>Okay\.<br \/>\nOkay\.<br \/>\n(?:Okay\.<br \/>\n)*/g,
    '<p>[Caller on hold]<br />\n'
  );

  // Also clean up any standalone repeated <p>Okay.</p> lines (3+ in a row)
  desc = desc.replace(
    /(<p>Okay\.<\/p>\n){3,}/g,
    '<p>[Caller on hold]</p>\n'
  );

  // 3. Strip HTML tags from transcription for cleaner display
  // Replace <p>...</p> with the inner text + newline
  const transcriptMarker = 'CALL TRANSCRIPTION\n===================================\n\n';
  const transcriptIdx = desc.indexOf(transcriptMarker);
  if (transcriptIdx !== -1) {
    const before = desc.substring(0, transcriptIdx + transcriptMarker.length);
    let transcript = desc.substring(transcriptIdx + transcriptMarker.length);

    // Strip <p> tags
    transcript = transcript.replace(/<p>/g, '');
    transcript = transcript.replace(/<\/p>/g, '');
    // Strip <br /> tags
    transcript = transcript.replace(/<br\s*\/?>/g, '');
    // Clean up excessive blank lines
    transcript = transcript.replace(/\n{3,}/g, '\n\n');
    transcript = transcript.trim();

    desc = before + transcript;
  }

  console.log('\n========== CLEANED DESCRIPTION ==========');
  console.log(desc);
  console.log('========== END ==========\n');

  // PUT the cleaned description
  await azClient.updateServiceTicket(9271444, {
    customerId: ticket.householdId,
    workflowId: ticket.workflowId,
    workflowStageId: ticket.workflowStageId,
    csr: ticket.csr,
    subject: ticket.subject,
    priorityId: ticket.priorityId,
    categoryId: ticket.categoryId,
    description: desc,
  });

  console.log('Ticket updated successfully');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
