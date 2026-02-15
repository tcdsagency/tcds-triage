import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { desc, isNotNull, and } = await import('drizzle-orm');
  const { runCheckEngine, buildCheckSummary } = await import('../src/lib/al3/check-rules/check-engine');
  const { compareSnapshots } = await import('../src/lib/al3/comparison-engine');

  // Fetch recent renewals that have both snapshots
  const renewals = await db
    .select({
      id: renewalComparisons.id,
      policyNumber: renewalComparisons.policyNumber,
      carrierName: renewalComparisons.carrierName,
      lineOfBusiness: renewalComparisons.lineOfBusiness,
      renewalSnapshot: renewalComparisons.renewalSnapshot,
      baselineSnapshot: renewalComparisons.baselineSnapshot,
      materialChanges: renewalComparisons.materialChanges,
      comparisonSummary: renewalComparisons.comparisonSummary,
      recommendation: renewalComparisons.recommendation,
      currentPremium: renewalComparisons.currentPremium,
      renewalPremium: renewalComparisons.renewalPremium,
    })
    .from(renewalComparisons)
    .where(
      and(
        isNotNull(renewalComparisons.renewalSnapshot),
        isNotNull(renewalComparisons.baselineSnapshot)
      )
    )
    .orderBy(desc(renewalComparisons.createdAt))
    .limit(5);

  console.log(`Found ${renewals.length} renewals with both snapshots\n`);

  for (const renewal of renewals) {
    const renSnap = renewal.renewalSnapshot as any;
    const basSnap = renewal.baselineSnapshot as any;

    console.log('═'.repeat(80));
    console.log(`Policy: ${renewal.policyNumber} | Carrier: ${renewal.carrierName} | LOB: ${renewal.lineOfBusiness}`);
    console.log(`Premium: $${renewal.currentPremium} → $${renewal.renewalPremium} | Recommendation: ${renewal.recommendation}`);
    console.log('═'.repeat(80));

    // Re-run comparison engine to get ComparisonResult
    const comparisonResult = compareSnapshots(renSnap, basSnap);

    // Run check engine
    const result = runCheckEngine(
      renSnap,
      basSnap,
      comparisonResult,
      renewal.lineOfBusiness || '',
      renewal.carrierName || ''
    );

    const summary = buildCheckSummary(result);

    console.log(`\nCheck Engine Summary:`);
    console.log(`  Total checks: ${summary.totalChecks}`);
    console.log(`  Critical: ${summary.criticalCount} | Warning: ${summary.warningCount} | Info: ${summary.infoCount} | Unchanged: ${summary.unchangedCount}`);
    console.log(`  Pipeline halted: ${summary.pipelineHalted}`);
    console.log(`  Blockers: ${summary.blockerRuleIds.length > 0 ? summary.blockerRuleIds.join(', ') : 'None'}`);
    console.log(`  Review progress: ${summary.reviewProgress}%`);

    // Print all non-unchanged results
    const flagged = result.checkResults.filter(r => r.severity !== 'unchanged');
    if (flagged.length > 0) {
      console.log(`\nFlagged Items (${flagged.length}):`);
      for (const r of flagged) {
        const severityIcon = {
          critical: '🔴',
          warning: '🟡',
          info: '🔵',
          added: '🟢',
          removed: '🔴',
          unchanged: '⚪',
        }[r.severity];
        console.log(`  ${severityIcon} [${r.ruleId}] ${r.field}: ${r.change}`);
        console.log(`     ${r.message}`);
        console.log(`     → ${r.agentAction}`);
      }
    }

    // Also print unchanged count breakdown
    const unchanged = result.checkResults.filter(r => r.severity === 'unchanged');
    if (unchanged.length > 0) {
      console.log(`\nUnchanged (${unchanged.length}): ${unchanged.map(r => r.ruleId).join(', ')}`);
    }

    console.log('\n');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
