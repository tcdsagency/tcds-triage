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
  CanonicalMortgagee,
  ChangeSeverity,
} from '@/types/renewal.types';
import { DEFAULT_COMPARISON_THRESHOLDS } from '@/types/renewal.types';
import { VEHICLE_LEVEL_COVERAGE_TYPES } from './constants';
import { analyzeReasons } from '@/lib/renewal-reasons';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build a coverage map, preferring the entry with the most data when duplicates exist.
 * If two entries share the same type, keep the one with a limitAmount (or the higher one).
 */
function buildCoverageMap(coverages: CanonicalCoverage[]): Map<string, CanonicalCoverage> {
  const map = new Map<string, CanonicalCoverage>();
  for (const c of coverages) {
    if (!c.type) continue;
    const existing = map.get(c.type);
    if (!existing) {
      map.set(c.type, c);
    } else {
      // Prefer the entry with a limitAmount, or the higher limit
      const existingLimit = existing.limitAmount ?? 0;
      const newLimit = c.limitAmount ?? 0;
      if (newLimit > existingLimit) {
        map.set(c.type, c);
      }
    }
  }
  return map;
}

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
  thresholds: ComparisonThresholds = DEFAULT_COMPARISON_THRESHOLDS,
  renewalEffectiveDate?: string, // ISO date string (YYYY-MM-DD)
  lineOfBusiness?: string
): ComparisonResult {
  const allChanges: MaterialChange[] = [];

  // Detect stale baseline: baseline policy dates match renewal effective date
  const { baselineStatus, baselineStatusReason } = detectStaleBaseline(
    baseline,
    renewalEffectiveDate,
    renewal.premium
  );

  // Compare premium
  allChanges.push(...comparePremium(renewal.premium, baseline.premium, thresholds));

  // For auto policies, coverages may live at the vehicle level in one snapshot
  // but at the policy level in the other. Collect POLICY-LEVEL coverages only.
  // Vehicle-specific coverages (Comp, Coll, etc.) are compared separately.
  const renewalCoverages = collectPolicyLevelCoverages(renewal.coverages, renewal.vehicles);
  const baselineCoverages = collectPolicyLevelCoverages(baseline.coverages, baseline.vehicles);

  // Compare policy-level coverages (BI, PD, UM, MedPay, etc.)
  allChanges.push(...compareCoverages(renewalCoverages, baselineCoverages, thresholds));

  // Auto-only: compare vehicle-level coverages (Comp, Coll, Roadside, Rental)
  const isAutoPolicy = !lineOfBusiness || /auto|vehicle|car/i.test(lineOfBusiness);
  if (isAutoPolicy) {
    const renewalVehicleCovs = collectVehicleLevelCoverages(renewal.coverages, renewal.vehicles);
    const baselineVehicleCovs = collectVehicleLevelCoverages(baseline.coverages, baseline.vehicles);
    allChanges.push(...compareVehicleLevelCoverages(renewalVehicleCovs, baselineVehicleCovs));
  }

  // When baseline is stale (current_term), downgrade coverage/detail changes
  // to non-material since same-term comparisons are unreliable for those.
  // Preserve premium changes — a premium difference is meaningful even with
  // a stale baseline (e.g. mid-term endorsement vs renewal offer).
  if (baselineStatus === 'current_term') {
    for (const change of allChanges) {
      if (change.category !== 'premium') {
        change.severity = 'non_material';
        change.classification = 'non_material';
      }
    }
  }

  // Separate material vs non-material
  const materialChanges = allChanges.filter((c) => c.severity !== 'non_material');
  const nonMaterialChanges = allChanges.filter((c) => c.severity === 'non_material');

  // Generate summary
  const summary = buildSummary(renewal, baseline, materialChanges, nonMaterialChanges, lineOfBusiness);

  // Generate recommendation
  const recommendation = generateRecommendation(materialChanges, renewal, thresholds, baselineStatus);

  // Determine confidence
  const confidenceLevel = getConfidenceLevel(renewal.parseConfidence);

  return {
    recommendation,
    summary,
    materialChanges,
    nonMaterialChanges,
    confidenceLevel,
    baselineStatus,
    baselineStatusReason,
  };
}

/**
 * Detect if the baseline is stale (captured from new term instead of prior term).
 */
function detectStaleBaseline(
  baseline: BaselineSnapshot,
  renewalEffectiveDate?: string,
  renewalPremium?: number
): { baselineStatus: 'prior_term' | 'current_term' | 'unknown'; baselineStatusReason?: string } {
  // If we don't have baseline policy dates, we can't determine
  if (!baseline.policyEffectiveDate) {
      return { baselineStatus: 'unknown' };
  }

  // Compare baseline effective date with renewal effective date
  if (renewalEffectiveDate) {
    const baselineEffDate = baseline.policyEffectiveDate;
    const renewalEffDate = renewalEffectiveDate.split('T')[0]; // Normalize to YYYY-MM-DD

    if (baselineEffDate === renewalEffDate) {
      return {
        baselineStatus: 'current_term',
        baselineStatusReason: 'Baseline was captured from the new term - prior term data unavailable',
      };
    }
  }

  // Baseline effective date is different from renewal effective date - good!
  return { baselineStatus: 'prior_term' };
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
  if (changeAmount < 0 && (Math.abs(changePercent) >= 0.5 || Math.abs(changeAmount) >= 5)) {
    severity = 'material_positive'; // Meaningful decrease is positive
  } else if (changeAmount < 0) {
    severity = 'non_material'; // Trivial decrease
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

// Major coverage types that are essential - removal is significant
const MAJOR_COVERAGE_TYPES = new Set([
  'bodily_injury', 'property_damage', 'dwelling', 'personal_liability',
  'uninsured_motorist', 'underinsured_motorist', 'personal_property',
  'other_structures', 'loss_of_use', 'medical_payments',
  'combined_single_limit',
]);

function compareCoverages(
  renewalCoverages: CanonicalCoverage[],
  baselineCoverages: CanonicalCoverage[],
  thresholds: ComparisonThresholds
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  // Build maps preferring entries with the most data (highest limit) when duplicates exist
  const renewalByType = buildCoverageMap(renewalCoverages);
  const baselineByType = buildCoverageMap(baselineCoverages);

  // Detect likely parsing gaps for homeowners: if renewal has Cov B/C/D/E but
  // not Cov A (dwelling) or Cov F (medical_payments), the carrier's AL3 probably
  // embeds these differently — don't flag as removed.
  const hasHomeCoverages = renewalByType.has('other_structures') ||
    renewalByType.has('personal_property') ||
    renewalByType.has('loss_of_use') ||
    renewalByType.has('personal_liability');
  const likelyHomeParsingGap = new Set<string>();
  if (hasHomeCoverages) {
    if (!renewalByType.has('dwelling') && baselineByType.has('dwelling')) {
      likelyHomeParsingGap.add('dwelling');
    }
    if (!renewalByType.has('medical_payments') && baselineByType.has('medical_payments')) {
      likelyHomeParsingGap.add('medical_payments');
    }
    if (!renewalByType.has('medical_payments_to_others') && baselineByType.has('medical_payments_to_others')) {
      likelyHomeParsingGap.add('medical_payments_to_others');
    }
  }

  // Check for removed coverages
  // Note: Coverage changes are INFORMATIONAL - they help explain premium changes
  // Only major coverage gaps are flagged for review, not reshop triggers
  for (const [type, baseline] of baselineByType) {
    if (!renewalByType.has(type)) {
      // Skip false positives from known parsing gaps
      if (likelyHomeParsingGap.has(type)) continue;

      const isMajor = MAJOR_COVERAGE_TYPES.has(type);
      changes.push({
        field: `coverage.${type}`,
        category: 'coverage_removed',
        classification: isMajor ? 'material_negative' : 'non_material',
        oldValue: baseline.description || type,
        newValue: null,
        severity: isMajor ? 'material_negative' : 'non_material',
        description: `Coverage removed: ${baseline.description || type}`,
      });
    }
  }

  // Check for added coverages (always positive/informational)
  for (const [type, renewal] of renewalByType) {
    if (!baselineByType.has(type)) {
      changes.push({
        field: `coverage.${type}`,
        category: 'coverage_added',
        classification: 'non_material', // Added coverages are informational
        oldValue: null,
        newValue: renewal.description || type,
        severity: 'non_material',
        description: `Coverage added: ${renewal.description || type}`,
      });
    }
  }

  // Sanity threshold: changes > 1000% are almost certainly parsing errors
  // (e.g., split limits parsed as single numbers, dates in deductible fields)
  const SANITY_CHANGE_PERCENT = 1000;

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
        // Sanity check: absurd % changes are likely parsing errors
        const isLikelyParseError = Math.abs(limitChangePercent) > SANITY_CHANGE_PERCENT;

        let severity: ChangeSeverity;
        if (isLikelyParseError) {
          severity = 'non_material'; // Downgrade to non-material — don't alarm the agent
        } else if (limitChange < 0 && Math.abs(limitChangePercent) > thresholds.coverageLimitReductionPercent) {
          severity = 'material_negative';
        } else if (limitChange > 0) {
          severity = 'material_positive';
        } else {
          severity = 'non_material';
        }

        changes.push({
          field: `coverage.${type}.limit`,
          category: isLikelyParseError ? 'likely_parsing_error' : 'coverage_limit',
          classification: severity,
          oldValue: baseline.limitAmount,
          newValue: renewal.limitAmount,
          changeAmount: limitChange,
          changePercent: Math.round(limitChangePercent * 100) / 100,
          severity,
          description: isLikelyParseError
            ? `⚠ ${renewal.description || type} limit change (${Math.abs(limitChangePercent).toFixed(0)}%) likely a parsing error`
            : `${renewal.description || type} limit ${limitChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(limitChangePercent).toFixed(1)}%`,
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
        // Sanity check: absurd % changes are likely parsing errors
        const isLikelyParseError = Math.abs(dedChangePercent) > SANITY_CHANGE_PERCENT;

        let severity: ChangeSeverity;
        if (isLikelyParseError) {
          severity = 'non_material';
        } else if (dedChange > 0 && dedChangePercent > thresholds.deductibleIncreasePercent) {
          severity = 'material_negative';
        } else if (dedChange < 0) {
          severity = 'material_positive';
        } else {
          severity = 'non_material';
        }

        changes.push({
          field: `coverage.${type}.deductible`,
          category: isLikelyParseError ? 'likely_parsing_error' : 'deductible',
          classification: severity,
          oldValue: baseline.deductibleAmount,
          newValue: renewal.deductibleAmount,
          changeAmount: dedChange,
          changePercent: Math.round(dedChangePercent * 100) / 100,
          severity,
          description: isLikelyParseError
            ? `⚠ ${renewal.description || type} deductible change (${Math.abs(dedChangePercent).toFixed(0)}%) likely a parsing error`
            : `${renewal.description || type} deductible ${dedChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(dedChangePercent).toFixed(1)}%`,
        });
      }
    }
  }

  return changes;
}

// =============================================================================
// VEHICLE COMPARISON
// =============================================================================

function normalizeVehicleKey(v: CanonicalVehicle): string {
  return [v.year, (v.make || '').toLowerCase().trim(), (v.model || '').toLowerCase().trim()]
    .filter(Boolean).join('|');
}

function matchVehiclePairs(
  renewalVehicles: CanonicalVehicle[],
  baselineVehicles: CanonicalVehicle[]
): { matched: [CanonicalVehicle, CanonicalVehicle][]; added: CanonicalVehicle[]; removed: CanonicalVehicle[] } {
  const matched: [CanonicalVehicle, CanonicalVehicle][] = [];
  const usedRen = new Set<number>();
  const usedBas = new Set<number>();

  // Pass 1: Match by VIN
  for (let bi = 0; bi < baselineVehicles.length; bi++) {
    const bv = baselineVehicles[bi];
    if (!bv.vin) continue;
    for (let ri = 0; ri < renewalVehicles.length; ri++) {
      if (usedRen.has(ri)) continue;
      const rv = renewalVehicles[ri];
      if (rv.vin && rv.vin.toLowerCase().trim() === bv.vin.toLowerCase().trim()) {
        matched.push([bv, rv]);
        usedBas.add(bi);
        usedRen.add(ri);
        break;
      }
    }
  }

  // Pass 2: Match by year/make/model
  for (let bi = 0; bi < baselineVehicles.length; bi++) {
    if (usedBas.has(bi)) continue;
    const bv = baselineVehicles[bi];
    const bKey = normalizeVehicleKey(bv);
    if (!bKey) continue;
    for (let ri = 0; ri < renewalVehicles.length; ri++) {
      if (usedRen.has(ri)) continue;
      const rv = renewalVehicles[ri];
      if (normalizeVehicleKey(rv) === bKey) {
        matched.push([bv, rv]);
        usedBas.add(bi);
        usedRen.add(ri);
        break;
      }
    }
  }

  const removed = baselineVehicles.filter((_, i) => !usedBas.has(i));
  const added = renewalVehicles.filter((_, i) => !usedRen.has(i));
  return { matched, added, removed };
}

function compareVehicles(
  renewalVehicles: CanonicalVehicle[],
  baselineVehicles: CanonicalVehicle[],
  thresholds: ComparisonThresholds = DEFAULT_COMPARISON_THRESHOLDS
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const { matched, added, removed } = matchVehiclePairs(renewalVehicles, baselineVehicles);

  // Report removed vehicles
  for (const baseline of removed) {
    const desc = `${baseline.year || ''} ${baseline.make || ''} ${baseline.model || ''}`.trim();
    const key = baseline.vin || desc || 'unknown';
    changes.push({
      field: `vehicle.${key}`,
      category: 'vehicle_removed',
      classification: 'material_negative',
      oldValue: desc || key,
      newValue: null,
      severity: 'material_negative',
      description: `Vehicle removed: ${desc || key}`,
    });
  }

  // Report added vehicles
  for (const renewal of added) {
    const desc = `${renewal.year || ''} ${renewal.make || ''} ${renewal.model || ''}`.trim();
    const key = renewal.vin || desc || 'unknown';
    changes.push({
      field: `vehicle.${key}`,
      category: 'vehicle_added',
      classification: 'material_positive',
      oldValue: null,
      newValue: desc || key,
      severity: 'material_positive',
      description: `Vehicle added: ${desc || key}`,
    });
  }

  // Compare coverages within matched vehicles
  // Note: Coverage presence/absence is handled by compareVehicleLevelCoverages at aggregate level
  // Here we only compare deductibles/limits for coverages that exist on BOTH vehicle records
  for (const [baselineVeh, renewalVeh] of matched) {
    const vehDesc = `${renewalVeh.year || ''} ${renewalVeh.make || ''} ${renewalVeh.model || ''}`.trim();
    const vehKey = renewalVeh.vin || vehDesc || 'unknown';

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
            field: `vehicle.${vehKey}.coverage.${type}.deductible`,
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
            field: `vehicle.${vehKey}.coverage.${type}.limit`,
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
  const cleaned = name
    .toLowerCase()
    .trim()
    // Remove single-letter middle initials (e.g., "John A Smith" -> "John Smith")
    .replace(/\s+[a-z]\s+/g, ' ')
    // Remove trailing single letter (e.g., "John Smith A" -> "John Smith")
    .replace(/\s+[a-z]$/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ');
  // Sort name parts so "Smith John" matches "John Smith"
  return cleaned.split(' ').sort().join(' ');
}

function compareDrivers(
  renewalDrivers: import('@/types/renewal.types').CanonicalDriver[],
  baselineDrivers: import('@/types/renewal.types').CanonicalDriver[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  // Build maps using normalized names for matching (group duplicates, keep first)
  const renewalByNormalized = new Map<string, import('@/types/renewal.types').CanonicalDriver>();
  for (const d of renewalDrivers) {
    if (!d.name) continue;
    const key = normalizeDriverName(d.name);
    if (!renewalByNormalized.has(key)) renewalByNormalized.set(key, d);
  }
  const baselineByNormalized = new Map<string, import('@/types/renewal.types').CanonicalDriver>();
  for (const d of baselineDrivers) {
    if (!d.name) continue;
    const key = normalizeDriverName(d.name);
    if (!baselineByNormalized.has(key)) baselineByNormalized.set(key, d);
  }

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

  // Keywords that indicate a negative endorsement (exclusion, coverage restriction)
  const NEGATIVE_ENDORSEMENT_KEYWORDS = [
    'exclusion', 'limitation', 'restrict', 'actual cash value', 'acv roof',
    'cosmetic damage', 'wind excl', 'animal liability', 'trampoline',
    'mold excl', 'water damage excl', 'breed',
  ];

  // Added endorsements — flag for agent review (can be positive or negative)
  for (const [code, renewal] of renewalByCode) {
    if (!baselineByCode.has(code)) {
      const desc = (renewal.description || code).toLowerCase();
      const isNegative = NEGATIVE_ENDORSEMENT_KEYWORDS.some(kw => desc.includes(kw));

      changes.push({
        field: `endorsement.${code}`,
        category: 'endorsement_added',
        classification: isNegative ? 'material_negative' : 'non_material',
        oldValue: null,
        newValue: renewal.description || code,
        severity: isNegative ? 'material_negative' : 'non_material',
        description: `Endorsement added: ${renewal.description || code}`,
      });
    }
  }

  return changes;
}

// =============================================================================
// CLAIM COMPARISON
// =============================================================================

function claimKey(c: CanonicalClaim): string {
  if (c.claimNumber) return c.claimNumber.toUpperCase().trim();
  return `${(c.claimDate || '')}|${(c.claimType || '')}`.toLowerCase().trim();
}

function compareClaims(
  renewalClaims: CanonicalClaim[],
  baselineClaims: CanonicalClaim[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const baselineKeys = new Set(baselineClaims.map(claimKey));

  // New claims in renewal that aren't in baseline
  for (const claim of renewalClaims) {
    if (baselineKeys.has(claimKey(claim))) continue;

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
// MORTGAGEE COMPARISON
// =============================================================================

function normalizeMortgageeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function compareMortgagees(
  renewalMortgagees: CanonicalMortgagee[],
  baselineMortgagees: CanonicalMortgagee[]
): MaterialChange[] {
  const changes: MaterialChange[] = [];

  const renewalByName = new Map(
    renewalMortgagees.map((m) => [normalizeMortgageeName(m.name), m])
  );
  const baselineByName = new Map(
    baselineMortgagees.map((m) => [normalizeMortgageeName(m.name), m])
  );

  // Removed mortgagees
  for (const [normalizedName, baseline] of baselineByName) {
    if (!renewalByName.has(normalizedName)) {
      changes.push({
        field: `mortgagee.${normalizedName}`,
        category: 'mortgagee_removed',
        classification: 'material_negative',
        oldValue: baseline.name,
        newValue: null,
        severity: 'material_negative',
        description: `Mortgagee removed: ${baseline.name}`,
      });
    }
  }

  // Added mortgagees
  for (const [normalizedName, renewal] of renewalByName) {
    if (!baselineByName.has(normalizedName)) {
      changes.push({
        field: `mortgagee.${normalizedName}`,
        category: 'mortgagee_added',
        classification: 'non_material',
        oldValue: null,
        newValue: renewal.name,
        severity: 'non_material',
        description: `Mortgagee added: ${renewal.name}`,
      });
    }
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

  // Dwelling limit comparison is already handled by compareCoverages — skip here to avoid duplicates

  // Check for valuation method change (Replacement Cost → ACV)
  const renewalDwelling = renewal.coverages.find((c) => c.type === 'dwelling');
  const baselineDwelling = baseline.coverages.find((c) => c.type === 'dwelling');
  // Prefer explicit valuationTypeCode, fall back to description parsing
  const baselineDesc = baselineDwelling?.description?.toLowerCase() || '';
  const renewalDesc = renewalDwelling?.description?.toLowerCase() || '';
  const baselineIsRC =
    baselineDesc.includes('replacement cost') || baselineDesc.includes('rc');
  const renewalIsACV =
    renewalDesc.includes('actual cash value') || renewalDesc.includes('acv');

  const baselineValuation = baselineDwelling?.valuationTypeCode?.toUpperCase()
    || (baselineIsRC ? 'RCV' : baselineDesc.includes('acv') ? 'ACV' : null);
  const renewalValuation = renewalDwelling?.valuationTypeCode?.toUpperCase()
    || (renewalIsACV ? 'ACV' : renewalDesc.includes('replacement') ? 'RCV' : null);

  if (baselineValuation === 'RCV' && renewalValuation === 'ACV') {
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
  nonMaterialChanges: MaterialChange[],
  lineOfBusiness?: string
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

  // Build descriptive headline using reason analysis
  const reasons = analyzeReasons(materialChanges, [], renewal, baseline, premiumChange?.changePercent ?? null, lineOfBusiness || null);
  const topReasonTags = reasons
    .filter(r => r.tag !== 'Rate Increase' && r.tag !== 'Rate Decrease' && r.tag !== 'Rate Adjustment')
    .slice(0, 2)
    .map(r => r.tag);

  const amtStr = premiumChange?.changeAmount != null
    ? `$${Math.abs(premiumChange.changeAmount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : null;
  const pctStr = premiumChange?.changePercent != null
    ? `${premiumChange.changePercent > 0 ? '+' : ''}${premiumChange.changePercent.toFixed(1)}%`
    : null;
  const premiumLabel = amtStr && pctStr
    ? `Premium ${premiumDirection === 'increase' ? '+' : premiumDirection === 'decrease' ? '-' : ''}${amtStr} (${pctStr})`
    : null;

  let headline: string;
  if (materialNegativeCount === 0 && premiumDirection !== 'increase') {
    headline = premiumDirection === 'decrease' && premiumLabel
      ? `${premiumLabel} — no concerns`
      : 'Renewal looks favorable — no material changes';
  } else if (materialNegativeCount > 0 && topReasonTags.length > 0) {
    headline = premiumLabel
      ? `${premiumLabel} — ${topReasonTags.join(', ')}`
      : `${materialNegativeCount} concern${materialNegativeCount > 1 ? 's' : ''}: ${topReasonTags.join(', ')}`;
  } else if (materialNegativeCount > 0) {
    headline = premiumLabel
      ? `${premiumLabel} — ${materialNegativeCount} concern${materialNegativeCount > 1 ? 's' : ''} detected`
      : `${materialNegativeCount} material concern${materialNegativeCount > 1 ? 's' : ''} detected`;
  } else {
    headline = premiumLabel
      ? `${premiumLabel} — review needed`
      : 'Renewal review needed';
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
  thresholds: ComparisonThresholds,
  baselineStatus?: 'prior_term' | 'current_term' | 'unknown'
): 'renew_as_is' | 'reshop' | 'needs_review' {
  // Stale baseline = can't make reliable recommendation
  if (baselineStatus === 'current_term') {
    return 'needs_review';
  }

  if (renewal.parseConfidence < 0.5) {
    return 'needs_review'; // Low confidence = manual review
  }

  // PRIMARY TRIGGER: Premium change
  // The main purpose of this tool is current rate vs renewal rate comparison
  const premiumChange = materialChanges.find((c) => c.category === 'premium');
  const premiumIncreasePercent = premiumChange?.changePercent ?? 0;
  const premiumIncreaseAmount = premiumChange?.changeAmount ?? 0;

  // Significant premium increase → reshop
  if (
    premiumIncreasePercent >= thresholds.premiumIncreasePercent ||
    premiumIncreaseAmount >= thresholds.premiumIncreaseAmount
  ) {
    return 'reshop';
  }

  // SECONDARY: Coverage gaps (only if premium is flat/decreased but coverage worsened)
  // These are informational to help agents understand WHY premium changed
  // Only trigger reshop for major coverage gaps when premium didn't go up
  const coverageRemovals = materialChanges.filter(
    (c) => c.category === 'coverage_removed' && c.severity === 'material_negative'
  );
  const majorCoverageTypes = ['bodily_injury', 'property_damage', 'dwelling', 'personal_liability'];
  const hasMajorCoverageRemoval = coverageRemovals.some((c) =>
    majorCoverageTypes.some((t) => c.field === `coverage.${t}`)
  );

  // If major coverage removed AND premium stayed same/decreased, that's suspicious
  if (hasMajorCoverageRemoval && premiumIncreasePercent <= 0) {
    return 'needs_review'; // Not reshop, just needs agent attention
  }

  // Significant premium decrease with ANY coverage removals is suspicious
  // (e.g., -25% because sewer backup / equipment breakdown were dropped)
  if (premiumIncreasePercent <= -15 && coverageRemovals.length > 0) {
    return 'needs_review';
  }

  // Premium flat or decreased with no major issues → renew as is
  return 'renew_as_is';
}

function getConfidenceLevel(parseConfidence: number): 'high' | 'medium' | 'low' {
  if (parseConfidence >= 0.8) return 'high';
  if (parseConfidence >= 0.5) return 'medium';
  return 'low';
}
