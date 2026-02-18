/**
 * Home Coverage Rules (H-010 to H-015)
 * Phase 3 — Coverage limit checks
 */

import type { CheckRuleDefinition, CheckRuleContext, CheckResult } from '@/types/check-rules.types';
import { makeCheck, fmtDollars, fmtDollarChange, pctChange } from '../helpers';
import type { CanonicalCoverage } from '@/types/renewal.types';

// Helpers to find home coverages by type
function findCov(coverages: CanonicalCoverage[], type: string): CanonicalCoverage | undefined {
  return coverages.find(c => c.type === type);
}

function getCovLimit(coverages: CanonicalCoverage[], type: string): number | null {
  const c = findCov(coverages, type);
  return c?.limitAmount ?? null;
}

function makeCoverageCheck(
  ruleId: string,
  field: string,
  covType: string,
  ctx: CheckRuleContext,
  opts: { isBlocking?: boolean; ratioCheck?: false } = {}
): CheckResult | null {
  const basLimit = getCovLimit(ctx.baseline.coverages, covType);
  const renLimit = getCovLimit(ctx.renewal.coverages, covType);

  if (basLimit == null && renLimit == null) return null;

  if (basLimit != null && renLimit == null) {
    return makeCheck(ruleId, {
      field,
      previousValue: basLimit,
      renewalValue: null,
      change: 'REMOVED',
      severity: 'removed',
      message: `${field} was removed from the renewal`,
      agentAction: `Coverage ${field} removed — verify with carrier and customer`,
      checkType: 'value_change',
      category: 'Coverages',
      isBlocking: opts.isBlocking ?? false,
    });
  }

  if (basLimit == null && renLimit != null) {
    return makeCheck(ruleId, {
      field,
      previousValue: null,
      renewalValue: renLimit,
      change: `Added: ${fmtDollars(renLimit)}`,
      severity: 'added',
      message: `${field} added at ${fmtDollars(renLimit)}`,
      agentAction: `New coverage ${field} added — confirm this is expected`,
      checkType: 'value_change',
      category: 'Coverages',
      isBlocking: false,
    });
  }

  // Both present — compare
  const diff = renLimit! - basLimit!;
  const pct = pctChange(basLimit!, renLimit!);
  const change = fmtDollarChange(basLimit, renLimit);
  let severity: CheckResult['severity'] = 'unchanged';
  if (Math.abs(pct) >= ctx.thresholds.coverageLimitReductionPercent) {
    severity = diff < 0 ? 'critical' : 'warning';
  } else if (diff !== 0) {
    severity = 'info';
  }

  return makeCheck(ruleId, {
    field,
    previousValue: basLimit,
    renewalValue: renLimit,
    change,
    severity,
    message: diff === 0
      ? `${field}: ${fmtDollars(renLimit)} (no change)`
      : `${field}: ${fmtDollars(basLimit)} → ${fmtDollars(renLimit)} (${change})`,
    agentAction: severity === 'critical'
      ? `${field} reduced significantly — reshop or contact customer`
      : severity === 'warning'
      ? `${field} increased significantly — verify with customer`
      : 'No action needed',
    checkType: 'value_change',
    category: 'Coverages',
    isBlocking: opts.isBlocking ?? false,
  });
}

export const homeCoverageRules: CheckRuleDefinition[] = [
  {
    ruleId: 'H-010',
    name: 'Coverage A — Dwelling',
    description: 'Check Coverage A (Dwelling) limit change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => makeCoverageCheck('H-010', 'Coverage A (Dwelling)', 'dwelling', ctx),
  },
  {
    ruleId: 'H-011',
    name: 'Coverage B — Other Structures',
    description: 'Check Coverage B (Other Structures) limit change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => makeCoverageCheck('H-011', 'Coverage B (Other Structures)', 'other_structures', ctx),
  },
  {
    ruleId: 'H-012',
    name: 'Coverage C — Personal Property',
    description: 'Check Coverage C (Personal Property) limit change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => makeCoverageCheck('H-012', 'Coverage C (Personal Property)', 'personal_property', ctx),
  },
  {
    ruleId: 'H-013',
    name: 'Coverage D — Loss of Use',
    description: 'Check Coverage D (Loss of Use) limit change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => makeCoverageCheck('H-013', 'Coverage D (Loss of Use)', 'loss_of_use', ctx),
  },
  {
    ruleId: 'H-014',
    name: 'Coverage E — Personal Liability',
    description: 'Check Coverage E (Personal Liability) limit change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => makeCoverageCheck('H-014', 'Coverage E (Personal Liability)', 'personal_liability', ctx),
  },
  {
    ruleId: 'H-015',
    name: 'Coverage F — Medical Payments',
    description: 'Check Coverage F (Medical Payments to Others) limit change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => makeCoverageCheck('H-015', 'Coverage F (Medical Payments)', 'medical_payments', ctx),
  },
];
