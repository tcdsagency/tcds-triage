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
    getDefaultDueDate
  } = await import('../src/lib/api/agencyzoom-service-tickets');

  const azClient = getAgencyZoomClient();

  // Dwight Bronson's payment call wrapup
  const wrapupId = '15429c49-2791-47ef-b120-3b5adbc197ed';
  const azCustomerId = 25399083;

  const [wrapup] = await db.select().from(wrapupDrafts).where(eq(wrapupDrafts.id, wrapupId));

  if (!wrapup) {
    console.log('Wrapup not found');
    return;
  }

  console.log('Creating service ticket for Dwight Bronson payment call...');
  console.log('Summary:', wrapup.summary);

  // Create the service ticket
  const result = await azClient.createServiceTicket({
    subject: 'Payment - Partial payment made, balance due 2/24',
    description: wrapup.summary || 'Payment call - see notes',
    customerId: azCustomerId,
    pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
    stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
    priorityId: SERVICE_PRIORITIES.STANDARD,
    categoryId: SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS,
    csrId: EMPLOYEE_IDS.LEE_TIDWELL, // Lee handled the call
    dueDate: '2026-02-24', // Balance due date from call
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
