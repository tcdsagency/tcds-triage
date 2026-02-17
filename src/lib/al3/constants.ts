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

  // Commercial Auto records
  COMMERCIAL_VEHICLE: '5CAR', // Commercial auto vehicle
  SUPPLEMENTARY_DRIVER: '6SDV', // Supplementary driver (commercial)
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
  XLC: 'XLC', // Cancellation (ACORD)
  XLR: 'XLR', // Cancellation Rescind
  REI: 'REI', // Reinstatement

  // Other
  AUD: 'AUD', // Audit
  INQ: 'INQ', // Inquiry
  PCH: 'PCH', // Policy Change
  COM: 'COM', // Commission Statement
  SYN: 'SYN', // Sync/Download (full policy snapshot)
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
  // IVANS sub-LOB codes (5-char format from 2TRG positions 24-29)
  'PAUTO': 'Personal Auto',
  'AUTOP': 'Personal Auto',
  'CAUTO': 'Commercial Auto',
  'CAUTOB': 'Commercial Auto',
  'AUTOB': 'Commercial Auto',
  'PHOME': 'Homeowners',
  'HOME': 'Homeowners',
  'AUTO': 'Personal Auto',
  'PFIRE': 'Dwelling Fire',
  'FIRE': 'Dwelling Fire',
  'PFLOOD': 'Flood',
  'FLOOD': 'Flood',
  'PBOAT': 'Watercraft',
  'BOAT': 'Watercraft',
  'FMGBN': 'Umbrella',
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
  'UMBI': 'uninsured_motorist',
  'UMUIMBI': 'uninsured_motorist',
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
  'LIAB': 'personal_liability',
  'PP': 'personal_property',
  'PPERS': 'personal_property',
  'LOU': 'loss_of_use',
  'WTRDM': 'water_damage',
  'ROOF': 'roof_surfaces',
  'LFREE': 'claim_free_discount',

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

  // Full-name aliases (HawkSoft sometimes stores description as code)
  'DWELLING': 'dwelling',
  'OTHER_STRUCTURES': 'other_structures',
  'PERSONAL_PROPERTY': 'personal_property',
  'LOSS_OF_USE': 'loss_of_use',
  'PERSONAL_LIABILITY': 'personal_liability',
  'MEDICAL_PAYMENTS': 'medical_payments',
  'MEDICAL_PAYMENTS_TO_OTHERS': 'medical_payments_to_others',
  'MED_PAY': 'medical_payments',
  'BODILY_INJURY': 'bodily_injury',
  'PROPERTY_DAMAGE': 'property_damage',
  'UNINSURED_MOTORIST': 'uninsured_motorist',
  'UNDERINSURED_MOTORIST': 'underinsured_motorist',
  'COLLISION': 'collision',
  'COMPREHENSIVE': 'comprehensive',

  // HawkSoft-specific coverage codes
  'TL': 'towing',
  'RREIM': 'rental_reimbursement',
  'UMPED': 'uninsured_motorist_pd',

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

  // Allstate-specific coverage codes
  'PL': 'personal_liability',
  'BSREI': 'building_structures_extended',
  'TRCYC': 'tropical_cyclone',
  'ESIGN': 'early_signing_discount',
  'RESPY': 'responsible_payment_discount',
  'WELCM': 'welcome_discount',
  'LOYAL': 'loyalty_discount',
  'PROTD': 'protective_devices',
  'ACCT': 'account_discount',
  'ESTAB': 'established_customer',
  'ESMRT': 'esmart_discount',
  'ADDA': 'additional_coverage_a',
  'HODIS': 'homeowner_discount',
  'EPPDS': 'auto_pay_discount',
  'ABS': 'anti_lock_brakes_discount',
  'SDC': 'safe_driver_course_discount',
  'FTBYR': 'first_year_buyer_discount',

  // Orion180-specific coverage codes
  'ALEXP': 'additional_living_expense',
  'PC': 'personal_computer',
  'UNJEW': 'unscheduled_jewelry',
  'CCSV': 'credit_card_securities',
  'RCD': 'roof_covering_damage',
  'RVPP': 'replacement_value_personal_property',
  'FORTIFIEDROOFUPGRADE': 'fortified_roof_upgrade',
  'TIV': 'total_insured_value',
  'FRFU': 'fortified_roof_upgrade',

  // Cross-carrier common codes
  'WLIAB': 'personal_liability',
  'MEXCO': 'mexico_coverage',
  'CUSTE': 'customized_equipment',
  'MOLD': 'mold',
  'HURR': 'hurricane_deductible',
  'FREEZ': 'freezing_damage',
  'LTHFT': 'limited_theft',
  'FRVAL': 'functional_replacement_value',
  'FRV': 'functional_replacement_value',
  'FVREP': 'functional_replacement_value',
  'BIPUN': 'bodily_injury_punitive',
  'GPL': 'personal_liability',
  'LUSE': 'loss_of_use',
  'EAP': 'extended_away_from_premises',
  'OEM': 'original_equipment_manufacturer',
  'INFGD': 'inflation_guard',
  'LNDFR': 'landlord_furnishings',
  'LONGV': 'long_term_vacancy',
  'MATCH': 'matching_undamaged_siding',
  'MRDIS': 'mature_driver_discount',

  // National General / Integon codes
  'ACQIS': 'acquisition_fee',
  'ADB': 'accidental_death_benefit',
  'MULP': 'multi_policy_discount',
  'MCAR': 'multi_car_discount',
  'GDD': 'good_driver_discount',
  'GSD': 'good_student_discount',
  'INAGY': 'insurance_agency_discount',
  'MCCRD': 'multi_car_credit_discount',
  'NBSDC': 'new_business_discount',
  'ENCLG': 'enclosed_garage',
  'GMFAM': 'family_discount',
  'CDL': 'commercial_driver_license',
  'ALLVE': 'all_vehicle_discount',

  // GEICO / watercraft codes
  'EFTD': 'eft_discount',
  'COMPD': 'comprehensive_deductible',
  'NTLIA': 'non_trucking_liability',
  'FILFE': 'filing_fee',
  'AQD': 'acquisition_discount',
  'AFFLD': 'affiliation_discount',
  'MTG': 'mortgagee',
  'MTGL': 'mortgagee_clause',
  'MTC': 'motor_truck_cargo',
  'AIN01': 'additional_insured_1',
  'AIN02': 'additional_insured_2',
  'AIN03': 'additional_insured_3',

  // American Strategic codes
  'AQDIS': 'all_quotes_discount',
  'HURRS': 'hurricane_surcharge',
  'EROOF': 'extended_roof',
  'HROOF': 'hip_roof',
  'HPACK': 'home_package',
  'HPLAT': 'home_platinum',
  'HOFAC': 'home_factor',
  'CFACT': 'construction_factor',
  'CLSUR': 'claims_surcharge',
  'DSWAT': 'dwelling_water_damage',
  'LWTDM': 'limited_water_damage',
  'ADULT': 'adult_discount',
  'CHILD': 'child_discount',
  'MARST': 'married_status',
  'BUTLN': 'building_outline',
  'MOOCC': 'month_occupied',
  'DWUPD': 'dwelling_update',
  'EPOLD': 'existing_policy_discount',
  'NHDIS': 'new_home_discount',
  'ACVRS': 'actual_cash_value_roof',
  'ABILD': 'additional_building',
  'AFACC': 'additional_factors',
  'AUMOT': 'auto_motorcycle',
  'FBASP': 'base_premium',
  'ALAR1': 'alarm_1',
  'ALAR2': 'alarm_2',
  'AGEDW': 'age_dwelling',

  // CAN Modern Insurance codes
  'ASCPL': 'additional_specified_personal_liability',
  'BRGLR': 'burglar_alarm',
  'BRISK': 'basic_risk',
  'BVMM': 'building_value_maintenance',
  'CPL': 'personal_liability',
  'ENHAN': 'enhanced_coverage',
  'FDS': 'full_dwelling_security',
  'INSPF': 'inspection_fee',
  'LAP': 'loss_assessment_protection',
  'LLPL': 'landlord_personal_liability',
  'MDEPL': 'medical_expense_personal_liability',
  'MLDLE': 'mold_liability_exclusion',
  'MOLDL': 'mold_limit',
  'MOLDP': 'mold_premium',
  'ALEFR': 'additional_living_expense',

  // Universal P&C codes
  'CCMO': 'credit_card_monthly',
  'CCSC': 'credit_card_surcharge',

  // Progressive codes
  'ACCES': 'accessories_coverage',
  'BUS': 'business_use',
  'BLKAI': 'blanket_additional_insured',
  'CCONT': 'continuous_coverage',
  'DSB': 'declining_savings_bonus',
  'DSD': 'defensive_driving_discount',
  'DST': 'distant_student',
  'EMEXP': 'emergency_expense',
  'MATUR': 'mature_driver',
  'MCE': 'multi_car_endorsement',
  'MXCOL': 'maximum_collision',
  'MXOTC': 'maximum_other_than_collision',
  'NP1': 'continuous_insurance_discount',
  'NTRCK': 'non_trucking',

  // Fortegra / Trisura codes
  'BBUG': 'bed_bug_coverage',

  // Miscellaneous common codes
  'DEBRL': 'debris_removal',
  'ENHCD': 'enhanced_coverage_deductible',
  'ENHDP': 'enhanced_coverage_premium',
  'FDC': 'fire_department_charge',
  'GRPRT': 'group_rating',
  'BPREM': 'base_premium',
  'BUSAH': 'business_auto_home',
  'BUSPH': 'business_pursuits_home',
  'MOTR1': 'motorized_vehicle_1',
  'NEWVH': 'new_vehicle',
  'DRVER': 'driver_exclusion',
  'AUTO': 'auto_discount',
  'BOOST': 'boost_coverage',
  'ANTHF': 'anti_theft',
  'EMPAF': 'employee_auto_fleet',

  // Additional common codes
  'ALARM': 'alarm_discount',
  'ANIML': 'animal_liability',
  'APP01': 'application_fee',
  'AUTOP': 'auto_policy',
  'AV': 'agreed_value',
  'BAA': 'basic_auto_adjustment',
  'BEC': 'basic_extended_coverage',
  'BPL': 'personal_liability',
  'CLAIM': 'claims_surcharge',
  'EXTCV': 'extended_coverage',
  'EXTPE': 'extended_perils',
  'FLPAY': 'full_payment_discount',
  'GHPPD': 'group_home_property_damage',
  'ILMC': 'illinois_medical_coverage',
  'LIFED': 'life_discount',
  'MERIT': 'merit_discount',
  'RCC': 'replacement_cost_contents',
  'CECOL': 'comprehensive_collision',
  'ADWFR': 'additional_dwelling_fire',
  'CUSEA': 'customer_east',
  'CVEXT': 'coverage_extension',
  'FANLB': 'fan_liability',
  'MGAFE': 'mortgagee_fee',
  'MUNIT': 'multiple_unit',
  'OLDWT': 'old_wiring',
  'ACCFV': 'accident_forgiveness',
  'BCODE': 'billing_code',
  'AUEXT': 'auto_extension',
  'BIUD': 'bodily_injury_underinsured',
  'BAEC': 'basic_extended_coverage',
  'DRV': 'driver',
  'FULLC': 'full_coverage',
  'VIOL': 'violation_surcharge',

  // Openly-specific coverage codes
  'MIN01': 'mine_subsidence',
  'SINK': 'sinkhole',
  'HURRA': 'hurricane_deductible',
  'CLIAB': 'cyber_liability',
  'SRVLN': 'service_line',
  'SEWER': 'sewer_water_backup',
  'EQPBK': 'equipment_breakdown',
  'WHSLS': 'wind_hail',
  'HULL': 'watercraft_hull',

  // Progressive-specific discount codes (stored as coverage records in HawkSoft)
  'AFR': 'accident_free_discount',
  'EFT': 'eft_discount',
  'HON': 'homeowner_discount',
  'MC1': 'multi_car_discount',
  'SMP': 'multi_policy_discount',
  'NP2': 'continuous_insurance_discount',
  'NP3': 'continuous_insurance_discount',
  'NP4': 'continuous_insurance_discount',
  'NP5': 'continuous_insurance_discount',
  'SD3': 'safe_driving_discount',
  'IPP': 'paperless_discount',
  'CFR': 'claim_free_discount',
  'CFD': 'claim_free_discount',
  'PPAYD': 'auto_pay_discount',
  'DMH': 'mobile_home_discount',
  'SNRDR': 'senior_discount',
  'GOODD': 'good_driver_discount',
  'DFEDR': 'defensive_driver_discount',
  'ASSOC': 'association_discount',
  'BUNDL': 'bundle_discount',
  'RDD': 'renewal_discount',
  'DAS': 'direct_auto_discount',
  'ASC': 'auto_sign_discount',
  'PIF': 'paid_in_full_discount',
  'DPP': 'deferred_payment_discount',
  'OOD': 'online_discount',

  // Watercraft-specific coverage codes
  'WATER': 'waterski_liability',
  'EQP01': 'equipment_coverage',
  'POLUT': 'pollution_liability',
  'PE': 'personal_effects',
  'PROPP': 'personal_property',
  'SGLID': 'single_limit',
  'WUI': 'watercraft_uninsured',
  'NAVAR': 'navigation_warranty',
  'NSDED': 'named_storm_deductible',
  'MOT01': 'motor_coverage',
  'TRLR': 'trailer_coverage',

  // Auto-specific codes
  'ACPE': 'accident_personal_effects',
  'LLPP': 'loan_lease_payoff',
};

/**
 * Coverage types that are really discounts/credits.
 * Used to partition discounts from real coverages in snapshot/baseline builders.
 */
export const DISCOUNT_COVERAGE_TYPES = new Set([
  'accident_free_discount',
  'eft_discount',
  'homeowner_discount',
  'multi_car_discount',
  'multi_policy_discount',
  'continuous_insurance_discount',
  'safe_driving_discount',
  'paperless_discount',
  'early_signing_discount',
  'responsible_payment_discount',
  'welcome_discount',
  'loyalty_discount',
  'protective_devices',
  'account_discount',
  'established_customer',
  'esmart_discount',
  'claim_free_discount',
  'auto_pay_discount',
  'mobile_home_discount',
  'senior_discount',
  'good_driver_discount',
  'defensive_driver_discount',
  'association_discount',
  'bundle_discount',
  'renewal_discount',
  'direct_auto_discount',
  'auto_sign_discount',
  'paid_in_full_discount',
  'deferred_payment_discount',
  'online_discount',
  'anti_lock_brakes_discount',
  'safe_driver_course_discount',
  'first_year_buyer_discount',
  // Endorsement flags (no limit/premium, just indicate coverage modifier)
  'replacement_value_personal_property',
  'functional_replacement_value',
]);

/**
 * Rating factor types — carrier-specific pricing components that have premium
 * values but are NOT real insurance coverages. These should be excluded from
 * the coverage comparison table. They're typically credits/surcharges that
 * make up the premium calculation (e.g., "Age of Dwelling +$428.92").
 */
export const RATING_FACTOR_TYPES = new Set([
  // American Strategic rating factors
  'hlfc',                          // Home Liability Fire Coverage (factor)
  'wndsd',                         // Wind/Hail Deductible (factor)
  'replacement_deductible',        // Replacement Deductible (factor)
  'rdecc',                         // Replacement Deductible (short code)
  'rpded',                         // Replacement Deductible (alt)
  'roof_material',                 // Roof Material (factor)
  'household_factor',              // Household Factor
  'pdif',                          // Property Damage Increase Factor
  'property_damage_increase_factor',
  'fixed_base_premium',            // Fixed Base Premium
  'fxbs',                          // Fixed Base Premium (short code)
  'fire_protection',               // Fire Protection (factor)
  'frpr',                          // Fire Protection (short code)
  'claims_surcharge',              // Claims Surcharge
  'clsur',                         // Claims Surcharge (AS full code)
  'clms',                          // Claims Surcharge (short code)
  'homeshield_package',            // HomeShield Package
  'hsp',                           // HomeShield Package (short code)
  'water_leak',                    // Water Leak (factor)
  'wleak',                         // Water Leak (short code)
  'named_storm_deductible',        // Named Storm Deductible (factor)
  'numst',                         // Named Storm Deductible (short code)
  'hurricane_surcharge',           // Hurricane Surcharge
  'hurrs',                         // Hurricane Surcharge (AS full code)
  'month_occupied',                // Month Occupied
  'moocc',                         // Month Occupied (AS full code)
  'additional_factors',            // Additional Factors
  'afacc',                         // Additional Factors (AS full code)
  'aodw',                          // All Other Dwelling Perils (factor)
  'nrnh',                          // Non-Renewed/Non-Homestead
  'hmup',                          // Home Update (factor)
  'tpds',                          // Third Party Designation
  'dswat',                          // Distance to Water (factor)
  'dwelling_water_damage',           // Distance to Water (canonical)
  // Generic rating components
  'territory_rating',
  'terr',
  'tier_rating',
  'tier',
  'group_rating',
  'basic_risk',
  'brisk',
  'building_value_maintenance',
  'bvmm',
  'credit_card_surcharge',
  'ccsc',
  'credit_card_monthly',
  'ccmo',
  'violation_surcharge',
  'inspection_fee',
  'inspf',
  'filing_fee',
  'policy_fee',
  'polfe',
]);

/**
 * Coverage types that are vehicle-specific and should NOT be flattened to policy level.
 * These coverages can have different limits/deductibles per vehicle.
 */
export const VEHICLE_LEVEL_COVERAGE_TYPES = new Set([
  'comprehensive',
  'collision',
  'towing',               // Towing/Roadside (canonical)
  'rental_reimbursement', // Rental Reimbursement (canonical)
  'glass',                // Glass Coverage
  'gap_coverage',         // GAP Insurance (canonical)
  'loan_lease_payoff',    // Loan/Lease Payoff (canonical)
  'full_glass',           // Full Glass Coverage
  'roadside_assistance',  // Roadside Assistance (canonical)
]);

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
  LOB_CODE: { start: 24, end: 30 }, // 6 chars (PHOME, PAUTO, CAUTO, etc.) — includes leading space
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
  COVERAGE_CODE: { start: 30, end: 45 }, // 15 chars (includes filler before code)
  PREMIUM: { start: 60, end: 72 }, // 12 chars (amount with +/- sign, implied 2 decimals)
  LIMIT: { start: 103, end: 113 }, // 10 chars (split limit part 1: per-person, ref 103-112)
  LIMIT_2: { start: 113, end: 118 }, // 5 chars (split limit part 2: per-accident suffix)
  DEDUCTIBLE: { start: 118, end: 125 }, // 7 chars (deductible amount, 6 digits zero-padded)
  DESCRIPTION: { start: 145, end: 195 }, // 50 chars (human-readable coverage name)
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
  FORM_NUMBER: { start: 30, end: 40 }, // 10 chars (form number + state)
  DESCRIPTION: { start: 40, end: 90 }, // 50 chars
  EFFECTIVE_DATE: { start: 90, end: 96 }, // 6 chars (YYMMDD)
} as const;

// =============================================================================
// NEW FIELD POSITION MAPPINGS (from AL3 reference guide)
// =============================================================================

/**
 * Basic Insured Segment (5BIS) field positions.
 * IVANS format: 172-byte records.
 */
export const BIS_FIELDS = {
  ENTITY_TYPE: { start: 30, end: 31 }, // 1 char (P=Person, C=Company, G=Group)
  PREFIX: { start: 31, end: 39 }, // 8 chars (name prefix/title, usually spaces)
  FIRST_NAME: { start: 39, end: 67 }, // 28 chars (verified from Progressive hex dump)
  LAST_NAME: { start: 67, end: 90 }, // 23 chars (verified from Progressive hex dump)
  SUFFIX: { start: 90, end: 92 }, // 2 chars
} as const;

/**
 * Insured Address Continuation (9BIS) field positions.
 * IVANS format: 168-343 bytes.
 */
export const BIS_ADDRESS_FIELDS = {
  ADDRESS_1: { start: 29, end: 59 }, // 30 chars
  ADDRESS_2: { start: 59, end: 89 }, // 30 chars
  CITY: { start: 89, end: 109 }, // 20 chars (may have leading ?)
  STATE: { start: 109, end: 111 }, // 2 chars
  ZIP: { start: 111, end: 116 }, // 5 chars
  ZIP4: { start: 116, end: 120 }, // 4 chars
  PHONE: { start: 120, end: 130 }, // 10 chars
} as const;

/**
 * Safeco shorter 9BIS variant (168-byte version).
 */
export const BIS_ADDRESS_FIELDS_SHORT = {
  ADDRESS_1: { start: 29, end: 59 }, // 30 chars
  CITY: { start: 59, end: 79 }, // 20 chars
  STATE: { start: 79, end: 81 }, // 2 chars
  ZIP: { start: 81, end: 91 }, // 10 chars (ZIP+4)
  PHONE: { start: 91, end: 101 }, // 10 chars
} as const;

/**
 * Basic Policy Information (5BPI) field positions.
 * IVANS format: 282-511 bytes.
 */
export const BPI_FIELDS = {
  POLICY_NUMBER: { start: 24, end: 49 }, // 25 chars
  NAIC_CODE: { start: 59, end: 64 }, // 5 chars
  LOB_CODE: { start: 64, end: 69 }, // 5 chars
  EFF_DATE_SHORT: { start: 73, end: 79 }, // 6 chars (YYMMDD)
  EXP_DATE_SHORT: { start: 79, end: 85 }, // 6 chars (YYMMDD)
  WRITTEN_PREMIUM: { start: 98, end: 109 }, // 11 chars (implied 2 decimals)
  ANNUAL_PREMIUM: { start: 109, end: 120 }, // 11 chars (with +/- sign)
} as const;

/**
 * Location Address Group (5LAG) field positions.
 * IVANS format: 199-636 bytes.
 */
export const LAG_FIELDS = {
  LOCATION_NUMBER: { start: 24, end: 28 }, // 4 chars
  ADDRESS: { start: 28, end: 58 }, // 30 chars
  ADDRESS_2: { start: 58, end: 88 }, // 30 chars
  CITY: { start: 88, end: 108 }, // 20 chars
  STATE: { start: 108, end: 110 }, // 2 chars
  ZIP: { start: 110, end: 115 }, // 5 chars
  COUNTY: { start: 121, end: 136 }, // 15 chars
} as const;

/**
 * Additional Other Insured / Mortgagee (5AOI) field positions.
 * IVANS format: 186-238 bytes.
 */
export const AOI_FIELDS = {
  SEQUENCE: { start: 24, end: 27 }, // 3 chars
  INTEREST_TYPE: { start: 27, end: 29 }, // 2 chars (LH=Lienholder, MS=Mortgagee, CN=Co-Named)
  ENTITY_TYPE: { start: 31, end: 32 }, // 1 char (C=Company, P=Person)
  NAME: { start: 32, end: 72 }, // 40 chars
  LOAN_NUMBER: { start: 131, end: 141 }, // 10 chars
} as const;

/**
 * Communication record (6COM) field positions.
 * IVANS format: 416 bytes.
 */
export const COM_FIELDS = {
  COMM_TYPE: { start: 24, end: 29 }, // 5 chars (EMAIL, PHONE, CELL)
  VALUE: { start: 29, end: 99 }, // 70 chars
} as const;

/**
 * Remark record (5RMK) field positions.
 * IVANS format: 195 bytes.
 */
export const RMK_FIELDS = {
  SEQUENCE: { start: 28, end: 30 }, // 2 chars
  REMARK_TYPE: { start: 30, end: 31 }, // 1 char (N=Normal)
  TEXT: { start: 31, end: 195 }, // 164 chars
} as const;

/**
 * Insured Supplemental Info (5ISI) field positions.
 * IVANS format: 147-203 bytes.
 */
export const ISI_FIELDS = {
  DOB_SHORT: { start: 24, end: 30 }, // 6 chars (YYMMDD)
  GENDER: { start: 32, end: 33 }, // 1 char (M/F)
  SPOUSE_DOB_SHORT: { start: 35, end: 41 }, // 6 chars (YYMMDD)
  HOMEOWNER_FLAG: { start: 80, end: 81 }, // 1 char (Y/N)
  DOB_FULL: { start: 97, end: 105 }, // 8 chars (YYYYMMDD)
  SPOUSE_DOB_FULL: { start: 105, end: 113 }, // 8 chars (YYYYMMDD)
} as const;
