/**
 * Home Coverage Rules (H-010 to H-017)
 * Phase 3 — Coverage limits and ratio checks
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
  {
    ruleId: 'H-016',
    name: 'Coverage B/A Ratio',
    description: 'Check that Coverage B stays within expected ratio of Coverage A (typically 10%)',
    checkType: 'ratio',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const renA = getCovLimit(ctx.renewal.coverages, 'dwelling');
      const renB = getCovLimit(ctx.renewal.coverages, 'other_structures');
      const basA = getCovLimit(ctx.baseline.coverages, 'dwelling');
      const basB = getCovLimit(ctx.baseline.coverages, 'other_structures');

      if (!renA || !renB) return null;

      const renRatio = (renB / renA) * 100;
      const basRatio = basA && basB ? (basB / basA) * 100 : null;
      const drift = basRatio != null ? Math.abs(renRatio - basRatio) : 0;
      const driftExceeded = drift > ctx.thresholds.covBRatioDrift;

      return makeCheck('H-016', {
        field: 'Cov B/A Ratio',
        previousValue: basRatio != null ? `${basRatio.toFixed(1)}%` : null,
        renewalValue: `${renRatio.toFixed(1)}%`,
        change: basRatio != null
          ? `${basRatio.toFixed(1)}% → ${renRatio.toFixed(1)}% (drift: ${drift.toFixed(1)}%)`
          : `${renRatio.toFixed(1)}%`,
        severity: driftExceeded ? 'warning' : 'unchanged',
        message: driftExceeded
          ? `Coverage B/A ratio drifted ${drift.toFixed(1)}% (threshold: ${ctx.thresholds.covBRatioDrift}%)`
          : `Coverage B/A ratio: ${renRatio.toFixed(1)}% — within tolerance`,
        agentAction: driftExceeded
          ? 'Review Other Structures limit — ratio to dwelling changed. If policy form changed (e.g. HO-3 → HO-5), ratio change may be expected.'
          : 'No action needed',
        checkType: 'ratio',
        category: 'Coverages',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-017',
    name: 'Coverage C/A Ratio',
    description: 'Check Coverage C is within 40-80% of Coverage A',
    checkType: 'ratio',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const renA = getCovLimit(ctx.renewal.coverages, 'dwelling');
      const renC = getCovLimit(ctx.renewal.coverages, 'personal_property');

      if (!renA || !renC) return null;

      const ratio = (renC / renA) * 100;
      const inRange = ratio >= ctx.thresholds.covCRatioMin && ratio <= ctx.thresholds.covCRatioMax;

      return makeCheck('H-017', {
        field: 'Cov C/A Ratio',
        previousValue: null,
        renewalValue: `${ratio.toFixed(1)}%`,
        change: `${ratio.toFixed(1)}% (expected: ${ctx.thresholds.covCRatioMin}-${ctx.thresholds.covCRatioMax}%)`,
        severity: inRange ? 'unchanged' : 'warning',
        message: inRange
          ? `Coverage C/A ratio ${ratio.toFixed(1)}% is within expected range`
          : `Coverage C/A ratio ${ratio.toFixed(1)}% is outside expected range (${ctx.thresholds.covCRatioMin}-${ctx.thresholds.covCRatioMax}%)`,
        agentAction: inRange
          ? 'No action needed'
          : 'Personal Property limit may be too high or too low relative to dwelling — review with customer. If policy form changed (e.g. HO-3 → HO-5), ratio change may be expected.',
        checkType: 'ratio',
        category: 'Coverages',
        isBlocking: false,
      });
    },
  },
];
