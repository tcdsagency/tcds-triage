/**
 * Rule Registry
 * =============
 * Aggregates all check rules and provides lookup functions.
 */

import type { CheckRuleDefinition } from '@/types/check-rules.types';

// Home rules
import { homeIdentityRules } from './rules/home-identity';
import { homeCoverageRules } from './rules/home-coverages';
import { homeDeductibleRules } from './rules/home-deductibles';
import { homePremiumRules } from './rules/home-premium';
import { homePropertyRules } from './rules/home-property';
import { homeEndorsementRules } from './rules/home-endorsements';

// Auto rules
import { autoIdentityRules } from './rules/auto-identity';
import { autoVehicleRules } from './rules/auto-vehicles';
import { autoDriverRules } from './rules/auto-drivers';
import { autoCoverageRules } from './rules/auto-coverages';
import { autoPremiumRules } from './rules/auto-premium';
import { autoEndorsementRules } from './rules/auto-endorsements';

/**
 * All rules in one flat array.
 */
export const ALL_RULES: CheckRuleDefinition[] = [
  // Home rules (H-001 to H-058)
  ...homeIdentityRules,
  ...homeCoverageRules,
  ...homeDeductibleRules,
  ...homePremiumRules,
  ...homePropertyRules,
  ...homeEndorsementRules,

  // Auto rules (A-001 to A-052)
  ...autoIdentityRules,
  ...autoVehicleRules,
  ...autoDriverRules,
  ...autoCoverageRules,
  ...autoPremiumRules,
  ...autoEndorsementRules,
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
