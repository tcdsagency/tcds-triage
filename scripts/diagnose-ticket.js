require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function diagnose() {
  const tenantId = process.env.DEFAULT_TENANT_ID;

  // Get a recent wrapup that should have created a ticket
  console.log('=== Diagnosing Ticket Creation Issue ===\n');

  // 1. Check tenant feature flag
  console.log('1. FEATURE FLAG CHECK:');
  const [tenant] = await sql`
    SELECT name, features FROM tenants WHERE id = ${tenantId}
  `;
  const features = tenant?.features || {};
  const autoCreateEnabled = features.autoCreateServiceTickets === true;
  console.log(`   Tenant: ${tenant?.name}`);
  console.log(`   autoCreateServiceTickets: ${autoCreateEnabled ? 'ENABLED ✓' : 'DISABLED ✗'}`);

  if (!autoCreateEnabled) {
    console.log('\n   *** THIS IS THE ISSUE: Feature is disabled! ***');
    console.log('   Run: node scripts/enable-auto-tickets.js');
    await sql.end();
    return;
  }

  // 2. Get recent wrapups with their call details
  console.log('\n2. RECENT WRAPUPS (checking conditions):');
  const wrapups = await sql`
    SELECT
      w.id as wrapup_id,
      w.call_id,
      w.ai_processing_status,
      w.is_auto_voided,
      w.customer_name,
      w.created_at,
      c.direction,
      c.from_number,
      c.duration_seconds,
      c.external_call_id
    FROM wrapup_drafts w
    JOIN calls c ON c.id = w.call_id
    WHERE w.created_at > NOW() - INTERVAL '6 hours'
    AND c.direction = 'inbound'
    ORDER BY w.created_at DESC
    LIMIT 5
  `;

  for (const w of wrapups) {
    console.log(`\n   Wrapup: ${w.wrapup_id}`);
    console.log(`   Call ID: ${w.call_id}`);
    console.log(`   Phone: ${w.from_number} (${w.duration_seconds}s)`);
    console.log(`   Customer: ${w.customer_name || 'Unknown'}`);
    console.log(`   Created: ${new Date(w.created_at).toLocaleString()}`);

    // Check conditions
    const hasWrapup = true; // Obviously exists
    const hasAnalysis = w.ai_processing_status === 'completed';
    const isInbound = w.direction === 'inbound';
    const isAutoVoided = w.is_auto_voided === true;

    console.log('\n   CONDITIONS:');
    console.log(`   - wrapup exists: ${hasWrapup ? '✓' : '✗'}`);
    console.log(`   - AI analysis: ${hasAnalysis ? '✓ (completed)' : '✗ (' + w.ai_processing_status + ')'}`);
    console.log(`   - direction: ${isInbound ? '✓ (inbound)' : '✗ (' + w.direction + ')'}`);
    console.log(`   - auto-voided: ${isAutoVoided ? '✗ (YES - will skip)' : '✓ (NO)'}`);

    // Check phone number validity
    const callerDigits = (w.from_number || '').replace(/\D/g, '');
    const isInternalOrTest =
      !w.from_number ||
      w.from_number === 'Unknown' ||
      w.from_number === 'PlayFile' ||
      w.from_number.toLowerCase().includes('playfile') ||
      callerDigits.length < 7 ||
      callerDigits.length > 11;

    console.log(`\n   PHONE CHECK:`);
    console.log(`   - Raw: "${w.from_number}"`);
    console.log(`   - Digits only: "${callerDigits}" (length: ${callerDigits.length})`);
    console.log(`   - Is internal/test: ${isInternalOrTest ? '✗ YES - will skip!' : '✓ NO'}`);

    // Check if ticket exists
    const [existingTicket] = await sql`
      SELECT id, az_ticket_id, subject
      FROM service_tickets
      WHERE source = 'inbound_call'
      AND created_at > ${new Date(w.created_at).toISOString()}::timestamp - INTERVAL '5 minutes'
      AND created_at < ${new Date(w.created_at).toISOString()}::timestamp + INTERVAL '5 minutes'
      LIMIT 1
    `;

    console.log(`\n   TICKET STATUS:`);
    if (existingTicket) {
      console.log(`   - Ticket exists: ✓ (AZ#${existingTicket.az_ticket_id})`);
    } else {
      console.log(`   - Ticket exists: ✗ NO TICKET CREATED`);
    }

    // Summary
    const allConditionsMet = hasWrapup && hasAnalysis && isInbound && !isAutoVoided && autoCreateEnabled && !isInternalOrTest;
    console.log(`\n   SHOULD CREATE TICKET: ${allConditionsMet ? '✓ YES' : '✗ NO'}`);
    if (!allConditionsMet && !existingTicket) {
      console.log(`   *** ISSUE: Conditions should be met but no ticket! ***`);
    }
  }

  // 3. Check for any recent sync errors
  console.log('\n\n3. RECENT API ERRORS:');
  const errors = await sql`
    SELECT entity_type, status, error_message, created_at
    FROM sync_logs
    WHERE status = 'failed'
    AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 5
  `;

  if (errors.length === 0) {
    console.log('   No recent API errors found');
  } else {
    errors.forEach(e => {
      console.log(`   ${new Date(e.created_at).toLocaleString()}: ${e.entity_type} - ${e.error_message}`);
    });
  }

  // 4. Check deployment timing
  console.log('\n\n4. DEPLOYMENT TIMING:');
  const lastTicket = await sql`
    SELECT az_ticket_id, created_at, subject
    FROM service_tickets
    WHERE source = 'inbound_call'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (lastTicket.length > 0) {
    const t = lastTicket[0];
    console.log(`   Last ticket created: ${new Date(t.created_at).toLocaleString()}`);
    console.log(`   Ticket: AZ#${t.az_ticket_id}`);

    const timeSinceLastTicket = (Date.now() - new Date(t.created_at).getTime()) / 1000 / 60;
    console.log(`   Time since last ticket: ${Math.round(timeSinceLastTicket)} minutes ago`);

    if (timeSinceLastTicket > 60) {
      console.log(`\n   *** WARNING: No tickets created in over an hour! ***`);
      console.log(`   Check Vercel deployment logs for errors.`);
    }
  } else {
    console.log('   No tickets found from inbound calls');
  }

  await sql.end();
}

diagnose().catch(e => { console.error(e); process.exit(1); });
