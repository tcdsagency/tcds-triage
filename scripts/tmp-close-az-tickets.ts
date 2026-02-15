require('dotenv').config({ path: '.env.local' });

async function main() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();

  const duplicateAzTicketIds = [9236309, 9236332, 9236479, 9236310];

  for (const azTicketId of duplicateAzTicketIds) {
    console.log(`\nClosing AZ#${azTicketId}...`);
    try {
      // Set status to COMPLETED (2) and update subject to mark as duplicate
      const result = await azClient.updateServiceTicket(azTicketId, {
        status: 2,
        subject: `[DUPLICATE - CLOSED] AZ#${azTicketId}`,
      });
      console.log(`  Result: ${result.success ? 'OK' : 'FAILED'}`, JSON.stringify(result));
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
