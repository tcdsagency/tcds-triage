/**
 * Auto Premium Rules (A-040 to A-045)
 * Phase 4 (threshold) + Phase 5 (premium math)
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck, fmtDollars, fmtPercent, pctChange, norm } from '../helpers';

export const autoPremiumRules: CheckRuleDefinition[] = [
  {
    ruleId: 'A-040',
    name: 'Total Premium Change',
    description: 'Classify auto premium change by severity tier',
    checkType: 'threshold',
    category: 'Premium',
    phase: 4,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const basPrem = ctx.baseline.premium ?? null;
      const renPrem = ctx.renewal.premium ?? null;

      if (basPrem == null || renPrem == null) {
        return makeCheck('A-040', {
          field: 'Total Premium',
          previousValue: basPrem,
          renewalValue: renPrem,
          change: 'Cannot compare',
          severity: 'info',
          message: basPrem == null
            ? `Renewal premium: ${fmtDollars(renPrem)} (no baseline)`
            : 'Renewal premium missing',
          agentAction: 'Cannot calculate premium change — verify manually',
          checkType: 'threshold',
          category: 'Premium',
          isBlocking: false,
        });
      }

      const diff = renPrem - basPrem;
      const pct = pctChange(basPrem, renPrem);
      const absPct = Math.abs(pct);

      let severity: CheckResult['severity'] = 'unchanged';
      if (diff > 0) {
        if (absPct >= ctx.thresholds.premiumIncreaseCritical) severity = 'critical';
        else if (absPct >= ctx.thresholds.premiumIncreaseWarning) severity = 'warning';
        else if (absPct >= ctx.thresholds.premiumIncreaseInfo) severity = 'info';

        // Dollar-amount floor: if increase exceeds the comparison engine's
        // dollar threshold, severity should be at least warning
        if (diff >= ctx.thresholds.premiumIncreaseAmount && severity === 'info') {
          severity = 'warning';
        }
      } else if (diff < 0) {
        severity = 'info';
      }

      return makeCheck('A-040', {
        field: 'Total Premium',
        previousValue: basPrem,
        renewalValue: renPrem,
        change: diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${fmtDollars(diff)} (${fmtPercent(pct)})`,
        severity,
        message: diff === 0
          ? `Premium unchanged at ${fmtDollars(renPrem)}`
          : `Premium ${diff > 0 ? 'increased' : 'decreased'}: ${fmtDollars(basPrem)} → ${fmtDollars(renPrem)} (${fmtPercent(pct)})`,
        agentAction: severity === 'critical'
          ? 'Premium increase exceeds 25% — reshop immediately'
          : severity === 'warning'
          ? 'Premium increase 10-25% — consider reshopping'
          : 'No action needed',
        checkType: 'threshold',
        category: 'Premium',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'A-041',
    name: 'Per-Vehicle Premium',
    description: 'Check premium changes per vehicle',
    checkType: 'value_change',
    category: 'Premium',
    phase: 4,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      // Per-vehicle premiums require summing coverage premiums per vehicle
      const results: CheckResult[] = [];

      for (const renV of ctx.renewal.vehicles) {
        const renVPrem = renV.coverages.reduce((sum, c) => sum + (c.premium ?? 0), 0);
        if (renVPrem === 0) continue;

        // Find matching baseline vehicle
        const basV = ctx.baseline.vehicles.find(bv =>
          (bv.vin && renV.vin && norm(bv.vin) === norm(renV.vin)) ||
          (bv.year === renV.year && norm(bv.make) === norm(renV.make))
        );

        const basVPrem = basV ? basV.coverages.reduce((sum, c) => sum + (c.premium ?? 0), 0) : 0;
        const label = [renV.year, renV.make, renV.model].filter(Boolean).join(' ') || renV.vin || 'Unknown';

        if (basVPrem === 0 && renVPrem === 0) continue;

        const diff = renVPrem - basVPrem;
        if (Math.abs(diff) < 1) continue; // Skip negligible changes

        results.push(makeCheck('A-041', {
          field: `Vehicle Premium: ${label}`,
          previousValue: basVPrem,
          renewalValue: renVPrem,
          change: `${diff > 0 ? '+' : ''}${fmtDollars(diff)}`,
          severity: Math.abs(diff) > 100 ? 'info' : 'unchanged',
          message: `${label}: ${fmtDollars(basVPrem)} → ${fmtDollars(renVPrem)}`,
          agentAction: 'Per-vehicle premium change — informational',
          checkType: 'value_change',
          category: 'Premium',
          isBlocking: false,
        }));
      }

      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'A-042',
    name: 'Premium Math Verification',
    description: 'Verify vehicle premiums sum to total (BLOCKING on failure)',
    checkType: 'math',
    category: 'Premium',
    phase: 5,
    isBlocking: true,
    lob: 'auto',
    evaluate: (ctx) => {
      const totalPrem = ctx.renewal.premium;
      if (totalPrem == null) return null;

      // Sum premiums from all vehicles
      let vehSum = 0;
      let hasVehPremiums = false;
      for (const v of ctx.renewal.vehicles) {
        for (const c of v.coverages) {
          if (c.premium != null) {
            vehSum += c.premium;
            hasVehPremiums = true;
          }
        }
      }
      // Also add policy-level coverage premiums
      for (const c of ctx.renewal.coverages) {
        if (c.premium != null) {
          vehSum += c.premium;
          hasVehPremiums = true;
        }
      }

      if (!hasVehPremiums) return null;

      const diff = Math.abs(totalPrem - vehSum);
      const tolerance = ctx.thresholds.premiumMathToleranceAuto;
      const passes = diff <= tolerance;

      return makeCheck('A-042', {
        field: 'Premium Math',
        previousValue: `Sum: ${fmtDollars(vehSum)}`,
        renewalValue: `Total: ${fmtDollars(totalPrem)}`,
        change: passes ? `Diff: ${fmtDollars(diff)} (OK)` : `Diff: ${fmtDollars(diff)} EXCEEDS tolerance`,
        severity: passes ? 'unchanged' : 'critical',
        message: passes
          ? `Premium math OK: sum ${fmtDollars(vehSum)} ≈ total ${fmtDollars(totalPrem)}`
          : `Premium math FAILED: sum ${fmtDollars(vehSum)} ≠ total ${fmtDollars(totalPrem)} (diff: ${fmtDollars(diff)})`,
        agentAction: passes
          ? 'No action needed'
          : 'STOP: Premium math does not add up — possible parsing error',
        checkType: 'math',
        category: 'Premium',
        isBlocking: true,
      });
    },
  },
  {
    ruleId: 'A-043',
    name: 'Discount Changes',
    description: 'Check for auto discount changes',
    checkType: 'existence',
    category: 'Premium',
    phase: 4,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const basDiscounts = new Set(ctx.baseline.discounts.map(d => d.code.toUpperCase()));
      const renDiscounts = new Set(ctx.renewal.discounts.map(d => d.code.toUpperCase()));

      const added = [...renDiscounts].filter(d => !basDiscounts.has(d));
      const removed = [...basDiscounts].filter(d => !renDiscounts.has(d));

      if (added.length === 0 && removed.length === 0) {
        return makeCheck('A-043', {
          field: 'Discounts',
          previousValue: basDiscounts.size,
          renewalValue: renDiscounts.size,
          change: 'No change',
          severity: 'unchanged',
          message: `${renDiscounts.size} discount(s) — no changes`,
          agentAction: 'No action needed',
          checkType: 'existence',
          category: 'Premium',
          isBlocking: false,
        });
      }

      const parts: string[] = [];
      if (added.length > 0) parts.push(`Added: ${added.join(', ')}`);
      if (removed.length > 0) parts.push(`Removed: ${removed.join(', ')}`);

      return makeCheck('A-043', {
        field: 'Discounts',
        previousValue: `${basDiscounts.size} discounts`,
        renewalValue: `${renDiscounts.size} discounts`,
        change: parts.join('; '),
        severity: removed.length > 0 ? 'warning' : 'info',
        message: parts.join('; '),
        agentAction: removed.length > 0
          ? `Discount(s) removed: ${removed.join(', ')} — may explain premium increase`
          : `New discount(s): ${added.join(', ')}`,
        checkType: 'existence',
        category: 'Premium',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'A-044',
    name: 'Surcharge Check',
    description: 'Check for surcharges or violations',
    checkType: 'existence',
    category: 'Premium',
    phase: 4,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      // Look for claims/violations that might be causing surcharges
      const claims = ctx.renewal.claims || [];
      const basClaims = ctx.baseline.claims || [];
      const newClaims = claims.length - basClaims.length;

      if (claims.length === 0 && basClaims.length === 0) return null;

      return makeCheck('A-044', {
        field: 'Claims/Violations',
        previousValue: basClaims.length,
        renewalValue: claims.length,
        change: newClaims === 0 ? 'No change' : `${newClaims > 0 ? '+' : ''}${newClaims} claim(s)`,
        severity: newClaims > 0 ? 'warning' : claims.length > 0 ? 'info' : 'unchanged',
        message: newClaims > 0
          ? `${newClaims} new claim(s)/violation(s) — may cause surcharge`
          : `${claims.length} claim(s) on file`,
        agentAction: newClaims > 0
          ? 'New claims detected — check surcharge impact and aging timeline'
          : claims.length > 0
          ? 'Review claim aging — some may be falling off soon'
          : 'No action needed',
        checkType: 'existence',
        category: 'Premium',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'A-045',
    name: 'Required Coverages',
    description: 'Verify all state-required auto coverages are present',
    checkType: 'existence',
    category: 'Premium',
    phase: 5,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      // BI and PD are required in all states; check policy-level + vehicle-level
      const allCovs = [
        ...ctx.renewal.coverages,
        ...ctx.renewal.vehicles.flatMap(v => v.coverages),
      ];
      const expectedCovs = ['bodily_injury', 'property_damage'];
      const missing = expectedCovs.filter(type =>
        !allCovs.some(c => c.type === type && c.limitAmount != null && c.limitAmount > 0)
      );

      if (missing.length === 0) {
        return makeCheck('A-045', {
          field: 'Required Coverages',
          previousValue: null,
          renewalValue: `${allCovs.length} coverages`,
          change: 'All present',
          severity: 'unchanged',
          message: 'All required auto coverages present (BI, PD)',
          agentAction: 'No action needed',
          checkType: 'existence',
          category: 'Premium',
          isBlocking: false,
        });
      }

      const labels = missing.map(m => m === 'bodily_injury' ? 'Bodily Injury' : 'Property Damage');
      return makeCheck('A-045', {
        field: 'Required Coverages',
        previousValue: null,
        renewalValue: `Missing: ${labels.join(', ')}`,
        change: `Missing ${missing.length} coverage(s)`,
        severity: 'warning',
        message: `Required coverage(s) missing: ${labels.join(', ')}`,
        agentAction: `Verify missing coverages: ${labels.join(', ')} — may be parsing issue or state-minimum gap`,
        checkType: 'existence',
        category: 'Premium',
        isBlocking: false,
      });
    },
  },
];
