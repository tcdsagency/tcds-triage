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
  FORM: '5FOR', // Form/endorsement schedule record

  // Level 6 records (IVANS-specific)
  COVERAGE_VEHICLE: '6CVA', // Vehicle-level coverage (Progressive, etc.)
  COVERAGE_HOME: '6CVH', // Home coverage (SAFECO)
  VEHICLE_DETAIL: '6PVH', // Vehicle physical details
  DRIVER_DETAIL: '6PDR', // Driver detail record
  COMMUNICATION: '6COM', // Communication record (email, phone)
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
  // IVANS sub-LOB codes (5-char format from 2TRG positions 24-28)
  'PAUTO': 'Personal Auto',
  'CAUTO': 'Commercial Auto',
  'PHOME': 'Homeowners',
  'HOME': 'Homeowners',
  'AUTO': 'Personal Auto',
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

  // IVANS-specific coverage codes
  'CSL': 'combined_single_limit',
  'UMISP': 'uninsured_motorist',
  'MEDPM': 'medical_payments',
  'EDC': 'extended_dwelling',
  'PPREP': 'personal_property_replacement',
  'LAC': 'liability_additional',
  'SEWRB': 'sewer_water_backup',
  'FRAUD': 'identity_fraud',
  'MBRKD': 'equipment_breakdown',
  'BOLAW': 'by_operation_of_law',
  'RFRC': 'roof_replacement_cost',
  'ADDIN': 'additional_insured',
  'OS': 'other_structures',
};

// =============================================================================
// FIELD POSITION MAPPINGS (for fixed-width AL3 parsing)
// =============================================================================

/**
 * Transaction header (2TRG) field positions.
 * Positions are for the IVANS/ACORD AL3 fixed-width record format (212 bytes):
 *   0-3:   group code (2TRG)
 *   4-6:   record length (212)
 *   7:     separator
 *   8:     version (4 or 7)
 *   167-169: transaction type (RWL, PCH, COM, etc.)
 *   196-203: processing date (YYYYMMDD)
 *   204-211: effective date (YYYYMMDD)
 */
export const TRG_FIELDS = {
  TRANSACTION_TYPE: { start: 167, end: 170 }, // 3 chars (RWL, RWQ, PCH, COM, NBS, etc.)
  COMPANY_NAME: { start: 47, end: 80 }, // ~33 chars (carrier company name)
  COMPANY_CODE: { start: 10, end: 12 }, // 2 chars (carrier code fragment)
  POLICY_NUMBER: { start: 12, end: 37 }, // Not reliably in 2TRG — extracted from 5BPI
  EFFECTIVE_DATE: { start: 204, end: 212 }, // 8 chars (YYYYMMDD)
  EXPIRATION_DATE: { start: 196, end: 204 }, // 8 chars — actually processing/batch date
  LOB_CODE: { start: 24, end: 29 }, // 5 chars (PHOME, PAUTO, CAUTO, etc.)
  INSURED_NAME: { start: 56, end: 96 }, // Not reliably in 2TRG — extracted from 5BIS
} as const;

/**
 * Coverage (5CVG) field positions.
 * IVANS format: 629-byte records. Data starts at position 30 after reference header.
 *   5CVG629 7 F200025BPIF10001    CSL            0000100000
 *                                 ^30            ^45
 */
export const CVG_FIELDS = {
  COVERAGE_CODE: { start: 30, end: 45 }, // 15 chars (CSL, UMISP, MEDPM, etc.)
  DESCRIPTION: { start: 30, end: 45 }, // Same as code in IVANS format
  LIMIT: { start: 45, end: 56 }, // 11 chars (amount)
  DEDUCTIBLE: { start: 65, end: 76 }, // 11 chars (second amount / split limit)
  PREMIUM: { start: 56, end: 65 }, // 9 chars (rare in 5CVG — premiums are in 6CVA)
} as const;

/**
 * Vehicle-level coverage (6CVA) field positions.
 * IVANS format: 281-byte records. Contains per-vehicle coverage premiums and limits.
 *   6CVA281 B W100085VEHR10001    CSL                           00000022100+              00300000
 *                                 ^30                           ^60         ^72           ^90
 */
export const CVA_FIELDS = {
  COVERAGE_CODE: { start: 30, end: 45 }, // 15 chars
  PREMIUM: { start: 60, end: 72 }, // 12 chars (amount with +/- sign)
  LIMIT: { start: 102, end: 110 }, // 8 chars (primary limit — split limits use 102-109 + 110-117)
} as const;

/**
 * Home coverage (6CVH) field positions.
 * IVANS/SAFECO format: 240-byte records.
 *   6CVH240   W110016HRUR10001    DWELL                         00000187600               002620000100000100
 *                                 ^30                           ^60                       ^90
 */
export const CVH_FIELDS = {
  COVERAGE_CODE: { start: 30, end: 45 }, // 15 chars
  LIMIT: { start: 60, end: 72 }, // 12 chars (primary limit, e.g., dwelling amount)
  SECONDARY_AMOUNT: { start: 90, end: 101 }, // 11 chars (secondary limit or amount)
} as const;

/**
 * Vehicle (5VEH) field positions.
 * IVANS format: 270-byte records.
 *   5VEH270 C R100015LAGL10001    0001????2010DODGE               CHALLENGER          ?????VIN17CHARS12345
 *                                 ^30  ^34  ^38  ^42                ^62                 ^82  ^87
 */
export const VEH_FIELDS = {
  SEQUENCE: { start: 30, end: 34 }, // 4 chars (vehicle number)
  YEAR: { start: 38, end: 42 }, // 4 chars
  MAKE: { start: 42, end: 62 }, // 20 chars
  MODEL: { start: 62, end: 82 }, // 20 chars
  VIN: { start: 87, end: 104 }, // 17 chars
  USAGE: { start: 82, end: 87 }, // 5 chars (between model and VIN)
} as const;

/**
 * Driver (5DRV) field positions.
 * IVANS format: 223-byte records.
 *   5DRV223 B F200015BPIF10001    ????0001P        Tanaye                     Walker - Heard          ?????????7776577                  AL??????890709F
 *                                 ^30  ^34  ^38^39 ^47 (first)                ^74 (last)              ^98      ^107                     ^132    ^140   ^146
 */
export const DRV_FIELDS = {
  NAME: { start: 39, end: 98 }, // 59 chars: first name (39-73, 35 chars) + last name (74-97, 24 chars)
  DOB: { start: 140, end: 146 }, // 6 chars (YYMMDD format, e.g., 890709)
  DOB_FULL: { start: 160, end: 168 }, // 8 chars (YYYYMMDD format, e.g., 19890709)
  LICENSE_NUMBER: { start: 102, end: 115 }, // 13 chars (may have masked prefix)
  LICENSE_STATE: { start: 132, end: 134 }, // 2 chars (e.g., AL)
  GENDER: { start: 146, end: 147 }, // 1 char (F/M)
} as const;

/**
 * Discount (5DSC) field positions.
 * Data starts at position 30 in IVANS format.
 */
export const DSC_FIELDS = {
  DISCOUNT_CODE: { start: 30, end: 45 }, // 15 chars
  DESCRIPTION: { start: 45, end: 85 }, // 40 chars
  AMOUNT: { start: 85, end: 96 }, // 11 chars
  PERCENT: { start: 96, end: 106 }, // 10 chars
} as const;

/**
 * Claim (5CLM) field positions.
 * Data starts at position 30 in IVANS format.
 */
export const CLM_FIELDS = {
  CLAIM_NUMBER: { start: 30, end: 50 }, // 20 chars
  CLAIM_DATE: { start: 50, end: 58 }, // 8 chars (YYYYMMDD)
  CLAIM_TYPE: { start: 58, end: 78 }, // 20 chars
  AMOUNT: { start: 78, end: 89 }, // 11 chars
  STATUS: { start: 89, end: 99 }, // 10 chars
} as const;

/**
 * Endorsement (5END) field positions.
 * Data starts at position 30 in IVANS format.
 */
export const END_FIELDS = {
  ENDORSEMENT_CODE: { start: 30, end: 45 }, // 15 chars
  DESCRIPTION: { start: 45, end: 85 }, // 40 chars
  EFFECTIVE_DATE: { start: 85, end: 93 }, // 8 chars (YYYYMMDD)
  PREMIUM: { start: 93, end: 104 }, // 11 chars
} as const;

/**
 * Form/Endorsement schedule (5FOR) field positions.
 * IVANS format: 203-byte records.
 *   5FOR203 5 F200015BPIF10001    001A206 AL   ??description??   date
 *                                 ^30   ^34    ^40               ^90
 */
export const FOR_FIELDS = {
  FORM_NUMBER: { start: 30, end: 40 }, // 10 chars (form number)
  DESCRIPTION: { start: 40, end: 90 }, // 50 chars
  EFFECTIVE_DATE: { start: 90, end: 96 }, // 6 chars (YYMMDD)
} as const;
