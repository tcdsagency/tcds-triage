import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const { formatInboundCallDescription, formatQuoteSection } = await import('../src/lib/format-ticket-description');

  // Simulate what Dennis Shotts ticket would look like with the new format
  const quoteSection = formatQuoteSection({
    typeLabel: 'Personal Auto',
    contact: {
      firstName: 'Dennis',
      lastName: 'Shotts',
      phone: '205-681-5526',
      email: 'dennisandpam@att.net',
      address: { street: '1680 Hagood Mtn. Rd.', city: 'Morris', state: 'AL', zip: '35116' },
    },
    vehicles: [{ year: 1998, make: 'Chevy', model: 'C-10' }],
    drivers: [
      { firstName: 'Dennis', lastName: 'Shotts', dob: '1945-12-07', licenseNumber: '2243374', licenseState: 'AL' },
      { firstName: 'Pam', lastName: 'Shotts', dob: '1947-06-28', licenseNumber: '0000000', licenseState: 'AL' },
    ],
    notes: 'Mr. Shotts has a 1965 Chevy Truck he is wanting insured. The truck just sits most of the time so he just needs the bare minimum.',
  });

  const callDescription = formatInboundCallDescription({
    summary: 'Dennis Shots called to inquire about getting a quote for insuring a 1965 Chevrolet C10 pickup truck. He provided the vehicle\'s VIN and mentioned that the truck is driven occasionally.',
    actionItems: [
      'Submit the quote request for the 1965 Chevrolet C10 pickup truck',
      'Follow up with Dennis Shots regarding the quote',
    ],
    extractedData: { customerName: 'Dennis Shots' },
    callerPhone: '2056815526',
    customerName: 'Dennis Shots',
    durationSeconds: 615,
    transcript: '<p>TCDS, this is Stephanie.</p><p>Yes, sir. This is Dennis Shots.</p><p>Hey, how are you?</p><p>Okay.</p><p>Okay.</p><p>Okay.</p><p>Okay.</p><p>Okay.</p><p>Thank you, sir.</p>',
    isNCM: false,
  });

  // The combined description: quote on top, then call description
  const fullDesc = quoteSection + '\n\n' + callDescription;

  console.log('========== FULL TICKET DESCRIPTION ==========');
  console.log(fullDesc);
  console.log('========== END ==========');

  // Now actually update the ticket
  const azClient = getAgencyZoomClient();
  const result = await azClient.getServiceTickets({ serviceTicketIds: [9271444] });
  const ticket = result.data?.[0] as any;

  if (!ticket) {
    console.log('Ticket not found');
    process.exit(1);
  }

  // Reset and rerun the actual linker
  const { db } = await import('../src/db');
  const { quotes } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');

  await db.update(quotes).set({ azTicketNotePosted: false }).where(eq(quotes.id, 'b097c402-4e63-46ec-bff1-69444bf88ae1'));
  console.log('\nReset azTicketNotePosted to false');

  // First, update the ticket description to use the new inbound call format
  // (simulating what the transcript-worker would have created with the new format)
  const rawTranscript = ticket.serviceDesc || '';

  // Extract the raw transcript from the current description
  const transcriptMatch = rawTranscript.match(/(?:🗣️ Call Transcription|CALL TRANSCRIPTION)\s*[=]*\s*\n([\s\S]*)/);
  const existingTranscript = transcriptMatch ? transcriptMatch[1].trim() : '';

  // Extract the summary from the current description
  const summaryMatch = rawTranscript.match(/Summary:\s*(.+?)(?:\n|$)/);
  const existingSummary = summaryMatch ? summaryMatch[1] : 'Dennis Shots called to inquire about getting a quote.';

  // Rebuild the base ticket description with new format
  const newBaseDesc = formatInboundCallDescription({
    summary: 'Dennis Shots called to inquire about getting a quote for insuring a 1965 Chevrolet C10 pickup truck. He provided the vehicle\'s VIN and mentioned that the truck is driven occasionally.',
    actionItems: [
      'Submit the quote request for the 1965 Chevrolet C10 pickup truck',
      'Follow up with Dennis Shots regarding the quote',
    ],
    extractedData: { customerName: 'Dennis Shots' },
    callerPhone: '2056815526',
    customerName: 'Dennis Shots',
    durationSeconds: 615,
    transcript: existingTranscript || undefined,
    isNCM: false,
  });

  // Update ticket with new format (no quote yet - just the base call description)
  await azClient.updateServiceTicket(9271444, {
    customerId: ticket.householdId,
    workflowId: ticket.workflowId,
    workflowStageId: ticket.workflowStageId,
    csr: ticket.csr,
    subject: ticket.subject,
    priorityId: ticket.priorityId,
    categoryId: ticket.categoryId,
    description: newBaseDesc,
  });
  console.log('Updated ticket with new base format');

  // Now run the quote linker to prepend quote details
  const { attemptLinkQuoteToTicket } = await import('../src/lib/quote-ticket-linker');
  const linkResult = await attemptLinkQuoteToTicket('b097c402-4e63-46ec-bff1-69444bf88ae1');
  console.log('Quote link result:', linkResult);

  // Fetch and display final result
  const finalResult = await azClient.getServiceTickets({ serviceTicketIds: [9271444] });
  const finalTicket = finalResult.data?.[0] as any;
  console.log('\n========== FINAL TICKET DESCRIPTION ==========');
  console.log(finalTicket.serviceDesc);
  console.log('========== END ==========');

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
