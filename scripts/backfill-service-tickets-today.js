/**
 * Backfill Service Tickets — Today Only
 *
 * Creates service tickets for all eligible inbound calls today that:
 * 1. Have a wrapup draft with AI analysis completed
 * 2. Are NOT auto-voided (hangups, short calls)
 * 3. Do NOT already have a service ticket (via wrapup_draft_id join)
 * 4. Are NOT after-hours (those use a different pipeline)
 *
 * Mirrors the logic in call-completed webhook + createAutoTicketForPollCall()
 */

require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

// AgencyZoom constants
const SERVICE_PIPELINES = { POLICY_SERVICE: 30699 };
const PIPELINE_STAGES = { POLICY_SERVICE_NEW: 111160 };
const SERVICE_CATEGORIES = { GENERAL_SERVICE: 37345 };
const SERVICE_PRIORITIES = { STANDARD: 27902 };
const EMPLOYEE_IDS = { AI_AGENT: 114877 };
const SPECIAL_HOUSEHOLDS = { NCM_PLACEHOLDER: 22138921 };

const BR = '<br />';
const PBR = `<br />&nbsp;<br />`;

function getDefaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().split('T')[0];
}

function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function redactPII(text) {
  text = text.replace(/\b(\d[ -]?){12,18}\d\b/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) return `[CARD ****${digits.slice(-4)}]`;
    return match;
  });
  text = text.replace(/\b(\d{3})[-\s](\d{2})[-\s](\d{4})\b/g, '[SSN REDACTED]');
  text = text.replace(/\b(security code|cvv|cvc|verification)[\s:]*(\d{3,4})\b/gi, '$1 [CVV REDACTED]');
  text = text.replace(/\b(routing(?:\s+number)?)[\s:]*(\d{9})\b/gi, (_, prefix, digits) => `${prefix} [ROUTING ****${digits.slice(-4)}]`);
  text = text.replace(/\b(account(?:\s+number)?)[\s:]*(\d{4,17})\b/gi, (_, prefix, digits) => `${prefix} [ACCOUNT ****${digits.slice(-4)}]`);
  return text;
}

function cleanTranscriptHtml(raw) {
  let text = raw;
  text = text.replace(/<p>/gi, '').replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/^(.{1,20})\n(\1\n){2,}/gm, '$1\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = redactPII(text);
  text = text.trim();
  const htmlLines = text.split('\n').map(line => esc(line.trim())).filter(l => l.length > 0);
  return htmlLines.join(BR + '\n');
}

function formatTicketDescription({ summary, actionItems, extractedData, callerPhone, customerName, durationSeconds, transcript, isNCM }) {
  const parts = [];

  parts.push(`<b>🛠️ Service Request Details</b>${BR}`);
  parts.push(esc(summary || 'No summary available'));
  parts.push(PBR);

  const extractedParts = [];
  if (actionItems && actionItems.length > 0) {
    extractedParts.push(`Action Items:${BR}`);
    actionItems.forEach(item => extractedParts.push(`&bull; ${esc(item)}${BR}`));
  }
  if (extractedData) {
    if (extractedData.customerName) extractedParts.push(`Customer: ${esc(extractedData.customerName)}${BR}`);
    if (extractedData.policyNumber) extractedParts.push(`Policy: ${esc(extractedData.policyNumber)}${BR}`);
    if (extractedData.reason) extractedParts.push(`Reason: ${esc(extractedData.reason)}${BR}`);
  }
  if (extractedParts.length > 0) {
    parts.push(`<b>📊 Extracted Data from Call</b>${BR}`);
    parts.push(...extractedParts);
    parts.push(PBR);
  }

  parts.push(`<b>📞 Call Information</b>${BR}`);
  if (callerPhone) parts.push(`Phone Number: ${esc(callerPhone)}${PBR}`);
  if (durationSeconds != null) parts.push(`Call Duration: ${durationSeconds} seconds${PBR}`);
  if (isNCM && callerPhone) {
    parts.push(`Caller Information: ${esc(customerName || 'Unknown')}${BR}`);
    parts.push(`Phone Number: ${esc(callerPhone)}${PBR}`);
  }

  if (transcript) {
    parts.push(`<b>🗣️ Call Transcription</b>${BR}`);
    parts.push(cleanTranscriptHtml(transcript));
  }

  return parts.join('\n');
}

// =============================================================================
// AgencyZoom Auth + API
// =============================================================================

let authToken = null;

async function getAgencyZoomToken() {
  if (authToken) return authToken;
  const response = await fetch('https://app.agencyzoom.com/v1/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.AGENCYZOOM_API_USERNAME,
      password: process.env.AGENCYZOOM_API_PASSWORD,
      version: '1.0',
    }),
  });
  if (!response.ok) throw new Error(`Auth failed: ${response.status}`);
  const data = await response.json();
  authToken = data.jwt || data.token;
  return authToken;
}

async function createServiceTicket(token, ticketData) {
  const payload = {
    subject: ticketData.subject,
    description: ticketData.description,
    customerId: ticketData.customerId,
    householdId: ticketData.customerId,
    workflowId: ticketData.pipelineId,
    workflowStageId: ticketData.stageId,
    priorityId: ticketData.priorityId,
    categoryId: ticketData.categoryId,
    csr: ticketData.csrId,
    dueDate: ticketData.dueDate,
  };

  const response = await fetch('https://app.agencyzoom.com/v1/api/serviceTicket/service-tickets/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) return { success: false, error: responseText };

  try {
    const data = JSON.parse(responseText);
    return { success: true, serviceTicketId: data.id || data.serviceTicketId || data };
  } catch {
    return { success: true, serviceTicketId: responseText };
  }
}

// =============================================================================
// Main
// =============================================================================

async function backfill() {
  const DRY_RUN = process.argv.includes('--dry-run');
  if (DRY_RUN) console.log('🏜️  DRY RUN — no tickets will be created\n');

  console.log('=== Backfilling Service Tickets for Today ===\n');

  const tenantId = process.env.DEFAULT_TENANT_ID;

  // Find all eligible inbound calls TODAY that don't have a service ticket yet
  const eligibleCalls = await sql`
    SELECT
      c.id AS call_id,
      c.from_number,
      c.to_number,
      c.direction,
      c.duration_seconds,
      c.transcription,
      c.customer_id,
      c.agent_id,
      c.started_at,
      c.disposition,
      w.id AS wrapup_id,
      w.summary,
      w.customer_name,
      w.customer_phone,
      w.request_type,
      w.ai_extraction,
      w.match_status,
      w.status AS wrapup_status,
      w.agencyzoom_ticket_id,
      w.is_auto_voided
    FROM calls c
    JOIN wrapup_drafts w ON c.id = w.call_id
    LEFT JOIN service_tickets st ON st.wrapup_draft_id = w.id
    WHERE c.started_at >= CURRENT_DATE
      AND c.direction = 'inbound'
      AND w.ai_processing_status = 'completed'
      AND (w.is_auto_voided IS NULL OR w.is_auto_voided = false)
      AND (c.disposition IS NULL OR c.disposition != 'after_hours')
      AND st.id IS NULL
      AND (w.agencyzoom_ticket_id IS NULL OR w.agencyzoom_ticket_id = '')
    ORDER BY c.started_at ASC
  `;

  console.log(`Found ${eligibleCalls.length} inbound calls today without service tickets\n`);

  if (eligibleCalls.length === 0) {
    console.log('Nothing to do.');
    await sql.end();
    return;
  }

  // Show preview
  for (const call of eligibleCalls) {
    const time = call.started_at?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) || '??';
    const who = call.customer_name || call.customer_phone || call.from_number || 'Unknown';
    const dur = call.duration_seconds ? `${call.duration_seconds}s` : '?s';
    const status = call.wrapup_status || '?';
    console.log(`  ${time.padEnd(10)} ${who.substring(0, 35).padEnd(35)} ${dur.padStart(5)}  [${status}]`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('Dry run complete — exiting.');
    await sql.end();
    return;
  }

  // Authenticate with AgencyZoom
  console.log('Authenticating with AgencyZoom...');
  const token = await getAgencyZoomToken();
  console.log('✅ Authenticated\n');

  // Pre-load agent AZ IDs for CSR assignment
  const agents = await sql`
    SELECT id, first_name, last_name, agencyzoom_id
    FROM users
    WHERE tenant_id = ${tenantId}
      AND agencyzoom_id IS NOT NULL
  `;
  const agentMap = new Map();
  for (const a of agents) {
    agentMap.set(a.id, {
      csrId: parseInt(a.agencyzoom_id, 10),
      name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Agent',
    });
  }

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const call of eligibleCalls) {
    const callTime = call.started_at?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) || '??';
    const customerInfo = (call.customer_name || call.customer_phone || call.from_number || 'Unknown').substring(0, 30);

    process.stdout.write(`${callTime.padEnd(10)} ${customerInfo.padEnd(30)} `);

    // Phone validation
    const customerPhone = call.customer_phone || call.from_number;
    const callerDigits = (customerPhone || '').replace(/\D/g, '');
    const isPlayFile = (customerPhone || '').toLowerCase().includes('playfile');
    const hasValidPhone = customerPhone && customerPhone !== 'Unknown' && !isPlayFile
      && callerDigits.length >= 7 && callerDigits.length <= 11;
    const hasAIData = !!(call.customer_name || (call.summary && call.summary.length > 50));

    if (isPlayFile || (!hasValidPhone && !hasAIData)) {
      console.log('⏭️  skip (no valid phone/AI data)');
      skipCount++;
      continue;
    }

    // Customer lookup
    const phoneSuffix = callerDigits.slice(-10);
    let matchedAzCustomerId = null;
    let localCustomerId = call.customer_id || null;

    // Check AI extraction for AZ customer ID first
    const aiExtraction = call.ai_extraction || {};
    if (aiExtraction.agencyZoomCustomerId) {
      matchedAzCustomerId = parseInt(String(aiExtraction.agencyZoomCustomerId), 10);
      if (isNaN(matchedAzCustomerId) || matchedAzCustomerId <= 0) matchedAzCustomerId = null;
    }

    // Fallback: phone lookup
    if (!matchedAzCustomerId && hasValidPhone && phoneSuffix.length >= 7) {
      const [found] = await sql`
        SELECT id, agencyzoom_id FROM customers
        WHERE tenant_id = ${tenantId}
          AND (phone ILIKE ${'%' + phoneSuffix} OR phone_alt ILIKE ${'%' + phoneSuffix})
        LIMIT 1
      `;
      if (found?.agencyzoom_id) {
        matchedAzCustomerId = parseInt(found.agencyzoom_id, 10);
        localCustomerId = found.id;
        if (isNaN(matchedAzCustomerId) || matchedAzCustomerId <= 0) matchedAzCustomerId = null;
      }
    }

    // Phone-based dedup: skip if a ticket was created for this phone in the last hour
    if (hasValidPhone && phoneSuffix.length >= 7) {
      const [recentTicket] = await sql`
        SELECT st.id, st.az_ticket_id
        FROM service_tickets st
        JOIN wrapup_drafts wd ON st.wrapup_draft_id = wd.id
        WHERE st.tenant_id = ${tenantId}
          AND st.created_at > ${call.started_at} - INTERVAL '1 hour'
          AND st.created_at < ${call.started_at} + INTERVAL '1 hour'
          AND wd.customer_phone ILIKE ${'%' + phoneSuffix}
        LIMIT 1
      `;
      if (recentTicket) {
        console.log(`⏭️  skip (ticket AZ#${recentTicket.az_ticket_id} exists for same phone)`);
        skipCount++;
        continue;
      }
    }

    const azCustomerId = matchedAzCustomerId || SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER;

    // CSR assignment — prefer call's agent
    let assignedCsrId = EMPLOYEE_IDS.AI_AGENT;
    let assignedCsrName = 'AI Agent';
    if (call.agent_id && agentMap.has(call.agent_id)) {
      const agent = agentMap.get(call.agent_id);
      if (agent.csrId > 0) {
        assignedCsrId = agent.csrId;
        assignedCsrName = agent.name;
      }
    }

    // Build subject
    const extractedData = aiExtraction.extractedData || {};
    const actionItems = aiExtraction.actionItems || [];
    let callReason = call.summary || '';
    const firstSentenceEnd = callReason.search(/[.!?]/);
    if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
      callReason = callReason.substring(0, firstSentenceEnd);
    } else if (callReason.length > 60) {
      callReason = callReason.substring(0, 60).replace(/\s+\S*$/, '');
    }
    callReason = callReason.trim().replace(/^(the\s+)?(caller\s+)?(called\s+)?(about\s+)?/i, '');
    if (!callReason || callReason.length < 5) {
      callReason = aiExtraction.serviceRequestType || call.request_type || 'general inquiry';
    }

    const isNCM = !matchedAzCustomerId;
    const subjectSuffix = isNCM
      ? ` - ${call.customer_name || customerPhone || 'Unknown Caller'}`
      : '';
    const ticketSubject = `Inbound Call: ${callReason}${subjectSuffix}`;

    // Build description (matches formatInboundCallDescription)
    const ticketDescription = formatTicketDescription({
      summary: call.summary,
      actionItems,
      extractedData: {
        customerName: call.customer_name || extractedData.customerName || undefined,
        policyNumber: (aiExtraction.policyNumbers || []).join(', ') || extractedData.policyNumber || undefined,
      },
      callerPhone: customerPhone || undefined,
      customerName: call.customer_name || undefined,
      durationSeconds: call.duration_seconds,
      transcript: call.transcription || undefined,
      isNCM,
    });

    // Create ticket
    try {
      const result = await createServiceTicket(token, {
        subject: ticketSubject,
        description: ticketDescription,
        customerId: azCustomerId,
        pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
        stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
        priorityId: SERVICE_PRIORITIES.STANDARD,
        categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
        csrId: assignedCsrId,
        dueDate: getDefaultDueDate(),
      });

      if (result.success && result.serviceTicketId) {
        const azTicketId = typeof result.serviceTicketId === 'number'
          ? result.serviceTicketId
          : parseInt(String(result.serviceTicketId), 10);

        // Store ticket locally
        try {
          await sql`
            INSERT INTO service_tickets (
              tenant_id, az_ticket_id, az_household_id, wrapup_draft_id, customer_id,
              subject, description, status,
              pipeline_id, pipeline_name, stage_id, stage_name,
              category_id, category_name, priority_id, priority_name,
              csr_id, csr_name, due_date, az_created_at, source, last_synced_from_az
            ) VALUES (
              ${tenantId}, ${azTicketId}, ${azCustomerId}, ${call.wrapup_id}, ${localCustomerId},
              ${ticketSubject}, ${ticketDescription}, 'active',
              ${SERVICE_PIPELINES.POLICY_SERVICE}, 'Policy Service',
              ${PIPELINE_STAGES.POLICY_SERVICE_NEW}, 'New',
              ${SERVICE_CATEGORIES.GENERAL_SERVICE}, 'General Service',
              ${SERVICE_PRIORITIES.STANDARD}, 'Standard',
              ${assignedCsrId}, ${assignedCsrName},
              ${getDefaultDueDate()}, NOW(), 'backfill', NOW()
            )
          `;
        } catch (dbErr) {
          // Ignore duplicate key errors
          if (!dbErr.message?.includes('duplicate')) {
            console.error(`  DB error: ${dbErr.message}`);
          }
        }

        // Update wrapup — mark completed with ticket
        await sql`
          UPDATE wrapup_drafts SET
            status = 'completed',
            outcome = 'ticket',
            agencyzoom_ticket_id = ${String(azTicketId)},
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${call.wrapup_id}
            AND (agencyzoom_ticket_id IS NULL OR agencyzoom_ticket_id = '')
        `;

        const target = isNCM ? 'NCM' : `AZ#${azCustomerId}`;
        console.log(`✅ Ticket AZ#${azTicketId} → ${target} (CSR: ${assignedCsrName})`);
        successCount++;
      } else {
        console.log(`❌ ${(result.error || 'Unknown error').substring(0, 60)}`);
        failCount++;
      }
    } catch (err) {
      console.log(`❌ ${err.message?.substring(0, 60)}`);
      failCount++;
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Created: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed:  ${failCount}`);
  console.log(`   Total:   ${eligibleCalls.length}`);

  await sql.end();
}

backfill().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
