/**
 * Renewal Review Types
 * ====================
 * Type definitions for the IVANS AL3 renewal review module.
 */

// =============================================================================
// AL3 TRANSACTION TYPES
// =============================================================================

/**
 * Parsed header from an AL3 transaction (quick scan, no full parse).
 */
export interface AL3TransactionHeader {
  transactionType: string; // e.g., 'RWL', 'RWQ', 'NBS', 'END'
  policyNumber: string;
  carrierCode: string; // NAIC code
  carrierName?: string;
  lineOfBusiness?: string;
  effectiveDate?: string; // YYYYMMDD
  expirationDate?: string; // YYYYMMDD
  insuredName?: string;
}

/**
 * Fully parsed AL3 transaction.
 */
export interface AL3ParsedTransaction {
  header: AL3TransactionHeader;
  coverages: AL3Coverage[];
  vehicles: AL3Vehicle[];
  drivers: AL3Driver[];
  locations: AL3Location[];
  remarks: string[];
  claims: AL3Claim[];
  endorsementRecords: AL3Endorsement[];
  discountRecords: AL3Discount[];
  mortgagees: AL3Mortgagee[];
  insuredAddress?: AL3Location;
  insuredEmail?: string;
  insuredPhone?: string;
  rawContent: string;
  parseConfidence: number; // 0-1
  // Total premium from 5BPI record (policy-level, authoritative)
  totalPremium?: number;
}

export interface AL3Coverage {
  code: string;
  description?: string;
  limit?: string;
  limitAmount?: number;
  deductible?: string;
  deductibleAmount?: number;
  premium?: number;
}

export interface AL3Vehicle {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  usage?: string;
  garageZip?: string;
  coverages: AL3Coverage[];
}

export interface AL3Driver {
  name?: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  licenseState?: string;
  relationship?: string;
  isExcluded?: boolean;
}

export interface AL3Location {
  number?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface AL3Discount {
  code: string;
  description?: string;
  amount?: number;
  percent?: number;
}

export interface AL3Claim {
  claimNumber?: string;
  claimDate?: string;
  claimType?: string;
  amount?: number;
  status?: string;
}

export interface AL3Endorsement {
  code: string;
  description?: string;
  effectiveDate?: string;
  premium?: number;
}

export interface AL3Mortgagee {
  interestType?: string; // LH=Lienholder, MS=Mortgagee, CN=Co-Named
  name?: string;
  loanNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// =============================================================================
// CANONICAL SNAPSHOT TYPES
// =============================================================================

/**
 * Normalized coverage (carrier-agnostic).
 */
export interface CanonicalCoverage {
  type: string; // e.g., 'bodily_injury', 'property_damage', 'collision'
  description: string;
  limit?: string;
  limitAmount?: number;
  deductible?: string;
  deductibleAmount?: number;
  premium?: number;
  inflationGuardPercent?: number;
  valuationTypeCode?: string; // "RCV" | "ACV" | etc.
}

/**
 * Normalized vehicle.
 */
export interface CanonicalVehicle {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  usage?: string;
  coverages: CanonicalCoverage[];
  annualMileage?: number;
  costNew?: number;
  estimatedValue?: number;
  primaryDriver?: string;
  lienholder?: string;
}

/**
 * Normalized driver.
 */
export interface CanonicalDriver {
  name?: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  licenseState?: string;
  relationship?: string;
  isExcluded?: boolean;
}

/**
 * Normalized discount.
 */
export interface CanonicalDiscount {
  code: string;
  description: string;
  amount?: number;
  percent?: number;
}

/**
 * Normalized claim.
 */
export interface CanonicalClaim {
  claimNumber?: string;
  claimDate?: string;
  claimType?: string;
  amount?: number;
  status?: string;
}

/**
 * Normalized endorsement.
 */
export interface CanonicalEndorsement {
  code: string;
  description: string;
  effectiveDate?: string;
  premium?: number;
}

/**
 * Property context for homeowners risk evaluation.
 */
export interface PropertyContext {
  roofAge?: number;
  roofType?: string;
  yearBuilt?: number;
  constructionType?: string;
}

/**
 * Renewal offer snapshot (from AL3).
 */
export interface RenewalSnapshot {
  insuredName?: string;
  insuredAddress?: string;
  insuredCity?: string;
  insuredState?: string;
  insuredZip?: string;
  insuredEmail?: string;
  insuredPhone?: string;
  premium?: number;
  coverages: CanonicalCoverage[];
  vehicles: CanonicalVehicle[];
  drivers: CanonicalDriver[];
  endorsements: CanonicalEndorsement[];
  discounts: CanonicalDiscount[];
  claims: CanonicalClaim[];
  parseConfidence: number; // 0-1
  parsedAt: string; // ISO timestamp
  sourceFileName?: string;
}

/**
 * Current policy baseline (from HawkSoft).
 */
export interface BaselineSnapshot {
  premium?: number;
  coverages: CanonicalCoverage[];
  vehicles: CanonicalVehicle[];
  drivers: CanonicalDriver[];
  endorsements: CanonicalEndorsement[];
  discounts: CanonicalDiscount[];
  claims: CanonicalClaim[];
  propertyContext?: PropertyContext;
  // Policy term dates - used to detect stale baseline
  policyEffectiveDate?: string; // ISO date
  policyExpirationDate?: string; // ISO date
  fetchedAt: string; // ISO timestamp
  fetchSource: 'hawksoft_api' | 'local_cache' | 'prior_term_snapshot';
}

// =============================================================================
// COMPARISON TYPES
// =============================================================================

export type ChangeSeverity = 'material_negative' | 'material_positive' | 'non_material';

export type ChangeCategory =
  | 'premium'
  | 'coverage_limit'
  | 'coverage_removed'
  | 'coverage_added'
  | 'deductible'
  | 'vehicle_removed'
  | 'vehicle_added'
  | 'driver_removed'
  | 'driver_added'
  | 'endorsement'
  | 'endorsement_removed'
  | 'endorsement_added'
  | 'discount'
  | 'discount_removed'
  | 'discount_added'
  | 'claim'
  | 'property'
  | 'other';

/**
 * A single detected change between renewal and baseline.
 */
export interface MaterialChange {
  field: string;
  category: ChangeCategory;
  classification: ChangeSeverity;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  changeAmount?: number;
  changePercent?: number;
  severity: ChangeSeverity;
  description: string;
}

/**
 * Quick display summary for the comparison.
 */
export interface ComparisonSummary {
  premiumDirection: 'increase' | 'decrease' | 'same';
  premiumChangeAmount?: number;
  premiumChangePercent?: number;
  materialNegativeCount: number;
  materialPositiveCount: number;
  nonMaterialCount: number;
  headline: string;
  // Baseline data quality
  baselineStatus?: 'prior_term' | 'current_term' | 'unknown';
  baselineStatusReason?: string;
}

/**
 * Full comparison result.
 */
export interface ComparisonResult {
  recommendation: 'renew_as_is' | 'reshop' | 'needs_review';
  summary: ComparisonSummary;
  materialChanges: MaterialChange[];
  nonMaterialChanges: MaterialChange[];
  confidenceLevel: 'high' | 'medium' | 'low';
  // Baseline data quality indicator
  baselineStatus: 'prior_term' | 'current_term' | 'unknown';
  baselineStatusReason?: string;
}

// =============================================================================
// COMPARISON THRESHOLDS
// =============================================================================

export interface ComparisonThresholds {
  premiumIncreasePercent: number; // Default: 10
  premiumIncreaseAmount: number; // Default: 200
  coverageLimitReductionPercent: number; // Default: 20
  deductibleIncreasePercent: number; // Default: 50
}

export const DEFAULT_COMPARISON_THRESHOLDS: ComparisonThresholds = {
  premiumIncreasePercent: 10,
  premiumIncreaseAmount: 200,
  coverageLimitReductionPercent: 20,
  deductibleIncreasePercent: 50,
};

// =============================================================================
// BATCH / CANDIDATE TYPES
// =============================================================================

export interface BatchProcessingLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface ExtractedAL3File {
  fileName: string;
  content: string;
  sourceZip?: string;
  nestingDepth: number;
}
