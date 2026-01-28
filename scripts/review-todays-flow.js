require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function main() {
  console.log('=== Today\'s Call & Ticket Flow Analysis ===\n');

  // Get today's calls
  const calls = await sql`
    SELECT
      c.id,
      c.direction,
      c.from_number,
      c.to_number,
      c.duration_seconds,
      c.status,
      c.started_at,
      c.agent_id,
      c.customer_id,
      c.extension,
      u.first_name || ' ' || u.last_name as agent_name,
      u.agencyzoom_id as agent_az_id
    FROM calls c
    LEFT JOIN users u ON c.agent_id = u.id
    WHERE c.started_at > NOW() - INTERVAL '24 hours'
    ORDER BY c.started_at DESC
  `;

  console.log(`Total calls in last 24h: ${calls.length}\n`);

  // Break down by direction
  const inbound = calls.filter(c => c.direction === 'inbound');
  const outbound = calls.filter(c => c.direction === 'outbound');
  console.log(`  Inbound: ${inbound.length}`);
  console.log(`  Outbound: ${outbound.length}\n`);

  // Get wrapups for these calls
  const wrapups = await sql`
    SELECT
      w.call_id,
      w.customer_name,
      w.customer_phone,
      w.summary,
      w.ai_processing_status,
      w.is_auto_voided,
      w.reviewer_decision,
      w.note_auto_posted,
      w.ai_extraction
    FROM wrapup_drafts w
    JOIN calls c ON w.call_id = c.id
    WHERE c.started_at > NOW() - INTERVAL '24 hours'
  `;

  console.log(`Wrapups created: ${wrapups.length}`);
  const completed = wrapups.filter(w => w.ai_processing_status === 'completed');
  const voided = wrapups.filter(w => w.is_auto_voided === true);
  const posted = wrapups.filter(w => w.note_auto_posted === true);
  console.log(`  AI Completed: ${completed.length}`);
  console.log(`  Auto-voided (hangups): ${voided.length}`);
  console.log(`  Notes auto-posted: ${posted.length}\n`);

  // Get today's service tickets
  const tickets = await sql`
    SELECT
      st.az_ticket_id,
      st.subject,
      st.az_household_id,
      st.csr_id,
      st.csr_name,
      st.source,
      st.created_at
    FROM service_tickets st
    WHERE st.created_at > NOW() - INTERVAL '24 hours'
    AND st.source = 'inbound_call'
    ORDER BY st.created_at DESC
  `;

  console.log(`Service tickets created: ${tickets.length}`);
  const ncmTickets = tickets.filter(t => t.az_household_id === 22138921);
  const matchedTickets = tickets.filter(t => t.az_household_id !== 22138921);
  console.log(`  Matched to customer: ${matchedTickets.length}`);
  console.log(`  NCM (No Customer Match): ${ncmTickets.length}\n`);

  // CSR assignment breakdown
  const csrCounts = {};
  tickets.forEach(t => {
    const name = t.csr_name || `CSR ID ${t.csr_id}`;
    csrCounts[name] = (csrCounts[name] || 0) + 1;
  });
  if (Object.keys(csrCounts).length > 0) {
    console.log('Ticket assignments by CSR:');
    Object.entries(csrCounts).forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });
    console.log('');
  }

  // Analyze inbound calls
  console.log('=== Detailed Analysis ===\n');

  // Inbound calls that should have gotten tickets
  const eligibleCalls = inbound.filter(c => c.duration_seconds >= 30);
  console.log(`Inbound calls >= 30s (eligible for tickets): ${eligibleCalls.length}`);

  // Check agent matching
  const callsWithAgent = inbound.filter(c => c.agent_id);
  const callsWithoutAgent = inbound.filter(c => !c.agent_id);
  console.log(`\nAgent Assignment:`);
  console.log(`  Calls with agent matched: ${callsWithAgent.length}`);
  console.log(`  Calls without agent: ${callsWithoutAgent.length}`);

  // Check agents who have AZ IDs
  const agentsWithAzId = callsWithAgent.filter(c => c.agent_az_id);
  const agentsMissingAz = callsWithAgent.filter(c => !c.agent_az_id);
  console.log(`  Agents with AZ CSR ID: ${agentsWithAzId.length}`);
  console.log(`  Agents missing AZ CSR ID: ${agentsMissingAz.length}`);

  // Show calls without agents
  if (callsWithoutAgent.length > 0) {
    console.log('\nCalls without agent assignment:');
    callsWithoutAgent.slice(0, 5).forEach(c => {
      console.log(`  ${c.from_number} -> ${c.to_number} (ext: ${c.extension || 'none'}, ${c.duration_seconds}s)`);
    });
    if (callsWithoutAgent.length > 5) {
      console.log(`  ... and ${callsWithoutAgent.length - 5} more`);
    }
  }

  // Show agents missing AZ IDs
  if (agentsMissingAz.length > 0) {
    console.log('\nAgents missing AgencyZoom CSR ID:');
    const uniqueAgents = [...new Set(agentsMissingAz.map(c => c.agent_name).filter(Boolean))];
    uniqueAgents.forEach(name => {
      const count = agentsMissingAz.filter(c => c.agent_name === name).length;
      console.log(`  ${name}: ${count} calls`);
    });
  }

  // NCM ticket details
  if (ncmTickets.length > 0) {
    console.log('\nNCM Tickets (need customer assignment):');
    ncmTickets.forEach(t => {
      console.log(`  ${t.az_ticket_id}: ${t.subject.substring(0, 60)}`);
    });
  }

  // Show sample of today's flow
  console.log('\n=== Recent Inbound Call Examples ===\n');

  for (const call of inbound.slice(0, 8)) {
    const wrapup = wrapups.find(w => w.call_id === call.id);

    console.log(`${call.from_number} (${call.duration_seconds}s) @ ${new Date(call.started_at).toLocaleTimeString()}`);
    console.log(`   Agent: ${call.agent_name || 'Not matched'}${call.agent_az_id ? ' [AZ:' + call.agent_az_id + ']' : ' [No AZ ID]'}`);
    if (wrapup) {
      console.log(`   Wrapup: ${wrapup.is_auto_voided ? 'Auto-voided' : wrapup.ai_processing_status}`);
      console.log(`   Customer: ${wrapup.customer_name || 'Unknown'}`);
    } else {
      console.log(`   Wrapup: None`);
    }
    console.log('');
  }

  // Potential improvements
  console.log('=== Potential Improvements Identified ===\n');

  const improvements = [];

  if (callsWithoutAgent.length > 0) {
    improvements.push({
      issue: `${callsWithoutAgent.length} inbound calls had no agent matched`,
      cause: 'May be IVR/after-hours calls or extension mapping issues',
      suggestion: 'Review extension mappings in users table'
    });
  }

  if (agentsMissingAz.length > 0) {
    const uniqueAgents = [...new Set(agentsMissingAz.map(c => c.agent_name).filter(Boolean))];
    improvements.push({
      issue: `${uniqueAgents.length} agent(s) missing AgencyZoom CSR ID`,
      cause: `Agents: ${uniqueAgents.join(', ')}`,
      suggestion: 'Add agencyzoom_id to users table for these agents so tickets are assigned to them'
    });
  }

  if (ncmTickets.length > 0) {
    improvements.push({
      issue: `${ncmTickets.length} tickets assigned to NCM placeholder`,
      cause: 'Caller phone not found in customer database',
      suggestion: 'Sync more customers to local DB or improve phone matching'
    });
  }

  // Check if any completed wrapups didn't get tickets
  const completedInbound = completed.filter(w => {
    const call = inbound.find(c => c.id === w.call_id);
    return call && call.duration_seconds >= 30 && !w.is_auto_voided;
  });

  if (completedInbound.length > tickets.length) {
    improvements.push({
      issue: `${completedInbound.length} eligible wrapups but only ${tickets.length} tickets created`,
      cause: 'Some calls may have completed before auto-ticket feature was enabled',
      suggestion: 'Consider backfilling tickets for older calls if needed'
    });
  }

  if (improvements.length === 0) {
    console.log('No significant issues identified! The flow is working well.');
  } else {
    improvements.forEach((imp, i) => {
      console.log(`${i + 1}. ISSUE: ${imp.issue}`);
      console.log(`   CAUSE: ${imp.cause}`);
      console.log(`   FIX: ${imp.suggestion}`);
      console.log('');
    });
  }

  // Summary stats
  console.log('=== Summary Stats ===\n');
  const ticketRate = eligibleCalls.length > 0 ? ((tickets.length / eligibleCalls.length) * 100).toFixed(1) : 0;
  const matchRate = tickets.length > 0 ? ((matchedTickets.length / tickets.length) * 100).toFixed(1) : 0;
  const agentMatchRate = inbound.length > 0 ? ((callsWithAgent.length / inbound.length) * 100).toFixed(1) : 0;

  console.log(`Ticket creation rate: ${ticketRate}% (${tickets.length}/${eligibleCalls.length} eligible calls)`);
  console.log(`Customer match rate: ${matchRate}% (${matchedTickets.length}/${tickets.length} tickets)`);
  console.log(`Agent match rate: ${agentMatchRate}% (${callsWithAgent.length}/${inbound.length} inbound calls)`);

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
