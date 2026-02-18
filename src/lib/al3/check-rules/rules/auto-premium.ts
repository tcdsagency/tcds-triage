/**
 * Auto Premium Rules (A-040)
 * Phase 4 — Premium change severity classification
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck, fmtDollars, fmtPercent, pctChange } from '../helpers';

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
];
