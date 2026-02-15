require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { wrapupDrafts } = await import('../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { getAgencyZoomClient } = await import('../src/lib/api/agencyzoom');
  const {
    SERVICE_PIPELINES,
    PIPELINE_STAGES,
    SERVICE_CATEGORIES,
    SERVICE_PRIORITIES,
    EMPLOYEE_IDS,
  } = await import('../src/lib/api/agencyzoom-service-tickets');

  const azClient = getAgencyZoomClient();

  // Robert Mishoe's cancellation call wrapup
  const wrapupId = '1c065a75-ac81-4aef-b5c6-8e8db40cd981';
  const azCustomerId = 16925266;

  const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.id, wrapupId));

  if (!wrapup) {
    console.log('Wrapup not found');
    return;
  }

  console.log('Creating service ticket for Robert Mishoe cancellation call...');
  console.log('Summary:', wrapup.summary);

  // Create the service ticket
  const result = await azClient.createServiceTicket({
    subject: 'Cancellation Request - Home sold in Alabama',
    description: wrapup.summary || 'Cancellation request - see notes',
    customerId: azCustomerId,
    pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
    stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
    priorityId: SERVICE_PRIORITIES.STANDARD,
    categoryId: SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING,
    csrId: EMPLOYEE_IDS.STEPHANIE_GOODMAN, // Stephanie handled the call
  });

  console.log('\nResult:', JSON.stringify(result, null, 2));

  if (result.success && result.serviceTicketId) {
    // Update wrapup with ticket info
    await db.update(wrapupDrafts)
      .set({
        serviceTicketCreated: true,
        agencyzoomTicketId: result.serviceTicketId.toString(),
      })
      .where(eq(wrapupDrafts.id, wrapupId));

    console.log('\nUpdated wrapup with ticket ID:', result.serviceTicketId);
  }
}

run().catch(e => console.error(e));
