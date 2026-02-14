/**
 * Home Property Rules (H-040 to H-047)
 * Phase 6 — Property details
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck, fmtDollars, pctChange } from '../helpers';

export const homePropertyRules: CheckRuleDefinition[] = [
  {
    ruleId: 'H-040',
    name: 'Construction Type',
    description: 'Check if construction type changed',
    checkType: 'value_change',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const basConst = ctx.baseline.propertyContext?.constructionType || null;
      // Construction type isn't on renewal snapshot — info only
      if (!basConst) return null;
      return makeCheck('H-040', {
        field: 'Construction Type',
        previousValue: basConst,
        renewalValue: null,
        change: basConst,
        severity: 'info',
        message: `Construction type: ${basConst}`,
        agentAction: 'Informational — verify matches property records',
        checkType: 'value_change',
        category: 'Property',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-041',
    name: 'Year Built',
    description: 'Check year built and calculate age',
    checkType: 'value_change',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const yearBuilt = ctx.baseline.propertyContext?.yearBuilt;
      if (!yearBuilt) return null;
      const age = new Date().getFullYear() - yearBuilt;
      return makeCheck('H-041', {
        field: 'Year Built',
        previousValue: yearBuilt,
        renewalValue: yearBuilt,
        change: `Built ${yearBuilt} (${age} years old)`,
        severity: age > 40 ? 'info' : 'unchanged',
        message: `Property built in ${yearBuilt} (${age} years old)`,
        agentAction: age > 40 ? 'Older home — verify adequate coverage for older systems' : 'No action needed',
        checkType: 'value_change',
        category: 'Property',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-042',
    name: 'Square Footage',
    description: 'Note square footage if available',
    checkType: 'value_change',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: () => {
      // Square footage not typically on snapshots — placeholder
      return null;
    },
  },
  {
    ruleId: 'H-043',
    name: 'Roof Age',
    description: 'Check roof age and flag if over 15 years',
    checkType: 'value_change',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const roofAge = ctx.baseline.propertyContext?.roofAge;
      if (roofAge == null) return null;

      let severity: CheckResult['severity'] = 'unchanged';
      if (roofAge >= 20) severity = 'critical';
      else if (roofAge >= 15) severity = 'warning';
      else if (roofAge >= 10) severity = 'info';

      return makeCheck('H-043', {
        field: 'Roof Age',
        previousValue: roofAge,
        renewalValue: roofAge,
        change: `${roofAge} years`,
        severity,
        message: `Roof is ${roofAge} years old`,
        agentAction: severity === 'critical'
          ? 'Roof over 20 years — may face non-renewal or surcharge, discuss replacement with customer'
          : severity === 'warning'
          ? 'Roof 15-20 years — proactively discuss replacement timeline'
          : 'No action needed',
        checkType: 'value_change',
        category: 'Property',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-044',
    name: 'Roof Type',
    description: 'Note roof type for underwriting',
    checkType: 'value_change',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const roofType = ctx.baseline.propertyContext?.roofType || null;
      if (!roofType) return null;
      return makeCheck('H-044', {
        field: 'Roof Type',
        previousValue: roofType,
        renewalValue: roofType,
        change: roofType,
        severity: 'info',
        message: `Roof type: ${roofType}`,
        agentAction: 'Informational',
        checkType: 'value_change',
        category: 'Property',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-045',
    name: 'Replacement Cost Estimate',
    description: 'Check Coverage A vs replacement cost drift',
    checkType: 'cross_field',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      // RCE comparison requires baseline property context with known RCE
      // Coverage A is the dwelling limit from renewal
      const covA = ctx.renewal.coverages.find(c => c.type === 'dwelling')?.limitAmount;
      if (!covA) return null;

      // If we don't have RCE data, just report the dwelling limit
      return makeCheck('H-045', {
        field: 'Replacement Cost',
        previousValue: null,
        renewalValue: covA,
        change: fmtDollars(covA),
        severity: 'info',
        message: `Dwelling limit: ${fmtDollars(covA)} — verify against current replacement cost estimate`,
        agentAction: 'Verify dwelling limit is adequate for current replacement costs',
        checkType: 'cross_field',
        category: 'Property',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-046',
    name: 'Inflation Guard',
    description: 'Check if dwelling limit reflects inflation guard increase',
    checkType: 'cross_field',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const basDwell = ctx.baseline.coverages.find(c => c.type === 'dwelling')?.limitAmount;
      const renDwell = ctx.renewal.coverages.find(c => c.type === 'dwelling')?.limitAmount;

      if (!basDwell || !renDwell) return null;
      if (renDwell <= basDwell) return null; // Only flag if it increased

      const pct = pctChange(basDwell, renDwell);
      // Typical inflation guard is 2-6% per year
      const likelyInflationGuard = pct > 0 && pct <= 8;

      return makeCheck('H-046', {
        field: 'Inflation Guard',
        previousValue: fmtDollars(basDwell),
        renewalValue: fmtDollars(renDwell),
        change: `+${pct.toFixed(1)}%`,
        severity: 'info',
        message: likelyInflationGuard
          ? `Dwelling increased ${pct.toFixed(1)}% — likely inflation guard`
          : `Dwelling increased ${pct.toFixed(1)}% — exceeds typical inflation guard range`,
        agentAction: likelyInflationGuard
          ? 'Inflation guard applied — standard annual increase'
          : 'Dwelling increase larger than typical inflation guard — verify reason',
        checkType: 'cross_field',
        category: 'Property',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-047',
    name: 'Protection Class',
    description: 'Note protection class if available',
    checkType: 'value_change',
    category: 'Property',
    phase: 6,
    isBlocking: false,
    lob: 'home',
    evaluate: () => {
      // Protection class not typically on snapshots — placeholder
      return null;
    },
  },
];
