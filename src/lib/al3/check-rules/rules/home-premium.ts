/**
 * Home Premium Rules (H-030 to H-033)
 * Phase 4 (threshold) + Phase 5 (premium math)
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck, fmtDollars, fmtPercent, pctChange } from '../helpers';

export const homePremiumRules: CheckRuleDefinition[] = [
  {
    ruleId: 'H-030',
    name: 'Total Premium Change',
    description: 'Classify total premium change by severity tier',
    checkType: 'threshold',
    category: 'Premium',
    phase: 4,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const basPrem = ctx.baseline.premium ?? null;
      const renPrem = ctx.renewal.premium ?? null;

      if (basPrem == null || renPrem == null) {
        return makeCheck('H-030', {
          field: 'Total Premium',
          previousValue: basPrem,
          renewalValue: renPrem,
          change: basPrem == null && renPrem == null ? 'N/A' : renPrem != null ? `${fmtDollars(renPrem)}` : 'MISSING',
          severity: 'info',
          message: basPrem == null
            ? `Renewal premium: ${fmtDollars(renPrem)} (no baseline to compare)`
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
        severity = 'info'; // Decreases are always informational
      }

      return makeCheck('H-030', {
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
          : severity === 'info' && diff > 0
          ? 'Moderate premium increase — note for customer'
          : 'No action needed',
        checkType: 'threshold',
        category: 'Premium',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-031',
    name: 'Discount Changes',
    description: 'Check for added or removed discounts',
    checkType: 'existence',
    category: 'Premium',
    phase: 4,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const basDiscounts = new Set(ctx.baseline.discounts.map(d => d.code.toUpperCase()));
      const renDiscounts = new Set(ctx.renewal.discounts.map(d => d.code.toUpperCase()));

      const added = [...renDiscounts].filter(d => !basDiscounts.has(d));
      const removed = [...basDiscounts].filter(d => !renDiscounts.has(d));

      if (added.length === 0 && removed.length === 0) {
        return makeCheck('H-031', {
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

      return makeCheck('H-031', {
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
    ruleId: 'H-032',
    name: 'Premium Math Verification',
    description: 'Verify coverage premiums sum to total premium (BLOCKING on failure)',
    checkType: 'math',
    category: 'Premium',
    phase: 5,
    isBlocking: true,
    lob: 'home',
    evaluate: (ctx) => {
      const totalPrem = ctx.renewal.premium;
      if (totalPrem == null) return null;

      // Sum all coverage premiums
      let covSum = 0;
      let hasCovPremiums = false;
      for (const cov of ctx.renewal.coverages) {
        if (cov.premium != null) {
          covSum += cov.premium;
          hasCovPremiums = true;
        }
      }

      // Skip if no individual coverage premiums to sum
      if (!hasCovPremiums) return null;

      const diff = Math.abs(totalPrem - covSum);
      const tolerance = ctx.thresholds.premiumMathToleranceHome;
      const passes = diff <= tolerance;

      return makeCheck('H-032', {
        field: 'Premium Math',
        previousValue: `Sum: ${fmtDollars(covSum)}`,
        renewalValue: `Total: ${fmtDollars(totalPrem)}`,
        change: passes ? `Diff: ${fmtDollars(diff)} (within ${fmtDollars(tolerance)} tolerance)` : `Diff: ${fmtDollars(diff)} EXCEEDS tolerance`,
        severity: passes ? 'unchanged' : 'critical',
        message: passes
          ? `Premium math checks out: coverage sum ${fmtDollars(covSum)} ≈ total ${fmtDollars(totalPrem)}`
          : `Premium math FAILED: coverage sum ${fmtDollars(covSum)} ≠ total ${fmtDollars(totalPrem)} (diff: ${fmtDollars(diff)})`,
        agentAction: passes
          ? 'No action needed'
          : 'STOP: Premium math does not add up — possible parsing error or missing coverage',
        checkType: 'math',
        category: 'Premium',
        isBlocking: true,
      });
    },
  },
  {
    ruleId: 'H-033',
    name: 'Coverage Sum Check',
    description: 'Verify all expected coverages are present and have limits',
    checkType: 'existence',
    category: 'Premium',
    phase: 5,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const expectedCovs = ['dwelling', 'personal_liability'];
      const missing = expectedCovs.filter(type =>
        !ctx.renewal.coverages.some(c => c.type === type && c.limitAmount != null && c.limitAmount > 0)
      );

      if (missing.length === 0) {
        return makeCheck('H-033', {
          field: 'Required Coverages',
          previousValue: null,
          renewalValue: `${ctx.renewal.coverages.length} coverages`,
          change: 'All present',
          severity: 'unchanged',
          message: 'All expected homeowner coverages present',
          agentAction: 'No action needed',
          checkType: 'existence',
          category: 'Premium',
          isBlocking: false,
        });
      }

      return makeCheck('H-033', {
        field: 'Required Coverages',
        previousValue: null,
        renewalValue: `Missing: ${missing.join(', ')}`,
        change: `Missing ${missing.length} coverage(s)`,
        severity: 'warning',
        message: `Expected coverage(s) missing: ${missing.join(', ')}`,
        agentAction: `Verify missing coverages: ${missing.join(', ')} — may be parsing issue or intentional removal`,
        checkType: 'existence',
        category: 'Premium',
        isBlocking: false,
      });
    },
  },
];
