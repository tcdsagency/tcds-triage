require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function main() {
  // Check when tickets were created vs when the agent assignment code was deployed
  console.log('=== Ticket Creation Timing ===\n');

  const tickets = await sql`
    SELECT
      az_ticket_id,
      subject,
      csr_id,
      csr_name,
      created_at
    FROM service_tickets
    WHERE source = 'inbound_call'
    AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
  `;

  tickets.forEach(t => {
    console.log(new Date(t.created_at).toLocaleString() + ': Ticket ' + t.az_ticket_id);
    console.log('   CSR: ' + (t.csr_name || 'NULL') + ' (ID: ' + t.csr_id + ')');
    console.log('   Subject: ' + t.subject.substring(0, 50));
  });

  // Check eligible calls that didn't get tickets
  console.log('\n=== Eligible Calls Without Tickets ===\n');

  const callsWithWrapups = await sql`
    SELECT
      c.id,
      c.from_number,
      c.duration_seconds,
      c.started_at,
      w.customer_name,
      w.ai_processing_status,
      w.is_auto_voided
    FROM calls c
    JOIN wrapup_drafts w ON c.id = w.call_id
    WHERE c.started_at > NOW() - INTERVAL '24 hours'
    AND c.direction = 'inbound'
    AND c.duration_seconds >= 30
    AND w.ai_processing_status = 'completed'
    AND (w.is_auto_voided IS NULL OR w.is_auto_voided = false)
    ORDER BY c.started_at DESC
  `;

  // Get ticket subjects
  const ticketSubjects = tickets.map(t => t.subject.toLowerCase());

  const eligibleWithoutTickets = callsWithWrapups.filter(c => {
    const name = (c.customer_name || '').toLowerCase();
    // Check if any ticket contains this customer name
    return !ticketSubjects.some(subj => name && subj.includes(name));
  });

  console.log('Found ' + eligibleWithoutTickets.length + ' potentially missed calls:\n');
  eligibleWithoutTickets.slice(0, 10).forEach(c => {
    console.log(c.from_number + ' (' + c.duration_seconds + 's) @ ' + new Date(c.started_at).toLocaleString());
    console.log('   Customer: ' + (c.customer_name || 'Unknown'));
  });

  // Check users table for AZ IDs
  console.log('\n=== Users with AgencyZoom IDs ===\n');

  const users = await sql`
    SELECT
      first_name || ' ' || last_name as name,
      extension,
      agencyzoom_id,
      role
    FROM users
    WHERE is_active = true
    ORDER BY first_name
  `;

  users.forEach(u => {
    const azStatus = u.agencyzoom_id ? 'AZ: ' + u.agencyzoom_id : 'NO AZ ID';
    console.log(u.name.padEnd(25) + ' ext: ' + (u.extension || 'none').padEnd(6) + ' ' + azStatus);
  });

  // Check tenant feature flag
  console.log('\n=== Auto-Create Feature Status ===\n');

  const tenant = await sql`
    SELECT name, features FROM tenants LIMIT 1
  `;

  if (tenant[0]) {
    const features = tenant[0].features || {};
    console.log('Tenant: ' + tenant[0].name);
    console.log('autoCreateServiceTickets: ' + (features.autoCreateServiceTickets === true ? 'ENABLED' : 'DISABLED'));
  }

  // Check the deployment timing issue
  console.log('\n=== Agent Assignment Analysis ===\n');

  const aiAgentId = 114877;
  const aiAgentTickets = tickets.filter(t => t.csr_id === aiAgentId);
  const agentAssignedTickets = tickets.filter(t => t.csr_id !== aiAgentId);

  console.log('Tickets assigned to AI Agent (114877): ' + aiAgentTickets.length);
  console.log('Tickets assigned to other agents: ' + agentAssignedTickets.length);

  if (aiAgentTickets.length > 0 && agentAssignedTickets.length === 0) {
    console.log('\n** All tickets assigned to AI Agent - the agent assignment code');
    console.log('   was deployed AFTER these tickets were created. New tickets');
    console.log('   should be assigned to the call agent.');
  }

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
