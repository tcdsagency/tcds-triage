/**
 * Comparison Engine
 * =================
 * Compares renewal offer against HawkSoft baseline.
 * Detects material changes and generates recommendation.
 */

import type {
  RenewalSnapshot,
  BaselineSnapshot,
  ComparisonResult,
  ComparisonSummary,
  MaterialChange,
  ComparisonThresholds,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDiscount,
  CanonicalEndorsement,
  CanonicalClaim,
  ChangeSeverity,
} from '@/types/renewal.types';
import { DEFAULT_COMPARISON_THRESHOLDS } from '@/types/renewal.types';
import { VEHICLE_LEVEL_COVERAGE_TYPES } from './constants';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Collect POLICY-LEVEL coverages (excluding vehicle-specific ones like Comp, Coll).
 * For auto policies, HawkSoft may return coverages at the policy level while
 * AL3 puts them at the vehicle level. This flattens policy-level coverages only,
 * deduplicating by coverage type.
 * Vehicle-specific coverages (Comp, Coll, Roadside, Rental) are compared per-vehicle.
 */
function collectPolicyLevelCoverages(
  policyCoverages: CanonicalCoverage[],
  vehicles: CanonicalVehicle[]
): CanonicalCoverage[] {
  // Filter to only policy-level coverages (exclude vehicle-specific)
  const policyLevel = policyCoverages.filter(c => !VEHICLE_LEVEL_COVERAGE_TYPES.has(c.type));

  // If we have policy-level coverages, return them
  if (policyLevel.length > 0) return policyLevel;

  // Otherwise, extract policy-level coverages from vehicles and deduplicate
  const seen = new Map<string, CanonicalCoverage>();
  for (const vehicle of vehicles) {
    for (const cov of vehicle.coverages || []) {
      // Skip vehicle-specific coverages
      if (cov.type && !seen.has(cov.type) && !VEHICLE_LEVEL_COVERAGE_TYPES.has(cov.type)) {
        seen.set(cov.type, cov);
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * Collect ALL vehicle-level coverages from a snapshot (from vehicles or policy-level).
 * HawkSoft stores vehicle-level coverages at the policy level, while AL3 puts them on vehicles.
 * This collects them from wherever they exist.
 */
function collectVehicleLevelCoverages(
  policyCoverages: CanonicalCoverage[],
  vehicles: CanonicalVehicle[]
): CanonicalCoverage[] {
  const seen = new Map<string, CanonicalCoverage>();

  // Check policy-level coverages for vehicle-level types (HawkSoft style)
  for (const cov of policyCoverages) {
    if (cov.type && VEHICLE_LEVEL_COVERAGE_TYPES.has(cov.type) && !seen.has(cov.type)) {
      seen.set(cov.type, cov);
    }
  }

  // Check vehicle coverages (AL3 style)
  for (const vehicle of vehicles) {
    for (const cov of vehicle.coverages || []) {
      if (cov.type && VEHICLE_LEVEL_COVERAGE_TYPES.has(cov.type) && !seen.has(cov.type)) {
        seen.set(cov.type, cov);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Compare vehicle-level coverages at the aggregate level.
 * Only checks for presence/absence - detailed per-vehicle comparison happens in compareVehicles.
 */
function compareVehicleLevelCoverages(
  renewalCoverages: CanonicalCoverage[],
  baselineCoverages: CanonicalCoverage[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const renewalByType = new Map(renewalCoverages.map((c) => [c.type, c]));
  const baselineByType = new Map(baselineCoverages.map((c) => [c.type, c]));

  // Check for removed vehicle-level coverages
  for (const [type, baseline] of baselineByType) {
    if (!renewalByType.has(type)) {
      changes.push({
        field: `coverage.${type}`,
        category: 'coverage_removed',
        classification: 'material_negative',
        oldValue: baseline.description || type,
        newValue: null,
        severity: 'material_negative',
        description: `Coverage removed: ${baseline.description || type}`,
      });
    }
  }

  // Check for added vehicle-level coverages
  for (const [type, renewal] of renewalByType) {
    if (!baselineByType.has(type)) {
      changes.push({
        field: `coverage.${type}`,
        category: 'coverage_added',
        classification: 'material_positive',
        oldValue: null,
        newValue: renewal.description || type,
        severity: 'material_positive',
        description: `Coverage added: ${renewal.description || type}`,
      });
    }
  }

  // Note: Detailed limit/deductible comparison happens per-vehicle in compareVehicles

  return changes;
}

// =============================================================================
// MAIN COMPARISON
// =============================================================================

/**
 * Compare a renewal snapshot against a baseline snapshot.
 */
export function compareSnapshots(
  renewal: RenewalSnapshot,
  baseline: BaselineSnapshot,
  thresholds: ComparisonThresholds = DEFAULT_COMPARISON_THRESHOLDS
): ComparisonResult {
  const allChanges: MaterialChange[] = [];

  // Compare premium
  allChanges.push(...comparePremium(renewal.premium, baseline.premium, thresholds));

  // For auto policies, coverages may live at the vehicle level in one snapshot
  // but at the policy level in the other. Collect POLICY-LEVEL coverages only.
  // Vehicle-specific coverages (Comp, Coll, etc.) are compared separately.
  const renewalCoverages = collectPolicyLevelCoverages(renewal.coverages, renewal.vehicles);
  const baselineCoverages = collectPolicyLevelCoverages(baseline.coverages, baseline.vehicles);

  // Compare policy-level coverages (BI, PD, UM, MedPay, etc.)
  allChanges.push(...compareCoverages(renewalCoverages, baselineCoverages, thresholds));

  // Compare vehicle-level coverages at aggregate level (Comp, Coll, Roadside, Rental)
  // HawkSoft stores these at policy level, AL3 puts them on vehicles
  const renewalVehicleCovs = collectVehicleLevelCoverages(renewal.coverages, renewal.vehicles);
  const baselineVehicleCovs = collectVehicleLevelCoverages(baseline.coverages, baseline.vehicles);
  allChanges.push(...compareVehicleLevelCoverages(renewalVehicleCovs, baselineVehicleCovs));

  // Compare vehicles (includes vehicle-level coverage comparison)
  allChanges.push(...compareVehicles(renewal.vehicles, baseline.vehicles, thresholds));

  // Compare drivers
  allChanges.push(...compareDrivers(renewal.drivers, baseline.drivers));

  // Compare discounts
  allChanges.push(...compareDiscounts(renewal.discounts, baseline.discounts));

  // Compare endorsements
  allChanges.push(...compareEndorsements(renewal.endorsements, baseline.endorsements));

  // Compare claims
  allChanges.push(...compareClaims(renewal.claims, baseline.claims));

  // Flag property concerns (homeowners)
  allChanges.push(...flagPropertyConcerns(renewal, baseline));

  // Separate material vs non-material
  const materialChanges = allChanges.filter((c) => c.severity !== 'non_material');
  const nonMaterialChanges = allChanges.filter((c) => c.severity === 'non_material');

  // Generate summary
  const summary = buildSummary(renewal, baseline, materialChanges, nonMaterialChanges);

  // Generate recommendation
  const recommendation = generateRecommendation(materialChanges, renewal, thresholds);

  // Determine confidence
  const confidenceLevel = getConfidenceLevel(renewal.parseConfidence);

  return {
    recommendation,
    summary,
    materialChanges,
    nonMaterialChanges,
    confidenceLevel,
  };
}

// =============================================================================
// PREMIUM COMPARISON
// =============================================================================

function comparePremium(
  renewalPremium: number | undefined,
  baselinePremium: number | undefined,
  thresholds: ComparisonThresholds
): MaterialChange[] {
  if (renewalPremium == null || baselinePremium == null) return [];

  const changeAmount = renewalPremium - baselinePremium;
  const changePercent = baselinePremium !== 0
    ? (changeAmount / baselinePremium) * 100
    : 0;

  let severity: ChangeSeverity;
  if (changeAmount < 0) {
    severity = 'material_positive'; // Decrease is positive
  } else if (
    changePercent > thresholds.premiumIncreasePercent ||
    changeAmount > thresholds.premiumIncreaseAmount
  ) {
    severity = 'material_negative';
  } else {
    severity = 'non_material';
  }

  return [{
    field: 'premium',
    category: 'premium',
    classification: severity,
    oldValue: baselinePremium,
    newValue: renewalPremium,
    changeAmount,
    changePercent: Math.round(changePercent * 100) / 100,
    severity,
    description: changeAmount === 0
      ? 'Premium unchanged'
      : changeAmount > 0
        ? `Premium increased by $${Math.abs(changeAmount).toFixed(2)} (${Math.abs(changePercent).toFixed(1)}%)`
        : `Premium decreased by $${Math.abs(changeAmount).toFixed(2)} (${Math.abs(changePercent).toFixed(1)}%)`,
  }];
}

// =============================================================================
// COVERAGE COMPARISON
// =============================================================================

function compareCoverages(
  renewalCoverages: CanonicalCoverage[],
  baselineCoverages: CanonicalCoverage[],
  thresholds: ComparisonThresholds
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const renewalByType = new Map(renewalCoverages.map((c) => [c.type, c]));
  const baselineByType = new Map(baselineCoverages.map((c) => [c.type, c]));

  // Check for removed coverages
  for (const [type, baseline] of baselineByType) {
    if (!renewalByType.has(type)) {
      changes.push({
        field: `coverage.${type}`,
        category: 'coverage_removed',
        classification: 'material_negative',
        oldValue: baseline.description || type,
        newValue: null,
        severity: 'material_negative',
        description: `Coverage removed: ${baseline.description || type}`,
      });
    }
  }

  // Check for added coverages
  for (const [type, renewal] of renewalByType) {
    if (!baselineByType.has(type)) {
      changes.push({
        field: `coverage.${type}`,
        category: 'coverage_added',
        classification: 'material_positive',
        oldValue: null,
        newValue: renewal.description || type,
        severity: 'material_positive',
        description: `Coverage added: ${renewal.description || type}`,
      });
    }
  }

  // Compare matching coverages
  for (const [type, renewal] of renewalByType) {
    const baseline = baselineByType.get(type);
    if (!baseline) continue;

    // Compare limits
    if (renewal.limitAmount != null && baseline.limitAmount != null) {
      const limitChange = renewal.limitAmount - baseline.limitAmount;
      const limitChangePercent = baseline.limitAmount !== 0
        ? (limitChange / baseline.limitAmount) * 100
        : 0;

      if (limitChange !== 0) {
        let severity: ChangeSeverity;
        if (limitChange < 0 && Math.abs(limitChangePercent) > thresholds.coverageLimitReductionPercent) {
          severity = 'material_negative';
        } else if (limitChange > 0) {
          severity = 'material_positive';
        } else {
          severity = 'non_material';
        }

        changes.push({
          field: `coverage.${type}.limit`,
          category: 'coverage_limit',
          classification: severity,
          oldValue: baseline.limitAmount,
          newValue: renewal.limitAmount,
          changeAmount: limitChange,
          changePercent: Math.round(limitChangePercent * 100) / 100,
          severity,
          description: `${renewal.description || type} limit ${limitChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(limitChangePercent).toFixed(1)}%`,
        });
      }
    }

    // Compare deductibles
    if (renewal.deductibleAmount != null && baseline.deductibleAmount != null) {
      const dedChange = renewal.deductibleAmount - baseline.deductibleAmount;
      const dedChangePercent = baseline.deductibleAmount !== 0
        ? (dedChange / baseline.deductibleAmount) * 100
        : 0;

      if (dedChange !== 0) {
        let severity: ChangeSeverity;
        if (dedChange > 0 && dedChangePercent > thresholds.deductibleIncreasePercent) {
          severity = 'material_negative';
        } else if (dedChange < 0) {
          severity = 'material_positive';
        } else {
          severity = 'non_material';
        }

        changes.push({
          field: `coverage.${type}.deductible`,
          category: 'deductible',
          classification: severity,
          oldValue: baseline.deductibleAmount,
          newValue: renewal.deductibleAmount,
          changeAmount: dedChange,
          changePercent: Math.round(dedChangePercent * 100) / 100,
          severity,
          description: `${renewal.description || type} deductible ${dedChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(dedChangePercent).toFixed(1)}%`,
        });
      }
    }
  }

  return changes;
}

// =============================================================================
// VEHICLE COMPARISON
// =============================================================================

function compareVehicles(
  renewalVehicles: CanonicalVehicle[],
  baselineVehicles: CanonicalVehicle[],
  thresholds: ComparisonThresholds = DEFAULT_COMPARISON_THRESHOLDS
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  // Match by VIN first, then by year/make/model
  const renewalByVin = new Map(
    renewalVehicles.filter((v) => v.vin).map((v) => [v.vin!, v])
  );
  const baselineByVin = new Map(
    baselineVehicles.filter((v) => v.vin).map((v) => [v.vin!, v])
  );

  // Check for removed vehicles
  for (const [vin, baseline] of baselineByVin) {
    if (!renewalByVin.has(vin)) {
      const desc = `${baseline.year || ''} ${baseline.make || ''} ${baseline.model || ''}`.trim();
      changes.push({
        field: `vehicle.${vin}`,
        category: 'vehicle_removed',
        classification: 'material_negative',
        oldValue: desc || vin,
        newValue: null,
        severity: 'material_negative',
        description: `Vehicle removed: ${desc || vin}`,
      });
    }
  }

  // Check for added vehicles
  for (const [vin, renewal] of renewalByVin) {
    if (!baselineByVin.has(vin)) {
      const desc = `${renewal.year || ''} ${renewal.make || ''} ${renewal.model || ''}`.trim();
      changes.push({
        field: `vehicle.${vin}`,
        category: 'vehicle_added',
        classification: 'material_positive',
        oldValue: null,
        newValue: desc || vin,
        severity: 'material_positive',
        description: `Vehicle added: ${desc || vin}`,
      });
    }
  }

  // Compare coverages within matched vehicles
  // Note: Coverage presence/absence is handled by compareVehicleLevelCoverages at aggregate level
  // Here we only compare deductibles/limits for coverages that exist on BOTH vehicle records
  for (const [vin, renewalVeh] of renewalByVin) {
    const baselineVeh = baselineByVin.get(vin);
    if (!baselineVeh) continue;

    const vehDesc = `${renewalVeh.year || ''} ${renewalVeh.make || ''} ${renewalVeh.model || ''}`.trim();

    // Get vehicle-level coverages only
    const renewalCovs = (renewalVeh.coverages || []).filter(c => VEHICLE_LEVEL_COVERAGE_TYPES.has(c.type));
    const baselineCovs = (baselineVeh.coverages || []).filter(c => VEHICLE_LEVEL_COVERAGE_TYPES.has(c.type));

    const renewalByType = new Map(renewalCovs.map(c => [c.type, c]));
    const baselineByType = new Map(baselineCovs.map(c => [c.type, c]));

    // Compare matching coverages (deductibles, limits) - only where both vehicles have the coverage
    for (const [type, renewal] of renewalByType) {
      const baseline = baselineByType.get(type);
      if (!baseline) continue;

      // Compare deductibles
      if (renewal.deductibleAmount != null && baseline.deductibleAmount != null) {
        const dedChange = renewal.deductibleAmount - baseline.deductibleAmount;
        const dedChangePercent = baseline.deductibleAmount !== 0
          ? (dedChange / baseline.deductibleAmount) * 100
          : 0;

        if (dedChange !== 0) {
          let severity: ChangeSeverity;
          if (dedChange > 0 && dedChangePercent > thresholds.deductibleIncreasePercent) {
            severity = 'material_negative';
          } else if (dedChange < 0) {
            severity = 'material_positive';
          } else {
            severity = 'non_material';
          }

          changes.push({
            field: `vehicle.${vin}.coverage.${type}.deductible`,
            category: 'deductible',
            classification: severity,
            oldValue: baseline.deductibleAmount,
            newValue: renewal.deductibleAmount,
            changeAmount: dedChange,
            changePercent: Math.round(dedChangePercent * 100) / 100,
            severity,
            description: `${vehDesc} ${renewal.description || type} deductible: $${baseline.deductibleAmount} → $${renewal.deductibleAmount}`,
          });
        }
      }

      // Compare limits (for rental, roadside, etc.)
      if (renewal.limitAmount != null && baseline.limitAmount != null) {
        const limitChange = renewal.limitAmount - baseline.limitAmount;
        const limitChangePercent = baseline.limitAmount !== 0
          ? (limitChange / baseline.limitAmount) * 100
          : 0;

        if (limitChange !== 0) {
          let severity: ChangeSeverity;
          if (limitChange < 0 && Math.abs(limitChangePercent) > thresholds.coverageLimitReductionPercent) {
            severity = 'material_negative';
          } else if (limitChange > 0) {
            severity = 'material_positive';
          } else {
            severity = 'non_material';
          }

          changes.push({
            field: `vehicle.${vin}.coverage.${type}.limit`,
            category: 'coverage_limit',
            classification: severity,
            oldValue: baseline.limitAmount,
            newValue: renewal.limitAmount,
            changeAmount: limitChange,
            changePercent: Math.round(limitChangePercent * 100) / 100,
            severity,
            description: `${vehDesc} ${renewal.description || type} limit: $${baseline.limitAmount} → $${renewal.limitAmount}`,
          });
        }
      }
    }
  }

  return changes;
}

// =============================================================================
// DRIVER COMPARISON
// =============================================================================

/**
 * Normalize driver name for comparison.
 * Removes middle initials and extra spaces so "Ladonna B Lee" matches "Ladonna Lee".
 */
function normalizeDriverName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove single-letter middle initials (e.g., "John A Smith" -> "John Smith")
    .replace(/\s+[a-z]\s+/g, ' ')
    // Remove trailing single letter (e.g., "John Smith A" -> "John Smith")
    .replace(/\s+[a-z]$/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ');
}

function compareDrivers(
  renewalDrivers: import('@/types/renewal.types').CanonicalDriver[],
  baselineDrivers: import('@/types/renewal.types').CanonicalDriver[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  // Build maps using normalized names for matching
  const renewalByNormalized = new Map(
    renewalDrivers.filter((d) => d.name).map((d) => [normalizeDriverName(d.name!), d])
  );
  const baselineByNormalized = new Map(
    baselineDrivers.filter((d) => d.name).map((d) => [normalizeDriverName(d.name!), d])
  );

  for (const [normalizedName, baseline] of baselineByNormalized) {
    if (!renewalByNormalized.has(normalizedName)) {
      const displayName = baseline.name || normalizedName;
      changes.push({
        field: `driver.${normalizedName}`,
        category: 'driver_removed',
        classification: 'material_negative',
        oldValue: displayName,
        newValue: null,
        severity: 'material_negative',
        description: `Driver removed: ${displayName}`,
      });
    }
  }

  for (const [normalizedName, renewal] of renewalByNormalized) {
    if (!baselineByNormalized.has(normalizedName)) {
      const displayName = renewal.name || normalizedName;
      changes.push({
        field: `driver.${normalizedName}`,
        category: 'driver_added',
        classification: 'material_positive',
        oldValue: null,
        newValue: displayName,
        severity: 'material_positive',
        description: `Driver added: ${displayName}`,
      });
    }
  }

  return changes;
}

// =============================================================================
// DISCOUNT COMPARISON
// =============================================================================

function compareDiscounts(
  renewalDiscounts: CanonicalDiscount[],
  baselineDiscounts: CanonicalDiscount[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const renewalByCode = new Map(renewalDiscounts.map((d) => [d.code.toUpperCase(), d]));
  const baselineByCode = new Map(baselineDiscounts.map((d) => [d.code.toUpperCase(), d]));

  // Removed discounts (in baseline but not in renewal) — lost a savings
  for (const [code, baseline] of baselineByCode) {
    if (!renewalByCode.has(code)) {
      changes.push({
        field: `discount.${code}`,
        category: 'discount_removed',
        classification: 'material_negative',
        oldValue: baseline.description || code,
        newValue: null,
        severity: 'material_negative',
        description: `Discount removed: ${baseline.description || code}`,
      });
    }
  }

  // Added discounts (in renewal but not in baseline)
  for (const [code, renewal] of renewalByCode) {
    if (!baselineByCode.has(code)) {
      changes.push({
        field: `discount.${code}`,
        category: 'discount_added',
        classification: 'material_positive',
        oldValue: null,
        newValue: renewal.description || code,
        severity: 'material_positive',
        description: `Discount added: ${renewal.description || code}`,
      });
    }
  }

  return changes;
}

// =============================================================================
// ENDORSEMENT COMPARISON
// =============================================================================

function compareEndorsements(
  renewalEndorsements: CanonicalEndorsement[],
  baselineEndorsements: CanonicalEndorsement[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const renewalByCode = new Map(renewalEndorsements.map((e) => [e.code.toUpperCase(), e]));
  const baselineByCode = new Map(baselineEndorsements.map((e) => [e.code.toUpperCase(), e]));

  // Removed endorsements
  for (const [code, baseline] of baselineByCode) {
    if (!renewalByCode.has(code)) {
      changes.push({
        field: `endorsement.${code}`,
        category: 'endorsement_removed',
        classification: 'material_negative',
        oldValue: baseline.description || code,
        newValue: null,
        severity: 'material_negative',
        description: `Endorsement removed: ${baseline.description || code}`,
      });
    }
  }

  // Added endorsements — flag for agent review (can be positive or negative)
  for (const [code, renewal] of renewalByCode) {
    if (!baselineByCode.has(code)) {
      changes.push({
        field: `endorsement.${code}`,
        category: 'endorsement_added',
        classification: 'non_material',
        oldValue: null,
        newValue: renewal.description || code,
        severity: 'non_material',
        description: `Endorsement added: ${renewal.description || code}`,
      });
    }
  }

  return changes;
}

// =============================================================================
// CLAIM COMPARISON
// =============================================================================

function compareClaims(
  renewalClaims: CanonicalClaim[],
  baselineClaims: CanonicalClaim[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const baselineClaimNumbers = new Set(
    baselineClaims
      .filter((c) => c.claimNumber)
      .map((c) => c.claimNumber!.toUpperCase())
  );

  // New claims in renewal that aren't in baseline
  for (const claim of renewalClaims) {
    const key = claim.claimNumber?.toUpperCase();
    if (key && baselineClaimNumbers.has(key)) continue;

    const datePart = claim.claimDate ? ` on ${claim.claimDate}` : '';
    const amountPart = claim.amount != null ? ` — $${claim.amount.toLocaleString()}` : '';
    const typePart = claim.claimType || 'Unknown type';

    changes.push({
      field: `claim.${claim.claimNumber || 'new'}`,
      category: 'claim',
      classification: 'material_negative',
      oldValue: null,
      newValue: claim.claimNumber || typePart,
      severity: 'material_negative',
      description: `New claim: ${typePart}${datePart}${amountPart}`,
    });
  }

  return changes;
}

// =============================================================================
// PROPERTY CONCERNS (HOMEOWNERS)
// =============================================================================

function flagPropertyConcerns(
  renewal: RenewalSnapshot,
  baseline: BaselineSnapshot
): MaterialChange[] {
  const changes: MaterialChange[] = [];
  const propertyContext = baseline.propertyContext;

  if (!propertyContext) return changes;

  // Roof age flags
  if (propertyContext.roofAge != null) {
    const roofDesc = propertyContext.roofType
      ? `${propertyContext.roofAge} years (${propertyContext.roofType})`
      : `${propertyContext.roofAge} years`;

    if (propertyContext.roofAge >= 20) {
      changes.push({
        field: 'property.roofAge',
        category: 'property',
        classification: 'material_negative',
        oldValue: propertyContext.roofAge,
        newValue: propertyContext.roofAge,
        severity: 'material_negative',
        description: `Roof age ${roofDesc} may affect coverage eligibility`,
      });
    } else if (propertyContext.roofAge >= 15) {
      changes.push({
        field: 'property.roofAge',
        category: 'property',
        classification: 'non_material',
        oldValue: propertyContext.roofAge,
        newValue: propertyContext.roofAge,
        severity: 'non_material',
        description: `Roof age: ${roofDesc}`,
      });
    }
  }

  // Check dwelling coverage (COV_A/dwelling) for RCE changes
  const renewalDwelling = renewal.coverages.find((c) => c.type === 'dwelling');
  const baselineDwelling = baseline.coverages.find((c) => c.type === 'dwelling');
  if (
    renewalDwelling?.limitAmount != null &&
    baselineDwelling?.limitAmount != null &&
    renewalDwelling.limitAmount !== baselineDwelling.limitAmount
  ) {
    changes.push({
      field: 'property.rce',
      category: 'property',
      classification:
        renewalDwelling.limitAmount < baselineDwelling.limitAmount
          ? 'material_negative'
          : 'non_material',
      oldValue: baselineDwelling.limitAmount,
      newValue: renewalDwelling.limitAmount,
      changeAmount: renewalDwelling.limitAmount - baselineDwelling.limitAmount,
      severity:
        renewalDwelling.limitAmount < baselineDwelling.limitAmount
          ? 'material_negative'
          : 'non_material',
      description: `Replacement Cost Estimate changed: $${baselineDwelling.limitAmount.toLocaleString()} → $${renewalDwelling.limitAmount.toLocaleString()}`,
    });
  }

  // Check for valuation method change (Replacement Cost → ACV)
  const baselineDesc = baselineDwelling?.description?.toLowerCase() || '';
  const renewalDesc = renewalDwelling?.description?.toLowerCase() || '';
  const baselineIsRC =
    baselineDesc.includes('replacement cost') || baselineDesc.includes('rc');
  const renewalIsACV =
    renewalDesc.includes('actual cash value') || renewalDesc.includes('acv');

  if (baselineIsRC && renewalIsACV) {
    changes.push({
      field: 'property.roofCoverageType',
      category: 'property',
      classification: 'material_negative',
      oldValue: 'Replacement Cost',
      newValue: 'Actual Cash Value',
      severity: 'material_negative',
      description: 'Roof coverage changed from Replacement Cost to Actual Cash Value',
    });
  }

  return changes;
}

// =============================================================================
// SUMMARY & RECOMMENDATION
// =============================================================================

function buildSummary(
  renewal: RenewalSnapshot,
  baseline: BaselineSnapshot,
  materialChanges: MaterialChange[],
  nonMaterialChanges: MaterialChange[]
): ComparisonSummary {
  const premiumChange = materialChanges.find((c) => c.category === 'premium') ||
    nonMaterialChanges.find((c) => c.category === 'premium');

  const premiumDirection: 'increase' | 'decrease' | 'same' =
    (premiumChange?.changeAmount ?? 0) > 0
      ? 'increase'
      : (premiumChange?.changeAmount ?? 0) < 0
        ? 'decrease'
        : 'same';

  const materialNegativeCount = materialChanges.filter((c) => c.severity === 'material_negative').length;
  const materialPositiveCount = materialChanges.filter((c) => c.severity === 'material_positive').length;

  let headline: string;
  if (materialNegativeCount === 0 && premiumDirection !== 'increase') {
    headline = 'Renewal looks favorable - no material negative changes';
  } else if (materialNegativeCount > 0) {
    headline = `${materialNegativeCount} material concern${materialNegativeCount > 1 ? 's' : ''} detected`;
  } else {
    headline = 'Renewal review needed';
  }

  return {
    premiumDirection,
    premiumChangeAmount: premiumChange?.changeAmount,
    premiumChangePercent: premiumChange?.changePercent,
    materialNegativeCount,
    materialPositiveCount,
    nonMaterialCount: nonMaterialChanges.length,
    headline,
  };
}

function generateRecommendation(
  materialChanges: MaterialChange[],
  renewal: RenewalSnapshot,
  thresholds: ComparisonThresholds
): 'renew_as_is' | 'reshop' | 'needs_review' {
  const hasNegative = materialChanges.some((c) => c.severity === 'material_negative');
  const hasPositive = materialChanges.some((c) => c.severity === 'material_positive');

  if (renewal.parseConfidence < 0.5) {
    return 'needs_review'; // Low confidence = manual review
  }

  if (hasNegative) {
    return 'reshop';
  }

  if (!hasNegative && !hasPositive) {
    return 'renew_as_is';
  }

  if (hasPositive && !hasNegative) {
    return 'renew_as_is';
  }

  return 'needs_review';
}

function getConfidenceLevel(parseConfidence: number): 'high' | 'medium' | 'low' {
  if (parseConfidence >= 0.8) return 'high';
  if (parseConfidence >= 0.5) return 'medium';
  return 'low';
}
