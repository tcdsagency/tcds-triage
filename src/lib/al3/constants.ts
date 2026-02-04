/**
 * AL3 Constants
 * =============
 * ACORD AL3 group codes, transaction types, field position mappings.
 */

// =============================================================================
// AL3 GROUP CODES (Record Identification - first 4 chars)
// =============================================================================

export const AL3_GROUP_CODES = {
  // Header/Trailer
  MASTER_HEADER: '1MHG', // File header
  TRANSACTION_HEADER: '2TRG', // Transaction header
  MASTER_TRAILER: '3MTG', // Transaction/file trailer

  // Business Records
  BUSINESS_INFO_SEGMENT: '5BIS', // General business info
  BUSINESS_PURPOSE_INFO: '5BPI', // Purpose/transaction info
  COVERAGE: '5CVG', // Coverage record
  VEHICLE: '5VEH', // Vehicle record
  DRIVER: '5DRV', // Driver record
  LOCATION: '5LOC', // Location/address record
  PREMIUM: '5PRM', // Premium record
  REMARK: '5RMK', // Remark/note record
  NAME_ADDRESS: '5NAD', // Name and address
  DEDUCTIBLE: '5DED', // Deductible record
  LIMIT: '5LMT', // Limit record
  ENDORSEMENT: '5END', // Endorsement record
  DISCOUNT: '5DSC', // Discount record
  CLAIM: '5CLM', // Claim record
  MORTGAGE: '5MTG', // Mortgagee record
} as const;

// =============================================================================
// TRANSACTION TYPE CODES
// =============================================================================

export const TRANSACTION_TYPES = {
  // Renewal types
  RWL: 'RWL', // Renewal
  RWQ: 'RWQ', // Renewal Quote
  RNW: 'RNW', // Renewal (alternate)

  // New business
  NBS: 'NBS', // New Business
  NBQ: 'NBQ', // New Business Quote

  // Endorsements
  END: 'END', // Endorsement
  ENQ: 'ENQ', // Endorsement Quote

  // Cancellation
  CAN: 'CAN', // Cancellation
  REI: 'REI', // Reinstatement

  // Other
  AUD: 'AUD', // Audit
  INQ: 'INQ', // Inquiry
} as const;

/**
 * Default transaction types that are considered renewals.
 */
export const DEFAULT_RENEWAL_TRANSACTION_TYPES = ['RWL', 'RWQ', 'RNW'];

// =============================================================================
// LINE OF BUSINESS CODES
// =============================================================================

export const LOB_CODES: Record<string, string> = {
  'PA': 'Personal Auto',
  'HO': 'Homeowners',
  'DP': 'Dwelling Fire',
  'CA': 'Commercial Auto',
  'GL': 'General Liability',
  'CP': 'Commercial Property',
  'BOP': 'BOP',
  'WC': 'Workers Comp',
  'UM': 'Umbrella',
  'FL': 'Flood',
  'MC': 'Motorcycle',
  'RV': 'Recreational Vehicle',
  'MH': 'Mobile Home',
  'PL': 'Professional Liability',
  'IM': 'Inland Marine',
  'CMP': 'Commercial Package',
  'RENT': 'Renters',
};

// =============================================================================
// COVERAGE CODE MAP - Standard coverage codes to canonical types
// =============================================================================

export const COVERAGE_CODE_MAP: Record<string, string> = {
  // Auto coverages
  'BI': 'bodily_injury',
  'BIPD': 'bodily_injury',
  'PD': 'property_damage',
  'COLL': 'collision',
  'COL': 'collision',
  'COMP': 'comprehensive',
  'OTC': 'comprehensive',
  'UM': 'uninsured_motorist',
  'UIM': 'underinsured_motorist',
  'UMBI': 'uninsured_motorist_bi',
  'UMPD': 'uninsured_motorist_pd',
  'MED': 'medical_payments',
  'MEDPAY': 'medical_payments',
  'PIP': 'personal_injury_protection',
  'RENT': 'rental_reimbursement',
  'TOW': 'towing',
  'ROAD': 'roadside_assistance',
  'GAP': 'gap_coverage',

  // Home/Property coverages
  'DWELL': 'dwelling',
  'DWEL': 'dwelling',
  'COV_A': 'dwelling',
  'COV_B': 'other_structures',
  'COV_C': 'personal_property',
  'COV_D': 'loss_of_use',
  'COV_E': 'personal_liability',
  'COV_F': 'medical_payments_to_others',
  'LIAB': 'liability',
  'PP': 'personal_property',
  'LOU': 'loss_of_use',

  // Commercial coverages
  'GL': 'general_liability',
  'PREM': 'premises_liability',
  'PROD': 'products_liability',
  'PROF': 'professional_liability',
  'EO': 'errors_omissions',
  'DO': 'directors_officers',
  'EPLI': 'employment_practices',
  'CYBER': 'cyber_liability',
  'CRIME': 'crime',
  'BPP': 'business_personal_property',
  'BI_INCOME': 'business_income',
  'EQUIP': 'equipment_breakdown',
};

// =============================================================================
// FIELD POSITION MAPPINGS (for fixed-width AL3 parsing)
// =============================================================================

/**
 * Transaction header (2TRG) field positions.
 */
export const TRG_FIELDS = {
  TRANSACTION_TYPE: { start: 4, end: 7 }, // 3 chars
  COMPANY_CODE: { start: 7, end: 12 }, // 5 chars (NAIC)
  POLICY_NUMBER: { start: 12, end: 37 }, // 25 chars
  EFFECTIVE_DATE: { start: 37, end: 45 }, // 8 chars (YYYYMMDD)
  EXPIRATION_DATE: { start: 45, end: 53 }, // 8 chars (YYYYMMDD)
  LOB_CODE: { start: 53, end: 56 }, // 3 chars
  INSURED_NAME: { start: 56, end: 96 }, // 40 chars
} as const;

/**
 * Coverage (5CVG) field positions.
 */
export const CVG_FIELDS = {
  COVERAGE_CODE: { start: 4, end: 14 }, // 10 chars
  DESCRIPTION: { start: 14, end: 54 }, // 40 chars
  LIMIT: { start: 54, end: 69 }, // 15 chars
  DEDUCTIBLE: { start: 69, end: 84 }, // 15 chars
  PREMIUM: { start: 84, end: 99 }, // 15 chars
} as const;

/**
 * Vehicle (5VEH) field positions.
 */
export const VEH_FIELDS = {
  VIN: { start: 4, end: 21 }, // 17 chars
  YEAR: { start: 21, end: 25 }, // 4 chars
  MAKE: { start: 25, end: 55 }, // 30 chars
  MODEL: { start: 55, end: 85 }, // 30 chars
  USAGE: { start: 85, end: 95 }, // 10 chars
} as const;

/**
 * Driver (5DRV) field positions.
 */
export const DRV_FIELDS = {
  NAME: { start: 4, end: 44 }, // 40 chars
  DOB: { start: 44, end: 52 }, // 8 chars (YYYYMMDD)
  LICENSE_NUMBER: { start: 52, end: 72 }, // 20 chars
  LICENSE_STATE: { start: 72, end: 74 }, // 2 chars
  RELATIONSHIP: { start: 74, end: 84 }, // 10 chars
} as const;

/**
 * Discount (5DSC) field positions.
 */
export const DSC_FIELDS = {
  DISCOUNT_CODE: { start: 4, end: 14 }, // 10 chars
  DESCRIPTION: { start: 14, end: 54 }, // 40 chars
  AMOUNT: { start: 54, end: 69 }, // 15 chars
  PERCENT: { start: 69, end: 79 }, // 10 chars
} as const;

/**
 * Claim (5CLM) field positions.
 */
export const CLM_FIELDS = {
  CLAIM_NUMBER: { start: 4, end: 24 }, // 20 chars
  CLAIM_DATE: { start: 24, end: 32 }, // 8 chars (YYYYMMDD)
  CLAIM_TYPE: { start: 32, end: 52 }, // 20 chars
  AMOUNT: { start: 52, end: 67 }, // 15 chars
  STATUS: { start: 67, end: 77 }, // 10 chars
} as const;

/**
 * Endorsement (5END) field positions.
 */
export const END_FIELDS = {
  ENDORSEMENT_CODE: { start: 4, end: 14 }, // 10 chars
  DESCRIPTION: { start: 14, end: 54 }, // 40 chars
  EFFECTIVE_DATE: { start: 54, end: 62 }, // 8 chars (YYYYMMDD)
  PREMIUM: { start: 62, end: 77 }, // 15 chars
} as const;
