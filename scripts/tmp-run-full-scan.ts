require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { riskMonitorSettings, riskMonitorPolicies } = await import('../src/db/schema');
  const { eq, sql } = await import('drizzle-orm');
  const { createRiskMonitorScheduler } = await import('../src/lib/riskMonitor/scheduler');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // Count policies to scan
  const [count] = await db
    .select({ total: sql<number>`count(*)::int`, unchecked: sql<number>`count(*) filter (where ${riskMonitorPolicies.lastCheckedAt} is null)::int` })
    .from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  console.log(`Policies: ${count?.total || 0} total, ${count?.unchecked || 0} unchecked\n`);

  // Temporarily set window to now
  const now = new Date();
  const cstHour = (now.getUTCHours() - 6 + 24) % 24;

  await db
    .update(riskMonitorSettings)
    .set({
      isPaused: false,
      scheduleStartHour: cstHour,
      scheduleEndHour: (cstHour + 1) % 24,
      recheckDays: 0,
      requestsToday: 0,
      dailyRequestBudget: 10000,
    })
    .where(eq(riskMonitorSettings.tenantId, tenantId));

  console.log('Scheduler configured for immediate run. Starting full scan...\n');

  const scheduler = createRiskMonitorScheduler(tenantId);
  const result = await scheduler.run(true);

  // Restore normal settings
  await db
    .update(riskMonitorSettings)
    .set({
      scheduleStartHour: 21,
      scheduleEndHour: 4,
      recheckDays: 7,
      dailyRequestBudget: 100,
    })
    .where(eq(riskMonitorSettings.tenantId, tenantId));

  console.log('\n========================================');
  console.log('SCAN COMPLETE');
  console.log('========================================');
  console.log(`  Run ID: ${result.runId}`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Properties checked: ${result.propertiesChecked}`);
  console.log(`  Alerts created: ${result.alertsCreated}`);
  console.log(`  Duration: ${Math.round((result.duration || 0) / 1000)}s`);
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
    result.errors.slice(0, 10).forEach((e: string) => console.log(`    - ${e}`));
  }
  console.log('========================================');
  console.log('Scheduler window restored to 9pm-4am CST.');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
