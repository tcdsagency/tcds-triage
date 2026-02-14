/**
 * Auto Endorsement Rules (A-050 to A-052)
 * Phase 7 — Endorsements and forms
 */

import type { CheckRuleDefinition, CheckResult } from '@/types/check-rules.types';
import { makeCheck } from '../helpers';

export const autoEndorsementRules: CheckRuleDefinition[] = [
  {
    ruleId: 'A-050',
    name: 'Endorsement Added',
    description: 'Detect auto endorsements added in renewal',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const basEndorsements = new Set(ctx.baseline.endorsements.map(e => e.code.toUpperCase()));
      const added = ctx.renewal.endorsements.filter(e => !basEndorsements.has(e.code.toUpperCase()));

      if (added.length === 0) return null;

      return added.map(e =>
        makeCheck('A-050', {
          field: `Endorsement: ${e.code}`,
          previousValue: null,
          renewalValue: e.description || e.code,
          change: `Added: ${e.description || e.code}`,
          severity: 'added',
          message: `Endorsement added: ${e.description || e.code}`,
          agentAction: 'Review new endorsement',
          checkType: 'existence',
          category: 'Endorsements',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'A-051',
    name: 'Endorsement Removed',
    description: 'Detect auto endorsements removed from renewal',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'auto',
    evaluate: (ctx) => {
      const renEndorsements = new Set(ctx.renewal.endorsements.map(e => e.code.toUpperCase()));
      const removed = ctx.baseline.endorsements.filter(e => !renEndorsements.has(e.code.toUpperCase()));

      if (removed.length === 0) return null;

      return removed.map(e =>
        makeCheck('A-051', {
          field: `Endorsement: ${e.code}`,
          previousValue: e.description || e.code,
          renewalValue: null,
          change: `Removed: ${e.description || e.code}`,
          severity: 'removed',
          message: `Endorsement removed: ${e.description || e.code}`,
          agentAction: 'Endorsement removed — verify with carrier',
          checkType: 'existence',
          category: 'Endorsements',
          isBlocking: false,
        })
      );
    },
  },
  {
    ruleId: 'A-052',
    name: 'Policy Forms',
    description: 'Note any changes to auto policy forms',
    checkType: 'existence',
    category: 'Endorsements',
    phase: 7,
    isBlocking: false,
    lob: 'auto',
    evaluate: () => {
      // Auto form changes typically come through as endorsement changes
      // This is a placeholder that defers to A-050/A-051
      return null;
    },
  },
];
