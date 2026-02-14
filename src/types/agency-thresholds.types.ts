/**
 * Agency Thresholds
 * =================
 * Extended thresholds used by the check rules engine.
 * Extends the existing ComparisonThresholds with rule-specific values.
 */

import type { ComparisonThresholds } from './renewal.types';

export interface AgencyThresholds extends ComparisonThresholds {
  // Premium severity tiers
  premiumIncreaseCritical: number;    // 25%
  premiumIncreaseWarning: number;     // 15%
  premiumIncreaseInfo: number;        // 5%

  // Homeowners coverage ratios (relative to Coverage A)
  covBRatioDrift: number;             // 2% — Other Structures / Dwelling drift tolerance
  covCRatioMin: number;               // 40% — Personal Property min ratio to Dwelling
  covCRatioMax: number;               // 80% — Personal Property max ratio to Dwelling
  covDRatioDrift: number;             // 2% — Loss of Use / Dwelling drift tolerance
  covAReplacementDrift: number;       // 5% — Coverage A vs replacement cost drift

  // Premium math tolerances
  premiumMathToleranceHome: number;   // $1
  premiumMathToleranceAuto: number;   // $2
}

export const DEFAULT_AGENCY_THRESHOLDS: AgencyThresholds = {
  // Existing comparison thresholds
  premiumIncreasePercent: 10,
  premiumIncreaseAmount: 200,
  coverageLimitReductionPercent: 20,
  deductibleIncreasePercent: 50,

  // Premium severity tiers
  premiumIncreaseCritical: 25,
  premiumIncreaseWarning: 15,
  premiumIncreaseInfo: 5,

  // Homeowners coverage ratios
  covBRatioDrift: 2,
  covCRatioMin: 40,
  covCRatioMax: 80,
  covDRatioDrift: 2,
  covAReplacementDrift: 5,

  // Premium math tolerances
  premiumMathToleranceHome: 1,
  premiumMathToleranceAuto: 2,
};
