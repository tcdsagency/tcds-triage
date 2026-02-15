require('dotenv').config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { riskMonitorPolicies, riskMonitorAlerts, riskMonitorSettings, riskMonitorActivityLog } = await import('../src/db/schema');
  const { eq, sql, desc } = await import('drizzle-orm');
  const { rprClient } = await import('../src/lib/rpr');
  const { mmiClient } = await import('../src/lib/mmi');

  const tenantId = process.env.DEFAULT_TENANT_ID!;

  // =========================================================================
  // Step 1: Get a sample property to test both services
  // =========================================================================
  console.log('========================================');
  console.log('STEP 1: Checking data services');
  console.log('========================================\n');

  const [samplePolicy] = await db.select({
    id: riskMonitorPolicies.id,
    address: riskMonitorPolicies.addressLine1,
    city: riskMonitorPolicies.city,
    state: riskMonitorPolicies.state,
    zip: riskMonitorPolicies.zipCode,
    contactName: riskMonitorPolicies.contactName,
  }).from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId))
    .limit(1);

  if (!samplePolicy) {
    console.error('No policies found to test with');
    process.exit(1);
  }

  const testAddress = `${samplePolicy.address}, ${samplePolicy.city}, ${samplePolicy.state} ${samplePolicy.zip}`;
  console.log(`Test property: ${testAddress} (${samplePolicy.contactName})\n`);

  // Test RPR
  console.log('--- RPR Service ---');
  let rprOk = false;
  try {
    const rprResult = await rprClient.lookupProperty(testAddress);
    if (rprResult) {
      console.log(`  Status: ${rprResult.currentStatus}`);
      console.log(`  Owner: ${rprResult.ownerName}`);
      console.log(`  Year Built: ${rprResult.yearBuilt} | Sqft: ${rprResult.sqft}`);
      console.log(`  Estimated Value: $${rprResult.estimatedValue?.toLocaleString()}`);
      if (rprResult.listing) {
        console.log(`  Listing: $${rprResult.listing.price?.toLocaleString()} | ${rprResult.listing.daysOnMarket} DOM`);
      }
      rprOk = true;
      console.log('  RPR: LIVE\n');
    } else {
      console.log('  RPR: returned null (may be unavailable)\n');
    }
  } catch (err: any) {
    console.error(`  RPR: FAILED - ${err.message}\n`);
  }

  // Test MMI
  console.log('--- MMI Service ---');
  let mmiOk = false;
  try {
    const mmiResult = await mmiClient.lookupByAddress(testAddress);
    if (mmiResult.success && mmiResult.data) {
      console.log(`  Status: ${mmiResult.data.currentStatus}`);
      console.log(`  Listings: ${mmiResult.data.listingHistory.length} records`);
      console.log(`  Deeds: ${mmiResult.data.deedHistory.length} records`);
      if (mmiResult.data.lastSaleDate) {
        console.log(`  Last Sale: ${mmiResult.data.lastSaleDate} @ $${mmiResult.data.lastSalePrice?.toLocaleString()}`);
      }
      mmiOk = true;
      console.log('  MMI: LIVE\n');
    } else {
      console.log(`  MMI: returned error - ${mmiResult.error}\n`);
    }
  } catch (err: any) {
    console.error(`  MMI: FAILED - ${err.message}\n`);
  }

  // Summary
  console.log('========================================');
  console.log('SERVICE STATUS:');
  console.log(`  RPR: ${rprOk ? 'LIVE' : 'DOWN'}`);
  console.log(`  MMI: ${mmiOk ? 'LIVE' : 'DOWN'}`);
  console.log('========================================\n');

  // Note: "not found" for a specific address doesn't mean the service is down.
  // If the token was fetched successfully, the service is live.
  // Try additional properties if the first one wasn't found.
  if (!rprOk || !mmiOk) {
    const morePolicies = await db.select({
      address: riskMonitorPolicies.addressLine1,
      city: riskMonitorPolicies.city,
      state: riskMonitorPolicies.state,
      zip: riskMonitorPolicies.zipCode,
    }).from(riskMonitorPolicies)
      .where(eq(riskMonitorPolicies.tenantId, tenantId))
      .limit(10);

    for (const p of morePolicies.slice(1)) {
      if (rprOk && mmiOk) break;
      const addr = `${p.address}, ${p.city}, ${p.state} ${p.zip}`;
      console.log(`  Trying: ${addr}`);
      if (!rprOk) {
        try {
          const r = await rprClient.lookupProperty(addr);
          if (r) { rprOk = true; console.log('  RPR: LIVE'); }
        } catch {}
      }
      if (!mmiOk) {
        try {
          const r = await mmiClient.lookupByAddress(addr);
          if (r.success && r.data) { mmiOk = true; console.log('  MMI: LIVE'); }
        } catch {}
      }
    }

    console.log(`\nFinal: RPR=${rprOk ? 'LIVE' : 'DOWN'}, MMI=${mmiOk ? 'LIVE' : 'DOWN'}\n`);

    if (!rprOk && !mmiOk) {
      console.error('Both services are down. Aborting reset.');
      process.exit(1);
    }
  }

  // =========================================================================
  // Step 2: Clear existing alerts
  // =========================================================================
  console.log('========================================');
  console.log('STEP 2: Clearing existing alerts');
  console.log('========================================\n');

  const [alertCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(riskMonitorAlerts)
    .where(eq(riskMonitorAlerts.tenantId, tenantId));

  console.log(`Existing alerts: ${alertCount?.count || 0}`);

  // Delete all alerts
  await db.delete(riskMonitorAlerts).where(eq(riskMonitorAlerts.tenantId, tenantId));
  console.log('All alerts cleared.\n');

  // =========================================================================
  // Step 3: Reset all policies
  // =========================================================================
  console.log('========================================');
  console.log('STEP 3: Resetting policies for fresh scan');
  console.log('========================================\n');

  // Reset lastCheckedAt, status, and error counters
  await db
    .update(riskMonitorPolicies)
    .set({
      lastCheckedAt: null,
      currentStatus: 'unknown',
      previousStatus: null,
      lastStatusChange: null,
      checkErrorCount: 0,
      lastCheckError: null,
      updatedAt: new Date(),
    })
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  const [policyCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(riskMonitorPolicies)
    .where(eq(riskMonitorPolicies.tenantId, tenantId));

  console.log(`Reset ${policyCount?.count || 0} policies to 'unknown' status.\n`);

  // =========================================================================
  // Step 4: Reset daily request counter and unpause scheduler
  // =========================================================================
  console.log('========================================');
  console.log('STEP 4: Resetting scheduler settings');
  console.log('========================================\n');

  await db
    .update(riskMonitorSettings)
    .set({
      requestsToday: 0,
      isPaused: false,
      lastSchedulerError: null,
      updatedAt: new Date(),
    })
    .where(eq(riskMonitorSettings.tenantId, tenantId));

  console.log('Scheduler unpaused and daily counter reset.\n');

  // =========================================================================
  // Step 5: Trigger a manual scan
  // =========================================================================
  console.log('========================================');
  console.log('STEP 5: Triggering fresh scan');
  console.log('========================================\n');

  const { createRiskMonitorScheduler } = await import('../src/lib/riskMonitor/scheduler');
  const scheduler = createRiskMonitorScheduler(tenantId);

  // Temporarily set window to now so the scheduler runs
  const now = new Date();
  const cstOffset = -6;
  const utcHour = now.getUTCHours();
  const cstHour = (utcHour + cstOffset + 24) % 24;

  await db
    .update(riskMonitorSettings)
    .set({
      scheduleStartHour: cstHour,
      scheduleEndHour: (cstHour + 1) % 24,
      recheckDays: 0,
    })
    .where(eq(riskMonitorSettings.tenantId, tenantId));

  console.log(`Set scheduler window to CST hour ${cstHour} (current). Starting scan...\n`);

  const result = await scheduler.run(true);

  // Restore normal window
  await db
    .update(riskMonitorSettings)
    .set({
      scheduleStartHour: 21,
      scheduleEndHour: 4,
      recheckDays: 7,
    })
    .where(eq(riskMonitorSettings.tenantId, tenantId));

  console.log('\n========================================');
  console.log('SCAN RESULTS:');
  console.log('========================================');
  console.log(`  Run ID: ${result.runId}`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Properties checked: ${result.propertiesChecked}`);
  console.log(`  Alerts created: ${result.alertsCreated}`);
  console.log(`  Duration: ${result.duration}ms`);
  if (result.errors.length > 0) {
    console.log(`  Errors: ${result.errors.length}`);
    result.errors.forEach((e: string) => console.log(`    - ${e}`));
  }
  console.log('========================================\n');

  console.log('Done! Risk monitor has been reset and a fresh scan completed.');
  console.log('Scheduler window restored to 9pm-4am CST.');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
