// Load env BEFORE any other imports
require('dotenv').config({ path: '.env.local' });

async function main() {
  // Dynamic imports after env is loaded
  const { db } = await import('../src/db');
  const { wrapupDrafts, serviceTickets } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const {
    SERVICE_PIPELINES,
    PIPELINE_STAGES,
    SERVICE_CATEGORIES,
    SERVICE_PRIORITIES,
    SPECIAL_HOUSEHOLDS,
    getDefaultDueDate,
  } = await import('../src/lib/api/agencyzoom-service-tickets');

  const WRAPUP_ID = 'db127319-3793-4684-8096-528de96d5b4f';
  const TENANT_ID = '062c4693-96b2-4000-814b-04c2a334ebeb';
  const LEE_TIDWELL_AZ_ID = 94007;
  const LEE_TIDWELL_NAME = 'Lee Tidwell';

  const azClient = getAgencyZoomClient();

  const summary = "Herbert Singles called to inquire about roof damage on his property. He explained that a friend inspected the roof and found multiple holes and soft spots, indicating potential water damage. The agent informed him about the possibility of filing a claim, noting that improper installation could lead to denial. They discussed the importance of documenting the damage and the need for an adjuster to assess the situation. The agent advised Herbert to tarp the roof to prevent further damage and provided details about the claims process. Herbert agreed to file the claim and was informed that he would be contacted by the insurance company within a few days.";

  const actionItems = [
    "File the claim with Universal Property and Casualty.",
    "Tarp the roof to prevent further damage.",
    "Keep the roofer updated on the claim process.",
    "Await contact from the insurance adjuster."
  ];

  let ticketDescription = `📞 Inbound Call - AI Processed\n\n`;
  ticketDescription += `Summary: ${summary}\n\n`;
  ticketDescription += `Action Items:\n`;
  actionItems.forEach(item => {
    ticketDescription += `• ${item}\n`;
  });
  ticketDescription += `\nCall Duration: 1686s`;
  ticketDescription += `\nCaller: 2563477030`;
  ticketDescription += `\n\n--- Original Caller Info ---`;
  ticketDescription += `\nPhone: 2563477030`;
  ticketDescription += `\nName: Herbert Singles`;

  const ticketSubject = `Inbound Call: roof damage claim inquiry - Herbert Singles`;

  console.log('Creating service ticket in AgencyZoom...');
  console.log(`  Subject: ${ticketSubject}`);
  console.log(`  Assigned to: ${LEE_TIDWELL_NAME} (CSR ID: ${LEE_TIDWELL_AZ_ID})`);
  console.log(`  Customer: NCM Placeholder (${SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER})`);

  const ticketResult = await azClient.createServiceTicket({
    subject: ticketSubject,
    description: ticketDescription,
    customerId: SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER,
    pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
    stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
    priorityId: SERVICE_PRIORITIES.STANDARD,
    categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
    csrId: LEE_TIDWELL_AZ_ID,
    dueDate: getDefaultDueDate(),
  });

  console.log('\nAZ API Response:', JSON.stringify(ticketResult, null, 2));

  if (ticketResult.success || ticketResult.serviceTicketId) {
    const azTicketId = ticketResult.serviceTicketId!;
    console.log(`\n✅ Service ticket created: ${azTicketId}`);

    // Store ticket locally
    await db.insert(serviceTickets).values({
      tenantId: TENANT_ID,
      azTicketId: azTicketId,
      azHouseholdId: SPECIAL_HOUSEHOLDS.NCM_PLACEHOLDER,
      wrapupDraftId: WRAPUP_ID,
      customerId: null,
      subject: ticketSubject,
      description: ticketDescription,
      status: 'active',
      pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
      pipelineName: 'Policy Service',
      stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
      stageName: 'New',
      categoryId: SERVICE_CATEGORIES.GENERAL_SERVICE,
      categoryName: 'General Service',
      priorityId: SERVICE_PRIORITIES.STANDARD,
      priorityName: 'Standard',
      csrId: LEE_TIDWELL_AZ_ID,
      csrName: LEE_TIDWELL_NAME,
      dueDate: getDefaultDueDate(),
      azCreatedAt: new Date(),
      source: 'inbound_call',
      lastSyncedFromAz: new Date(),
    });
    console.log('✅ Ticket stored locally in service_tickets table');

    // Update wrapup draft
    await db
      .update(wrapupDrafts)
      .set({
        status: 'completed',
        outcome: 'ticket',
        agencyzoomTicketId: azTicketId.toString(),
        completionAction: 'ticket',
        updatedAt: new Date(),
      })
      .where(eq(wrapupDrafts.id, WRAPUP_ID));
    console.log('✅ Wrapup draft marked as completed with ticket');

    console.log(`\nDone! Service ticket ${azTicketId} assigned to ${LEE_TIDWELL_NAME}`);
  } else {
    console.error('❌ Failed to create service ticket:', ticketResult.error);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
