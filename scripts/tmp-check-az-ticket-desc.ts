import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const azClient = getAgencyZoomClient();

  console.log('Fetching ticket #9271444...');
  const result = await azClient.getServiceTickets({ serviceTicketIds: [9271444] });
  console.log('Total:', result.total, '| Data count:', result.data?.length);

  const ticket = result.data?.[0] as any;
  if (!ticket) {
    console.log('No ticket returned');
    process.exit(1);
  }

  console.log('Subject:', ticket.subject);
  console.log('Stage:', ticket.workflowStageName);
  console.log('CSR:', ticket.csrFirstname, ticket.csrLastname);
  console.log('Created:', ticket.createDate);
  console.log('');
  console.log('========== DESCRIPTION ==========');
  console.log(ticket.serviceDesc || '(empty)');
  console.log('========== END DESCRIPTION ==========');

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
