/**
 * Home Endorsement Rules (H-050 to H-058)
 * Phase 7 — Endorsements, discounts, mortgagee
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck } from '../helpers';

const NEGATIVE_ENDORSEMENT_KEYWORDS = [
  'exclusion', 'limitation', 'restrict', 'actual cash value', 'acv roof',
  'cosmetic damage', 'wind excl', 'animal liability', 'trampoline',
  'mold excl', 'water damage excl', 'breed',
];

export const homeEndorsementRules: CheckRuleDefinition[] = [
  {
    ruleId: 'H-050',
    name: 'Endorsement Added',
    description: 'Detect endorsements added in renewal',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const basEndorsements = new Set(ctx.baseline.endorsements.map(e => e.code.toUpperCase()));
      const added = ctx.renewal.endorsements.filter(e => !basEndorsements.has(e.code.toUpperCase()));

      if (added.length === 0) return null;

      return added.map(e => {
        const desc = (e.description || e.code).toLowerCase();
        const isNegative = NEGATIVE_ENDORSEMENT_KEYWORDS.some(kw => desc.includes(kw));

        return makeCheck('H-050', {
          field: `Endorsement: ${e.code}`,
          previousValue: null,
          renewalValue: e.description || e.code,
          change: `Added: ${e.description || e.code}`,
          severity: isNegative ? 'warning' : 'added',
          message: `Endorsement added: ${e.description || e.code}`,
          agentAction: isNegative
            ? 'Negative endorsement added — may restrict coverage, review with customer'
            : 'Review new endorsement — confirm it is expected',
          checkType: 'existence',
          category: 'Endorsements',
          isBlocking: false,
        });
      });
    },
  },
  {
    ruleId: 'H-051',
    name: 'Endorsement Removed',
    description: 'Detect endorsements removed from renewal',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const renEndorsements = new Set(ctx.renewal.endorsements.map(e => e.code.toUpperCase()));
      const removed = ctx.baseline.endorsements.filter(e => !renEndorsements.has(e.code.toUpperCase()));

      if (removed.length === 0) return null;

      return removed.map(e =>
        makeCheck('H-051', {
          field: `Endorsement: ${e.code}`,
          previousValue: e.description || e.code,
          renewalValue: null,
          change: `Removed: ${e.description || e.code}`,
          severity: 'removed',
          message: `Endorsement removed: ${e.description || e.code}`,
          agentAction: 'Endorsement removed — verify with carrier, may affect coverage',
          checkType: 'existence',
          category: 'Endorsements',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'H-052',
    name: 'Endorsement Premium Change',
    description: 'Check if endorsement premiums changed',
    checkType: 'value_change',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const basMap = new Map(ctx.baseline.endorsements.map(e => [e.code.toUpperCase(), e]));
      const results: CheckResult[] = [];

      for (const renEnd of ctx.renewal.endorsements) {
        const basEnd = basMap.get(renEnd.code.toUpperCase());
        if (!basEnd) continue; // Added endorsements handled by H-050
        if (basEnd.premium == null && renEnd.premium == null) continue;

        const basPrem = basEnd.premium ?? 0;
        const renPrem = renEnd.premium ?? 0;
        if (basPrem === renPrem) continue;

        results.push(makeCheck('H-052', {
          field: `Endorsement Premium: ${renEnd.code}`,
          previousValue: basPrem,
          renewalValue: renPrem,
          change: `$${basPrem} → $${renPrem}`,
          severity: renPrem > basPrem ? 'warning' : 'info',
          message: `Endorsement ${renEnd.description || renEnd.code} premium: $${basPrem} → $${renPrem}`,
          agentAction: 'Note endorsement premium change for customer',
          checkType: 'value_change',
          category: 'Endorsements',
          isBlocking: false,
        }));
      }

      return results.length > 0 ? results : null;
    },
  },
  {
    ruleId: 'H-053',
    name: 'Discount Added',
    description: 'Detect new discounts on renewal',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const basDiscounts = new Set(ctx.baseline.discounts.map(d => d.code.toUpperCase()));
      const added = ctx.renewal.discounts.filter(d => !basDiscounts.has(d.code.toUpperCase()));

      if (added.length === 0) return null;

      return added.map(d =>
        makeCheck('H-053', {
          field: `Discount: ${d.code}`,
          previousValue: null,
          renewalValue: d.description || d.code,
          change: `Added: ${d.description || d.code}`,
          severity: 'added',
          message: `Discount added: ${d.description || d.code}`,
          agentAction: 'New discount applied — confirm eligibility',
          checkType: 'existence',
          category: 'Endorsements',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'H-054',
    name: 'Discount Removed',
    description: 'Detect discounts removed from renewal',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const renDiscounts = new Set(ctx.renewal.discounts.map(d => d.code.toUpperCase()));
      const removed = ctx.baseline.discounts.filter(d => !renDiscounts.has(d.code.toUpperCase()));

      if (removed.length === 0) return null;

      return removed.map(d =>
        makeCheck('H-054', {
          field: `Discount: ${d.code}`,
          previousValue: d.description || d.code,
          renewalValue: null,
          change: `Removed: ${d.description || d.code}`,
          severity: 'removed',
          message: `Discount removed: ${d.description || d.code}`,
          agentAction: 'Discount lost — may explain premium increase, verify eligibility',
          checkType: 'existence',
          category: 'Endorsements',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'H-055',
    name: 'Forms Change',
    description: 'Detect policy form changes (HO3→HO5, etc.)',
    checkType: 'value_change',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: () => {
      // Policy form changes detected via LOB field — handled by H-005/H-007
      return null;
    },
  },
  {
    ruleId: 'H-056',
    name: 'Mortgagee Check',
    description: 'Verify mortgagee information is present if expected',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      // Check if renewal has mortgagee info (from parsed AL3 data)
      const mortgagees = ctx.renewal.mortgagees || [];
      const hasMortgagee = mortgagees.length > 0;

      return makeCheck('H-056', {
        field: 'Mortgagee',
        previousValue: null,
        renewalValue: hasMortgagee ? `${mortgagees.length} mortgagee(s)` : 'None',
        change: hasMortgagee ? 'Present' : 'None detected',
        severity: 'info',
        message: hasMortgagee
          ? `${mortgagees.length} mortgagee(s) on file`
          : 'No mortgagee detected — verify if property has a mortgage',
        agentAction: hasMortgagee
          ? 'Verify mortgagee info matches current lender'
          : 'If property has a mortgage, verify mortgagee clause is included',
        checkType: 'existence',
        category: 'Endorsements',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-057',
    name: 'Claims History',
    description: 'Note claims on the policy for context',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const claims = ctx.renewal.claims || [];
      if (claims.length === 0 && (ctx.baseline.claims || []).length === 0) return null;

      const totalClaims = claims.length;
      return makeCheck('H-057', {
        field: 'Claims History',
        previousValue: (ctx.baseline.claims || []).length,
        renewalValue: totalClaims,
        change: `${totalClaims} claim(s)`,
        severity: totalClaims > 0 ? 'info' : 'unchanged',
        message: totalClaims > 0
          ? `${totalClaims} claim(s) on file — may affect premium`
          : 'No claims on file',
        agentAction: totalClaims > 0
          ? 'Review claims — check if any are aging off soon'
          : 'No action needed',
        checkType: 'existence',
        category: 'Endorsements',
        isBlocking: false,
      });
    },
  },
  {
    ruleId: 'H-058',
    name: 'Mortgagee Change',
    description: 'Detect mortgagees added or removed between baseline and renewal',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'home',
    evaluate: (ctx) => {
      const baselineMortgagees = ctx.baseline.mortgagees || [];
      const renewalMortgagees = ctx.renewal.mortgagees || [];

      if (baselineMortgagees.length === 0 && renewalMortgagees.length === 0) return null;

      const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');
      const baselineNames = new Set(baselineMortgagees.map(m => normalize(m.name)));
      const renewalNames = new Set(renewalMortgagees.map(m => normalize(m.name)));

      const results: CheckResult[] = [];

      // Removed mortgagees
      for (const m of baselineMortgagees) {
        if (!renewalNames.has(normalize(m.name))) {
          results.push(makeCheck('H-058', {
            field: `Mortgagee: ${m.name}`,
            previousValue: m.name,
            renewalValue: null,
            change: `Removed: ${m.name}`,
            severity: 'warning',
            message: `Mortgagee removed: ${m.name}`,
            agentAction: 'Verify mortgagee removal is intentional — confirm with customer',
            checkType: 'existence',
            category: 'Endorsements',
            isBlocking: false,
          }));
        }
      }

      // Added mortgagees
      for (const m of renewalMortgagees) {
        if (!baselineNames.has(normalize(m.name))) {
          results.push(makeCheck('H-058', {
            field: `Mortgagee: ${m.name}`,
            previousValue: null,
            renewalValue: m.name,
            change: `Added: ${m.name}`,
            severity: 'info',
            message: `Mortgagee added: ${m.name}`,
            agentAction: 'Verify new mortgagee info is correct',
            checkType: 'existence',
            category: 'Endorsements',
            isBlocking: false,
          }));
        }
      }

      return results.length > 0 ? results : null;
    },
  },
];
