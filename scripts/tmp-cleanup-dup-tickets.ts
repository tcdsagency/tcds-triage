require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { serviceTickets, wrapupDrafts } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');

  const azClient = getAgencyZoomClient();

  // Duplicate AZ ticket IDs to remove:
  //
  // 2565952468 (Caleb Cupp):
  //   KEEP: AZ#9217533 (Feb 9, past due balance - unique)
  //   KEEP: AZ#9236308 (update car - keep one)
  //   KEEP: AZ#9236397 (insurance card request - inbound_call)
  //   REMOVE: AZ#9236309 (duplicate of 9236308 - same "update car" topic)
  //   REMOVE: AZ#9236332 (erroneous extra ticket on same wrapup as 9236397)
  //   REMOVE: AZ#9236479 (mssql_poll duplicate of 9236397 - insurance cards)
  //
  // 2059993840 (Cheryl Gafford):
  //   KEEP: AZ#9236258 (inbound_call, matched to customer)
  //   REMOVE: AZ#9236310 (mssql_poll duplicate, unmatched)

  const duplicateAzTicketIds = [9236309, 9236332, 9236479, 9236310];

  for (const azTicketId of duplicateAzTicketIds) {
    console.log(`\n--- Processing AZ#${azTicketId} ---`);

    // 1. Find local record
    const [local] = await db
      .select()
      .from(serviceTickets)
      .where(eq(serviceTickets.azTicketId, azTicketId))
      .limit(1);

    if (local) {
      console.log(`  Local: ${local.id.slice(0, 8)} | ${local.subject}`);
      console.log(`  Source: ${local.source} | Wrapup: ${local.wrapupDraftId?.slice(0, 8) || 'none'}`);

      // 2. Remove from AgencyZoom (set status to REMOVED=0)
      try {
        const result = await azClient.updateServiceTicket(azTicketId, { status: 0 });
        console.log(`  AZ: Removed (status=0) - ${result.success ? 'OK' : 'FAILED'}`);
      } catch (err: any) {
        console.error(`  AZ: Failed to remove - ${err.message}`);
      }

      // 3. Delete local record
      await db.delete(serviceTickets).where(eq(serviceTickets.id, local.id));
      console.log(`  Local: Deleted`);
    } else {
      console.log(`  No local record found, removing from AZ only...`);
      try {
        const result = await azClient.updateServiceTicket(azTicketId, { status: 0 });
        console.log(`  AZ: Removed (status=0) - ${result.success ? 'OK' : 'FAILED'}`);
      } catch (err: any) {
        console.error(`  AZ: Failed to remove - ${err.message}`);
      }
    }
  }

  console.log('\nDone! Cleaned up', duplicateAzTicketIds.length, 'duplicate tickets.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
