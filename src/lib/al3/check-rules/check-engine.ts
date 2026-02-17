/**
 * Check Engine — 7-Phase Executor
 * ================================
 * Post-processing layer that runs 71 formal check rules against
 * renewal/baseline snapshots and the existing comparison result.
 *
 * Execution phases:
 *   Phase 1: BLOCKING — Address, dates, carrier (halt if critical)
 *   Phase 2: IDENTITY — Policy #, insured name, form, agent
 *     → BLOCKING GATE 1: halt if any Phase 1 critical
 *   Phase 3: COVERAGE — Limits, ratios, deductibles
 *   Phase 4: THRESHOLD — Premium change severity classification
 *   Phase 5: PREMIUM MATH — Sum verification
 *     → BLOCKING GATE 2: halt if premium math fails
 *   Phase 6: DETAILS — Property, vehicles, drivers, VIN validation
 *   Phase 7: ENDORSEMENTS — Forms, discounts, mortgagee
 */

import type {
  CheckResult,
  CheckEngineResult,
  CheckSummary,
  CheckRuleContext,
} from '@/types/check-rules.types';
import type {
  RenewalSnapshot,
  BaselineSnapshot,
  ComparisonResult,
} from '@/types/renewal.types';
import type { AgencyThresholds } from '@/types/agency-thresholds.types';
import { DEFAULT_AGENCY_THRESHOLDS } from '@/types/agency-thresholds.types';
import { getRulesForLOB, getRulesForPhase } from './rule-registry';

/**
 * Run the full check engine against a renewal comparison.
 */
export function runCheckEngine(
  renewal: RenewalSnapshot,
  baseline: BaselineSnapshot,
  comparisonResult: ComparisonResult,
  lineOfBusiness: string,
  carrierName: string,
  thresholds: AgencyThresholds = DEFAULT_AGENCY_THRESHOLDS
): CheckEngineResult {
  const ctx: CheckRuleContext = {
    renewal,
    baseline,
    comparisonResult,
    thresholds,
    lineOfBusiness,
    carrierName,
  };

  const applicableRules = getRulesForLOB(lineOfBusiness);
  const allResults: CheckResult[] = [];
  let pipelineHalted = false;
  let haltPhase: number | null = null;
  let skippedCount = 0;
  let evaluatedCount = 0;

  // Execute phases 1-7 with blocking gates
  for (let phase = 1; phase <= 7; phase++) {
    // BLOCKING GATE 1: After Phase 1, halt if any Phase 1 critical
    if (phase === 2 && hasCriticalBlockers(allResults, 1)) {
      pipelineHalted = true;
      haltPhase = 1;
      break;
    }

    // BLOCKING GATE 2: After Phase 5 (premium math), halt if math fails
    if (phase === 6 && hasCriticalBlockers(allResults, 5)) {
      pipelineHalted = true;
      haltPhase = 5;
      break;
    }

    const phaseRules = getRulesForPhase(applicableRules, phase);
    for (const rule of phaseRules) {
      evaluatedCount++;
      try {
        const result = rule.evaluate(ctx);
        if (result == null) {
          skippedCount++;
          continue;
        }

        if (Array.isArray(result)) {
          allResults.push(...result);
        } else {
          allResults.push(result);
        }
      } catch (err) {
        // Rule evaluation error — log and continue
        console.error(`[CheckEngine] Rule ${rule.ruleId} failed:`, err);
        allResults.push({
          ruleId: rule.ruleId,
          field: rule.name,
          previousValue: null,
          renewalValue: null,
          change: 'ERROR',
          severity: 'warning',
          message: `Rule ${rule.ruleId} evaluation error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          agentAction: 'Rule evaluation failed — manual review needed',
          reviewed: false,
          reviewedBy: null,
          reviewedAt: null,
          checkType: rule.checkType,
          category: rule.category,
          isBlocking: false,
        });
      }
    }
  }

  // Add skip-count meta-check if a significant portion of rules were skipped
  const skipPercent = evaluatedCount > 0 ? Math.round((skippedCount / evaluatedCount) * 100) : 0;
  if (skippedCount > 0) {
    allResults.push({
      ruleId: 'META-001',
      field: 'Rule Coverage',
      previousValue: evaluatedCount,
      renewalValue: evaluatedCount - skippedCount,
      change: `${skippedCount} skipped (${skipPercent}%)`,
      severity: skipPercent >= 50 ? 'warning' : 'info',
      message: `${skippedCount} of ${evaluatedCount} rules skipped due to missing data (${skipPercent}%)`,
      agentAction: skipPercent >= 50
        ? 'Over half of rules skipped — snapshot may be incomplete, verify data quality'
        : 'Some rules skipped due to missing data — normal for partial snapshots',
      reviewed: false,
      reviewedBy: null,
      reviewedAt: null,
      checkType: 'existence',
      category: 'Meta',
      isBlocking: false,
    });
  }

  // Compute summary
  const blockers = allResults.filter(r => r.isBlocking && r.severity === 'critical');
  const criticalCount = allResults.filter(r => r.severity === 'critical').length;
  const warningCount = allResults.filter(r => r.severity === 'warning').length;
  const infoCount = allResults.filter(r => r.severity === 'info' || r.severity === 'added' || r.severity === 'removed').length;
  const unchangedCount = allResults.filter(r => r.severity === 'unchanged').length;
  const totalChecks = allResults.length;

  // Review progress: count reviewed items (excluding unchanged)
  const reviewableResults = allResults.filter(r => r.severity !== 'unchanged');
  const reviewedCount = reviewableResults.filter(r => r.reviewed).length;
  const reviewProgress = reviewableResults.length > 0
    ? Math.round((reviewedCount / reviewableResults.length) * 100)
    : 100;

  return {
    checkResults: allResults,
    blockers,
    pipelineHalted,
    totalChecks,
    criticalCount,
    warningCount,
    infoCount,
    unchangedCount,
    reviewProgress,
  };
}

/**
 * Check if a specific phase produced any critical blocking results.
 */
function hasCriticalBlockers(results: CheckResult[], phase: number): boolean {
  // We need to check results from rules in the given phase that are blocking + critical
  // Since results don't carry phase info directly, we check isBlocking + severity
  // Phase 1 rules are all isBlocking, Phase 5 rules H-032/A-042 are isBlocking
  return results.some(r => r.isBlocking && r.severity === 'critical');
}

/**
 * Build a compact CheckSummary for DB storage.
 */
export function buildCheckSummary(engineResult: CheckEngineResult): CheckSummary {
  return {
    totalChecks: engineResult.totalChecks,
    criticalCount: engineResult.criticalCount,
    warningCount: engineResult.warningCount,
    infoCount: engineResult.infoCount,
    unchangedCount: engineResult.unchangedCount,
    pipelineHalted: engineResult.pipelineHalted,
    blockerRuleIds: engineResult.blockers.map(b => b.ruleId),
    reviewProgress: engineResult.reviewProgress,
  };
}
