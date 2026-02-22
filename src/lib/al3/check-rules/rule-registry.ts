/**
 * Rule Registry
 * =============
 * Aggregates all check rules and provides lookup functions.
 */

import type { CheckRuleDefinition } from '@/types/check-rules.types';

// Home rules
import { homeCoverageRules } from './rules/home-coverages';
import { homeDeductibleRules } from './rules/home-deductibles';
import { homePremiumRules } from './rules/home-premium';

// Auto rules
import { autoCoverageRules } from './rules/auto-coverages';
import { autoPremiumRules } from './rules/auto-premium';

/**
 * All rules in one flat array.
 *
 * Phase roadmap & reserved rule ID ranges:
 *   Phase 1 (IDENTITY):    H-001–H-009 / A-001–A-009  — reserved
 *   Phase 2 (DATA QUALITY): H-002–H-009 / A-002–A-009  — reserved (shares range with phase 1)
 *   Phase 3 (COVERAGE):    H-010–H-029 / A-030–A-039  — ACTIVE
 *   Phase 4 (PREMIUM):     H-030–H-039 / A-040–A-049  — ACTIVE
 *   Phase 5 (MATH):        H-040–H-049 / A-050–A-059  — reserved
 *   Phase 6 (CROSS-FIELD): H-050–H-059 / A-060–A-069  — reserved
 *   Phase 7 (PROPERTY):    H-060–H-069 / A-070–A-079  — reserved
 */
export const ALL_RULES: CheckRuleDefinition[] = [
  // Phase 3 — Home: H-010–H-015 (coverage limits), H-020–H-023 (deductibles)
  ...homeCoverageRules,
  ...homeDeductibleRules,

  // Phase 4 — Home: H-030 (premium)
  ...homePremiumRules,

  // Phase 3 — Auto: A-030–A-038 (coverages/deductibles)
  ...autoCoverageRules,

  // Phase 4 — Auto: A-040 (premium)
  ...autoPremiumRules,
];

/**
 * Get rules applicable for a given LOB.
 */
export function getRulesForLOB(lob: string): CheckRuleDefinition[] {
  const isHome = lob.toLowerCase().includes('home') ||
    lob.toLowerCase().includes('dwelling') ||
    lob.toLowerCase().includes('ho-') ||
    lob.toLowerCase() === 'ho3' ||
    lob.toLowerCase() === 'ho5' ||
    lob.toLowerCase() === 'dp3';

  const isAuto = lob.toLowerCase().includes('auto') ||
    lob.toLowerCase().includes('vehicle') ||
    lob.toLowerCase().includes('car') ||
    lob.toLowerCase().includes('personal auto');

  return ALL_RULES.filter(rule => {
    if (rule.lob === 'both') return true;
    if (rule.lob === 'home' && isHome) return true;
    if (rule.lob === 'auto' && isAuto) return true;
    return false;
  });
}

/**
 * Get rules for a specific phase.
 */
export function getRulesForPhase(rules: CheckRuleDefinition[], phase: number): CheckRuleDefinition[] {
  return rules.filter(r => r.phase === phase);
}

/**
 * Lookup a single rule by ID.
 */
export function getRuleById(ruleId: string): CheckRuleDefinition | undefined {
  return ALL_RULES.find(r => r.ruleId === ruleId);
}

/**
 * Get all blocking rules.
 */
export function getBlockingRules(rules: CheckRuleDefinition[]): CheckRuleDefinition[] {
  return rules.filter(r => r.isBlocking);
}
