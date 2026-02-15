import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();

  // Find tickets with categoryId 82573 and 115762 to see what they are
  const result = await azClient.getServiceTickets({ limit: 50 });

  console.log('Tickets with cat 82573:');
  for (const t of result.data.filter((t: any) => t.categoryId === 82573)) {
    const ticket = t as any;
    console.log(`  #${ticket.id}: "${ticket.subject}" | catName: ${ticket.categoryName}`);
  }

  console.log('\nTickets with cat 115762:');
  for (const t of result.data.filter((t: any) => t.categoryId === 115762)) {
    const ticket = t as any;
    console.log(`  #${ticket.id}: "${ticket.subject}" | catName: ${ticket.categoryName}`);
  }

  // Try to get the category name by creating a test search with that category filter
  const cat82573 = await azClient.getServiceTickets({ limit: 1 });

  // Let's just try the ticket #8856307 which had cat 82573
  const specific = await azClient.getServiceTickets({ serviceTicketIds: [8856307] });
  if (specific.data[0]) {
    const t = specific.data[0] as any;
    console.log('\nTicket #8856307 full category info:', {
      categoryId: t.categoryId,
      categoryName: t.categoryName,
      subject: t.subject,
    });
  }

  // Also try 8855655 which had cat 115762
  const specific2 = await azClient.getServiceTickets({ serviceTicketIds: [8855655] });
  if (specific2.data[0]) {
    const t = specific2.data[0] as any;
    console.log('\nTicket #8855655 full category info:', {
      categoryId: t.categoryId,
      categoryName: t.categoryName,
      subject: t.subject,
    });
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
