/**
 * Auto Coverage Rules (A-030 to A-039)
 * Phase 3 — Auto coverage checks
 */

import type { CheckRuleDefinition, CheckResult, CheckRuleContext } from '@/types/check-rules.types';
import { makeCheck, fmtDollars, fmtDollarChange, pctChange, norm } from '../helpers';
import type { CanonicalCoverage, CanonicalVehicle } from '@/types/renewal.types';

function findCov(coverages: CanonicalCoverage[], type: string): CanonicalCoverage | undefined {
  return coverages.find(c => c.type === type);
}

function makeAutoCovCheck(
  ruleId: string,
  field: string,
  covType: string,
  ctx: CheckRuleContext
): CheckResult | null {
  // Check policy-level coverages
  const basCov = findCov(ctx.baseline.coverages, covType);
  const renCov = findCov(ctx.renewal.coverages, covType);

  // Also check vehicle-level coverages if not at policy level
  if (!basCov && !renCov) {
    // Try to find in vehicle coverages
    const basVehCov = ctx.baseline.vehicles.flatMap(v => v.coverages).find(c => c.type === covType);
    const renVehCov = ctx.renewal.vehicles.flatMap(v => v.coverages).find(c => c.type === covType);
    if (!basVehCov && !renVehCov) return null;
  }

  const basLimit = basCov?.limitAmount ?? null;
  const renLimit = renCov?.limitAmount ?? null;

  if (basLimit == null && renLimit == null) return null;

  if (basLimit != null && renLimit == null) {
    return makeCheck(ruleId, {
      field,
      previousValue: basLimit,
      renewalValue: null,
      change: 'REMOVED',
      severity: 'removed',
      message: `${field} removed from renewal`,
      agentAction: `${field} removed — verify with carrier and customer`,
      checkType: 'value_change',
      category: 'Coverages',
      isBlocking: false,
    });
  }

  if (basLimit == null && renLimit != null) {
    return makeCheck(ruleId, {
      field,
      previousValue: null,
      renewalValue: renLimit,
      change: `Added: ${fmtDollars(renLimit)}`,
      severity: 'added',
      message: `${field} added: ${fmtDollars(renLimit)}`,
      agentAction: `New ${field} coverage — confirm expected`,
      checkType: 'value_change',
      category: 'Coverages',
      isBlocking: false,
    });
  }

  const diff = renLimit! - basLimit!;
  const pct = pctChange(basLimit!, renLimit!);
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
    change: fmtDollarChange(basLimit, renLimit),
    severity,
    message: diff === 0
      ? `${field}: ${fmtDollars(renLimit)} (no change)`
      : `${field}: ${fmtDollars(basLimit)} → ${fmtDollars(renLimit)}`,
    agentAction: severity === 'critical'
      ? `${field} reduced significantly — reshop or contact customer`
      : 'No action needed',
    checkType: 'value_change',
    category: 'Coverages',
    isBlocking: false,
  });
}

function vehicleLabel(v: CanonicalVehicle): string {
  return [v.year, v.make, v.model].filter(Boolean).join(' ') || v.vin || 'Unknown';
}

export const autoCoverageRules: CheckRuleDefinition[] = [
  {
    ruleId: 'A-030',
    name: 'Bodily Injury Limits',
    description: 'Check BI limits change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => makeAutoCovCheck('A-030', 'Bodily Injury', 'bodily_injury', ctx),
  },
  {
    ruleId: 'A-031',
    name: 'Property Damage Limits',
    description: 'Check PD limits change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => makeAutoCovCheck('A-031', 'Property Damage', 'property_damage', ctx),
  },
  {
    ruleId: 'A-032',
    name: 'Medical Payments',
    description: 'Check MedPay limits change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => makeAutoCovCheck('A-032', 'Medical Payments', 'medical_payments', ctx),
  },
  {
    ruleId: 'A-033',
    name: 'Uninsured Motorist',
    description: 'Check UM limits change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => makeAutoCovCheck('A-033', 'Uninsured Motorist', 'uninsured_motorist', ctx),
  },
  {
    ruleId: 'A-034',
    name: 'Underinsured Motorist',
    description: 'Check UIM limits change',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => makeAutoCovCheck('A-034', 'Underinsured Motorist', 'underinsured_motorist', ctx),
  },
  {
    ruleId: 'A-035',
    name: 'Comprehensive Deductible',
    description: 'Check comp deductible changes per vehicle',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const results: CheckResult[] = [];

      for (const renV of ctx.renewal.vehicles) {
        const compCov = findCov(renV.coverages, 'comprehensive');
        if (!compCov) continue;

        // Find matching baseline vehicle
        const basV = ctx.baseline.vehicles.find(bv =>
          (bv.vin && renV.vin && norm(bv.vin) === norm(renV.vin)) ||
          (bv.year === renV.year && norm(bv.make) === norm(renV.make))
        );

        const basComp = basV ? findCov(basV.coverages, 'comprehensive') : null;
        const basDed = basComp?.deductibleAmount ?? null;
        const renDed = compCov.deductibleAmount ?? null;

        if (basDed == null && renDed == null) continue;
        if (basDed === renDed) continue;

        const label = vehicleLabel(renV);
        results.push(makeCheck('A-035', {
          field: `Comp Deductible: ${label}`,
          previousValue: basDed,
          renewalValue: renDed,
          change: basDed == null ? `Added: ${fmtDollars(renDed)}` : renDed == null ? 'REMOVED' : `${fmtDollars(basDed)} → ${fmtDollars(renDed)}`,
          severity: renDed == null ? 'removed' : renDed! > (basDed ?? 0) ? 'warning' : 'info',
          message: `Comp deductible for ${label}: ${fmtDollars(basDed)} → ${fmtDollars(renDed)}`,
          agentAction: renDed != null && renDed > (basDed ?? 0) ? 'Comp deductible increased — note for customer' : 'No action needed',
          checkType: 'value_change',
          category: 'Coverages',
          isBlocking: false,
        }));
      }

      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'A-036',
    name: 'Collision Deductible',
    description: 'Check collision deductible changes per vehicle',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const results: CheckResult[] = [];

      for (const renV of ctx.renewal.vehicles) {
        const collCov = findCov(renV.coverages, 'collision');
        if (!collCov) continue;

        const basV = ctx.baseline.vehicles.find(bv =>
          (bv.vin && renV.vin && norm(bv.vin) === norm(renV.vin)) ||
          (bv.year === renV.year && norm(bv.make) === norm(renV.make))
        );

        const basColl = basV ? findCov(basV.coverages, 'collision') : null;
        const basDed = basColl?.deductibleAmount ?? null;
        const renDed = collCov.deductibleAmount ?? null;

        if (basDed == null && renDed == null) continue;
        if (basDed === renDed) continue;

        const label = vehicleLabel(renV);
        results.push(makeCheck('A-036', {
          field: `Coll Deductible: ${label}`,
          previousValue: basDed,
          renewalValue: renDed,
          change: basDed == null ? `Added: ${fmtDollars(renDed)}` : renDed == null ? 'REMOVED' : `${fmtDollars(basDed)} → ${fmtDollars(renDed)}`,
          severity: renDed == null ? 'removed' : renDed! > (basDed ?? 0) ? 'warning' : 'info',
          message: `Coll deductible for ${label}: ${fmtDollars(basDed)} → ${fmtDollars(renDed)}`,
          agentAction: renDed != null && renDed > (basDed ?? 0) ? 'Collision deductible increased — note for customer' : 'No action needed',
          checkType: 'value_change',
          category: 'Coverages',
          isBlocking: false,
        }));
      }

      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'A-037',
    name: 'Rental Reimbursement',
    description: 'Check rental coverage changes',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => makeAutoCovCheck('A-037', 'Rental Reimbursement', 'rental_reimbursement', ctx),
  },
  {
    ruleId: 'A-038',
    name: 'Towing/Roadside',
    description: 'Check towing/roadside coverage changes',
    checkType: 'value_change',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      return makeAutoCovCheck('A-038', 'Towing/Roadside', 'towing', ctx)
        ?? makeAutoCovCheck('A-038', 'Roadside Assistance', 'roadside_assistance', ctx);
    },
  },
  {
    ruleId: 'A-039',
    name: 'Coverage Consistency',
    description: 'Verify BI/PD limits are consistent across all vehicles',
    checkType: 'cross_field',
    category: 'Coverages',
    phase: 3,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      // Policy-level coverages (BI, PD) should be consistent — if they exist at vehicle level, flag inconsistency
      const vehBI = new Set<string>();
      const vehPD = new Set<string>();
      for (const v of ctx.renewal.vehicles) {
        const bi = findCov(v.coverages, 'bodily_injury');
        const pd = findCov(v.coverages, 'property_damage');
        if (bi?.limit) vehBI.add(bi.limit);
        if (pd?.limit) vehPD.add(pd.limit);
      }

      if (vehBI.size <= 1 && vehPD.size <= 1) return null;

      const issues: string[] = [];
      if (vehBI.size > 1) issues.push(`BI limits vary: ${[...vehBI].join(', ')}`);
      if (vehPD.size > 1) issues.push(`PD limits vary: ${[...vehPD].join(', ')}`);

      return makeCheck('A-039', {
        field: 'Coverage Consistency',
        previousValue: null,
        renewalValue: issues.join('; '),
        change: 'Inconsistent',
        severity: 'warning',
        message: `Coverage inconsistency: ${issues.join('; ')}`,
        agentAction: 'BI/PD limits differ between vehicles — verify this is intentional',
        checkType: 'cross_field',
        category: 'Coverages',
        isBlocking: false,
      });
    },
  },
];
