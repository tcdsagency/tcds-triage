import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const QUOTE_ID = 'b097c402-4e63-46ec-bff1-69444bf88ae1';
const CALL_ID = '4fe6d032-e2ac-4b26-a6b5-ae1b8cd2b43f';

async function run() {
  const { db } = await import('../src/db');
  const { quotes } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { attemptLinkQuoteToTicket } = await import('../src/lib/quote-ticket-linker');

  // Reset the flag so we can re-test the updated logic
  console.log('Resetting az_ticket_note_posted to false...');
  await db
    .update(quotes)
    .set({ callId: CALL_ID, azTicketNotePosted: false, azTicketNoteError: null } as any)
    .where(eq(quotes.id, QUOTE_ID));

  // Run the linker
  console.log('Attempting to link quote to AZ ticket...');
  const result = await attemptLinkQuoteToTicket(QUOTE_ID);
  console.log('Result:', result);

  // Check final state
  const [final] = await db
    .select({ id: quotes.id, callId: quotes.callId, azTicketNotePosted: quotes.azTicketNotePosted, azTicketNoteError: quotes.azTicketNoteError })
    .from(quotes)
    .where(eq(quotes.id, QUOTE_ID));
  console.log('\nFinal quote state:', final);

  process.exit(0);
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
