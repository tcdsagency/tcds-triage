/**
 * Home Deductible Rules (H-020 to H-023)
 * Phase 3 — Deductible checks
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck, fmtDollars, pctChange } from '../helpers';
import type { CanonicalCoverage } from '@/types/renewal.types';

function findCovDeductible(coverages: CanonicalCoverage[], type: string): number | null {
  const c = coverages.find(c => c.type === type);
  return c?.deductibleAmount ?? null;
}

function makeDeductibleCheck(
  ruleId: string,
  field: string,
  covType: string,
  baseCoverages: CanonicalCoverage[],
  renewalCoverages: CanonicalCoverage[],
  deductibleThresholdPct: number
): CheckResult | null {
  const baseDed = findCovDeductible(baseCoverages, covType);
  const renDed = findCovDeductible(renewalCoverages, covType);

  if (baseDed == null && renDed == null) return null;

  if (baseDed != null && renDed == null) {
    return makeCheck(ruleId, {
      field,
      previousValue: baseDed,
      renewalValue: null,
      change: 'REMOVED',
      severity: 'removed',
      message: `${field} deductible was removed`,
      agentAction: `${field} deductible removed — verify with carrier`,
      checkType: 'value_change',
      category: 'Deductibles',
      isBlocking: false,
    });
  }

  if (baseDed == null && renDed != null) {
    return makeCheck(ruleId, {
      field,
      previousValue: null,
      renewalValue: renDed,
      change: `Added: ${fmtDollars(renDed)}`,
      severity: 'added',
      message: `${field} deductible added at ${fmtDollars(renDed)}`,
      agentAction: `New ${field} deductible — confirm this is expected`,
      checkType: 'value_change',
      category: 'Deductibles',
      isBlocking: false,
    });
  }

  const diff = renDed! - baseDed!;
  const pct = pctChange(baseDed!, renDed!);
  let severity: CheckResult['severity'] = 'unchanged';
  if (diff > 0 && Math.abs(pct) >= deductibleThresholdPct) severity = 'critical';
  else if (diff > 0) severity = 'warning';
  else if (diff < 0) severity = 'info';

  return makeCheck(ruleId, {
    field,
    previousValue: baseDed,
    renewalValue: renDed,
    change: diff === 0
      ? 'No change'
      : `${fmtDollars(baseDed)} → ${fmtDollars(renDed)}`,
    severity,
    message: diff === 0
      ? `${field}: ${fmtDollars(renDed)} (no change)`
      : `${field}: ${fmtDollars(baseDed)} → ${fmtDollars(renDed)}`,
    agentAction: severity === 'critical'
      ? `Deductible increased significantly — discuss with customer`
      : severity === 'warning'
      ? `Deductible increased — note for customer`
      : 'No action needed',
    checkType: 'value_change',
    category: 'Deductibles',
    isBlocking: false,
  });
}

export const homeDeductibleRules: CheckRuleDefinition[] = [
  {
    ruleId: 'H-020',
    name: 'All-Peril Deductible',
    description: 'Check all-peril/AOP deductible change',
    checkType: 'value_change',
    category: 'Deductibles',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      // Try dwelling deductible first, then fall back to any AOP-type coverage
      return makeDeductibleCheck('H-020', 'All-Peril Deductible', 'dwelling',
        ctx.baseline.coverages, ctx.renewal.coverages, ctx.thresholds.deductibleIncreasePercent)
        ?? makeDeductibleCheck('H-020', 'All-Peril Deductible', 'all_peril',
          ctx.baseline.coverages, ctx.renewal.coverages, ctx.thresholds.deductibleIncreasePercent);
    },
  },
  {
    ruleId: 'H-021',
    name: 'Wind/Hail Deductible',
    description: 'Check wind/hail deductible change',
    checkType: 'value_change',
    category: 'Deductibles',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) =>
      makeDeductibleCheck('H-021', 'Wind/Hail Deductible', 'wind_hail',
        ctx.baseline.coverages, ctx.renewal.coverages, ctx.thresholds.deductibleIncreasePercent),
  },
  {
    ruleId: 'H-022',
    name: 'Hurricane Deductible',
    description: 'Check hurricane deductible change',
    checkType: 'value_change',
    category: 'Deductibles',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) =>
      makeDeductibleCheck('H-022', 'Hurricane Deductible', 'hurricane',
        ctx.baseline.coverages, ctx.renewal.coverages, ctx.thresholds.deductibleIncreasePercent),
  },
  {
    ruleId: 'H-023',
    name: 'Earthquake Deductible',
    description: 'Check earthquake deductible change',
    checkType: 'value_change',
    category: 'Deductibles',
    phase: 3,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) =>
      makeDeductibleCheck('H-023', 'Earthquake Deductible', 'earthquake',
        ctx.baseline.coverages, ctx.renewal.coverages, ctx.thresholds.deductibleIncreasePercent),
  },
];
