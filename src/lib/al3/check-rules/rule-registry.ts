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
 * Core rules only: coverage limits, deductibles, and premium changes.
 */
export const ALL_RULES: CheckRuleDefinition[] = [
  // Home rules: H-010–H-015 (coverage limits), H-020–H-023 (deductibles), H-030 (premium)
  ...homeCoverageRules,
  ...homeDeductibleRules,
  ...homePremiumRules,

  // Auto rules: A-030–A-038 (coverages/deductibles), A-040 (premium)
  ...autoCoverageRules,
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
