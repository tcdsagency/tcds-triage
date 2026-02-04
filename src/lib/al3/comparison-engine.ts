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
  ChangeSeverity,
} from '@/types/renewal.types';
import { DEFAULT_COMPARISON_THRESHOLDS } from '@/types/renewal.types';

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

  // Compare coverages
  allChanges.push(...compareCoverages(renewal.coverages, baseline.coverages, thresholds));

  // Compare vehicles
  allChanges.push(...compareVehicles(renewal.vehicles, baseline.vehicles));

  // Compare drivers
  allChanges.push(...compareDrivers(renewal.drivers, baseline.drivers));

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
  baselineVehicles: CanonicalVehicle[]
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

  return changes;
}

// =============================================================================
// DRIVER COMPARISON
// =============================================================================

function compareDrivers(
  renewalDrivers: import('@/types/renewal.types').CanonicalDriver[],
  baselineDrivers: import('@/types/renewal.types').CanonicalDriver[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const renewalByName = new Map(
    renewalDrivers.filter((d) => d.name).map((d) => [d.name!.toLowerCase(), d])
  );
  const baselineByName = new Map(
    baselineDrivers.filter((d) => d.name).map((d) => [d.name!.toLowerCase(), d])
  );

  for (const [name, _baseline] of baselineByName) {
    if (!renewalByName.has(name)) {
      changes.push({
        field: `driver.${name}`,
        category: 'driver_removed',
        classification: 'material_negative',
        oldValue: name,
        newValue: null,
        severity: 'material_negative',
        description: `Driver removed: ${name}`,
      });
    }
  }

  for (const [name, _renewal] of renewalByName) {
    if (!baselineByName.has(name)) {
      changes.push({
        field: `driver.${name}`,
        category: 'driver_added',
        classification: 'material_positive',
        oldValue: null,
        newValue: name,
        severity: 'material_positive',
        description: `Driver added: ${name}`,
      });
    }
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
