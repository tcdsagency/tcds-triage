/**
 * Check Rules Engine Types
 * ========================
 * Types for the 71-rule post-comparison check engine.
 * This engine wraps around the existing comparison engine output
 * and applies formal rule-based checks with severity classification.
 */

import type {
  RenewalSnapshot,
  BaselineSnapshot,
  ComparisonResult,
  ComparisonThresholds,
} from './renewal.types';
import type { AgencyThresholds } from './agency-thresholds.types';

// =============================================================================
// CHECK RESULT TYPES
// =============================================================================

export type CheckSeverity = 'critical' | 'warning' | 'info' | 'unchanged' | 'added' | 'removed';

export type CheckType =
  | 'value_change'
  | 'threshold'
  | 'ratio'
  | 'existence'
  | 'cross_field'
  | 'format'
  | 'math';

/**
 * Result of a single check rule evaluation.
 */
export interface CheckResult {
  ruleId: string;           // H-001, A-015, etc.
  field: string;
  previousValue: string | number | null;
  renewalValue: string | number | null;
  change: string;           // "+$11,600 (+4.5%)" or "No change" or "REMOVED"
  severity: CheckSeverity;
  message: string;          // Human-readable
  agentAction: string;      // What agent should do
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  checkType: CheckType;
  category: string;
  isBlocking: boolean;
}

/**
 * Summary of check engine execution.
 */
export interface CheckEngineResult {
  checkResults: CheckResult[];
  blockers: CheckResult[];
  pipelineHalted: boolean;
  totalChecks: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  unchangedCount: number;
  reviewProgress: number;   // 0-100%
}

/**
 * Stored summary (compact version for DB column).
 */
export interface CheckSummary {
  totalChecks: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  unchangedCount: number;
  pipelineHalted: boolean;
  blockerRuleIds: string[];
  reviewProgress: number;
}

// =============================================================================
// RULE DEFINITION TYPES
// =============================================================================

/**
 * Context passed to each rule's evaluate function.
 */
export interface CheckRuleContext {
  renewal: RenewalSnapshot;
  baseline: BaselineSnapshot;
  comparisonResult: ComparisonResult;
  thresholds: AgencyThresholds;
  lineOfBusiness: string;
  carrierName: string;
}

/**
 * A single check rule definition.
 */
export interface CheckRuleDefinition {
  ruleId: string;
  name: string;
  description: string;
  checkType: CheckType;
  category: string;
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  isBlocking: boolean;
  lob: 'home' | 'auto' | 'both';
  evaluate: (ctx: CheckRuleContext) => CheckResult | CheckResult[] | null;
}
