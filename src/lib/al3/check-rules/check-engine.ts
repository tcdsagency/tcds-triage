/**
 * Check Engine — Phase Executor
 * ==============================
 * Post-processing layer that runs core check rules against
 * renewal/baseline snapshots and the existing comparison result.
 *
 * Phase pipeline (7 phases, 2 blocking gates):
 *
 *   Phase 1 (IDENTITY):     Reserved — policy identity validation
 *                            (insured name match, policy number format)
 *   ── Gate 1: halt if identity can't be verified (wrong policy matched) ──
 *   Phase 2 (DATA QUALITY): Reserved — data completeness checks
 *                            (missing coverages, parse confidence)
 *   Phase 3 (COVERAGE):     ACTIVE — coverage limit and deductible change detection
 *                            (H-010–H-015, H-020–H-023, A-030–A-038)
 *   Phase 4 (PREMIUM):      ACTIVE — premium change severity classification
 *                            (H-030, A-040)
 *   Phase 5 (MATH):         Reserved — premium math verification
 *                            (sum of parts vs total)
 *   ── Gate 2: halt if premium math fails (likely bad parse) ──
 *   Phase 6 (CROSS-FIELD):  Reserved — cross-field validation
 *                            (coverage ratios, replacement cost drift)
 *   Phase 7 (PROPERTY):     Reserved — property-specific concerns
 *                            (roof age, ACV vs RCV)
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
 *
 * Phase 1 gate: would halt pipeline if identity can't be verified
 *   (wrong policy matched to renewal — all downstream checks meaningless)
 * Phase 5 gate: would halt pipeline if premium math fails
 *   (sum of coverage premiums != total — likely bad parse, cross-field checks unreliable)
 *
 * Currently no blocking rules exist (phases 1 and 5 are empty/reserved).
 */
const PHASE_BLOCKING_RULES: Record<number, Set<string>> = {};

function hasCriticalBlockers(results: CheckResult[], phase: number): boolean {
  const phaseRuleIds = PHASE_BLOCKING_RULES[phase];
  if (!phaseRuleIds) return false;
  return results.some(r => r.isBlocking && r.severity === 'critical' && phaseRuleIds.has(r.ruleId));
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
