/**
 * Centralized coverage display name resolver.
 *
 * Merges ACORD-standard codes, carrier-specific overrides (American Strategic,
 * SAFECO, Allstate, Progressive, etc.), and dot-path field resolution into a
 * single shared module consumed by CoverageComparisonTable, DeductiblesSection,
 * and TalkPoints.
 */

// ============================================================================
// Base ACORD / canonical labels
// ============================================================================

export const COVERAGE_DISPLAY_NAMES: Record<string, string> = {
  // --- Home / Property ---
  dwelling: 'Dwelling',
  other_structures: 'Other Structures',
  personal_property: 'Personal Property',
  personal_liability: 'Personal Liability',
  medical_payments_to_others: 'Medical Payments to Others',
  loss_of_use: 'Loss of Use',
  water_damage: 'Water Damage',
  mine_subsidence: 'Mine Subsidence',
  sinkhole: 'Sinkhole',
  hurricane_deductible: 'Hurricane Deductible',
  named_storm_deductible: 'Named Storm',
  cyber_liability: 'Cyber Liability',
  service_line: 'Service Line',
  sewer_water_backup: 'Sewer/Water Backup',
  equipment_breakdown: 'Equipment Breakdown',
  wind_hail: 'Wind/Hail',
  roof_surfaces: 'Roof Surfaces',
  roof_replacement_cost: 'Roof Replacement Cost',
  extended_dwelling: 'Extended Dwelling',
  personal_property_replacement: 'Personal Property Replacement',
  liability_additional: 'Additional Liability',
  identity_fraud: 'Identity Fraud',
  tropical_cyclone: 'Tropical Cyclone',
  additional_coverage_a: 'Additional Coverage A',
  building_structures_extended: 'Building Structures Extended',
  by_operation_of_law: 'By Operation of Law',
  additional_insured: 'Additional Insured',
  mold: 'Mold',
  ordinance_or_law: 'Ordinance or Law',
  animal_liability: 'Animal Liability',
  screened_enclosure: 'Screened Enclosure',
  personal_injury: 'Personal Injury',
  loss_assessment: 'Loss Assessment',
  building_additions: 'Building Additions',
  special_personal_property: 'Special Personal Property',
  flood: 'Flood',

  // --- Auto ---
  bodily_injury: 'Bodily Injury',
  property_damage: 'Property Damage',
  collision: 'Collision',
  comprehensive: 'Comprehensive',
  uninsured_motorist: 'Uninsured Motorist',
  uninsured_motorist_bi: 'Uninsured Motorist BI',
  uninsured_motorist_pd: 'Uninsured Motorist PD',
  underinsured_motorist: 'Underinsured Motorist',
  medical_payments: 'Medical Payments',
  pip: 'Personal Injury Protection',
  personal_injury_protection: 'Personal Injury Protection',
  tl: 'Towing & Roadside',
  rreim: 'Rental Reimbursement',
  rental_reimbursement: 'Rental Reimbursement',
  towing: 'Towing/Roadside',
  roadside_assistance: 'Roadside Assistance',
  combined_single_limit: 'Combined Single Limit',
  gap_coverage: 'GAP Coverage',
  loan_lease_payoff: 'Loan/Lease Payoff',

  // --- Allstate canonical ---
  DWELL: 'Dwelling',
  ADDLIV: 'Additional Living Expenses',
  OTHSTR: 'Other Structures',
  PERSPR: 'Personal Property',
  FXEXP: 'Fixed Expenses',

  // --- SAFECO canonical ---
  OS: 'Other Structures',
  PP: 'Personal Property',
  LOU: 'Loss of Use',
  PL: 'Personal Liability',
  MEDPM: 'Medical Payments to Others',
  EDC: 'Extended Dwelling Coverage',

  // --- Progressive canonical ---
  BI: 'Bodily Injury',
  PD: 'Property Damage',
  COLL: 'Collision',
  COMP: 'Comprehensive',
  UM: 'Uninsured Motorist',
  UMBI: 'Uninsured Motorist BI',
  UMPD: 'Uninsured Motorist PD',
  UIM: 'Underinsured Motorist',
  MP: 'Medical Payments',
  PIP: 'Personal Injury Protection',
  TL: 'Towing & Roadside',
  RREIM: 'Rental Reimbursement',
  CSL: 'Combined Single Limit',
};

// ============================================================================
// Carrier-specific override maps
// ============================================================================

const CARRIER_OVERRIDES: Record<string, Record<string, string>> = {
  'american strategic': {
    hlfc: 'Home Liability Fire Coverage',
    wndsd: 'Wind/Hail Deductible',
    pdif: 'Property Damage Increase Factor',
    numst: 'Named Storm Deductible',
    wleak: 'Water Leak',
    rcd: 'Roof Covering Damage',
    byol: 'By Operation of Law',
    ircd: 'Increased Replacement Cost — Dwelling',
    clms: 'Claims Surcharge',
    fxbs: 'Fixed Base Premium',
    aodw: 'All Other Dwelling Perils',
    frpr: 'Fire Protection',
    aqds: 'All Quotes Discount',
    hmup: 'Home Update',
    nrnh: 'Non-Renewed/Non-Homestead',
    clmf: 'Claims Free',
    tpds: 'Third Party Designation',
    pifd: 'Paid In Full Discount',
  },
  safeco: {
    DWELL: 'Dwelling',
    OS: 'Other Structures',
    PP: 'Personal Property',
    LOU: 'Loss of Use',
    PL: 'Personal Liability',
    MEDPM: 'Medical Payments to Others',
    EDC: 'Extended Dwelling Coverage',
  },
  allstate: {
    DWELL: 'Dwelling',
    ADDLIV: 'Additional Living Expenses',
    OTHSTR: 'Other Structures',
    PERSPR: 'Personal Property',
    FXEXP: 'Fixed Expenses',
  },
};

function normalizeCarrier(carrier: string | undefined): string {
  if (!carrier) return '';
  return carrier.toLowerCase().replace(/insurance|company|group|inc\.?|llc\.?|corp\.?/gi, '').trim();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve a single coverage code to a human-readable name.
 *
 * Checks carrier-specific overrides first, then the base map, then falls back
 * to title-casing the code.
 */
export function resolveCoverageDisplayName(code: string, carrier?: string): string {
  // 1. carrier override
  if (carrier) {
    const key = normalizeCarrier(carrier);
    for (const [prefix, overrides] of Object.entries(CARRIER_OVERRIDES)) {
      if (key.includes(prefix)) {
        const hit = overrides[code] || overrides[code.toLowerCase()] || overrides[code.toUpperCase()];
        if (hit) return hit;
      }
    }
  }

  // 2. base map (exact)
  if (COVERAGE_DISPLAY_NAMES[code]) return COVERAGE_DISPLAY_NAMES[code];

  // 3. title-case fallback: "wind_hail" → "Wind Hail", "DWELL" → "Dwell"
  return code
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve a dot-path field name (as used in MaterialChange / CheckResult)
 * to a human-readable label.
 *
 * Examples:
 *   "coverage.other_structures.limit"  → "Other Structures"
 *   "deductible.wind_hail"             → "Wind/Hail"
 *   "premium"                          → "Premium"
 *   "vehicle.2024_Toyota_Camry"        → "2024 Toyota Camry"
 */
export function resolveFieldDisplayName(fieldPath: string, carrier?: string): string {
  if (!fieldPath) return fieldPath;

  const parts = fieldPath.split('.');

  // "coverage.<type>.limit" / "coverage.<type>.premium"
  if (parts[0] === 'coverage' && parts.length >= 2) {
    return resolveCoverageDisplayName(parts[1], carrier);
  }

  // "deductible.<type>"
  if (parts[0] === 'deductible' && parts.length >= 2) {
    return resolveCoverageDisplayName(parts[1], carrier);
  }

  // "premium" standalone
  if (parts[0] === 'premium') return 'Premium';

  // "vehicle.<desc>" / "driver.<desc>"
  if ((parts[0] === 'vehicle' || parts[0] === 'driver') && parts.length >= 2) {
    return parts.slice(1).join(' ').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Fallback: try resolving the whole thing as a coverage code
  const resolved = resolveCoverageDisplayName(fieldPath, carrier);
  if (resolved !== fieldPath) return resolved;

  // Last resort: title-case the entire path
  return fieldPath
    .replace(/\./g, ' ')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
