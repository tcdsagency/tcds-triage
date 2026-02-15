/**
 * Property Verification Service
 * ==============================
 * Cross-checks HawkSoft property data against public records (RPR, PropertyAPI, Nearmap)
 * and produces CheckResult-compatible objects (PV-001 to PV-010).
 */

import type { CheckResult } from '@/types/check-rules.types';
import type { PropertyContext } from '@/types/renewal.types';
import type { RPRPropertyData } from '@/lib/rpr';
import type { PropertyAPIData } from '@/lib/propertyapi';
import { makeCheck, fmtDollars, pctChange } from '@/lib/al3/check-rules/helpers';

// =============================================================================
// TYPES
// =============================================================================

export interface PropertyVerificationInput {
  propertyContext: PropertyContext | null;
  insuredName: string | null;
  dwellingLimit: number | null;
  rprData: RPRPropertyData | null;
  propertyApiData: PropertyAPIData | null;
  nearmapData: NearmapLookupData | null;
}

export interface NearmapLookupData {
  roof?: {
    condition: string;
    conditionScore: number;
    material?: string;
    issues?: string[];
  };
  pool?: {
    present: boolean;
    type?: string;
    fenced?: boolean;
  };
  vegetation?: {
    treeOverhangArea?: number;
    proximityToStructure: string;
  };
  hazards?: {
    trampoline: boolean;
    debris: boolean;
  };
}

export interface PropertyVerificationResult {
  status: 'complete' | 'error' | 'unavailable';
  verifiedAt: string;
  address: string;
  streetViewUrl: string | null;
  sources: { rpr: boolean; propertyApi: boolean; nearmap: boolean; orion180: boolean };
  propertyLookupId: string | null;
  publicData: {
    yearBuilt?: number;
    sqft?: number;
    stories?: number;
    roofType?: string;
    constructionType?: string;
    ownerName?: string;
    ownerOccupied?: boolean;
    estimatedValue?: number;
    listingStatus?: string;
    lastSaleDate?: string;
    lastSalePrice?: number;
  };
  riskData?: {
    convectionStorm: string | null;
    flood: string | null;
    tornado: string | null;
    lightning: string | null;
    wildfire: string | null;
    hurricane: string | null;
    protectionClass: string | null;
    femaFloodZone: string | null;
    distanceToCoast: number | null;
  } | null;
  checkResults: CheckResult[];
}

// =============================================================================
// FUZZY NAME MATCHING
// =============================================================================

const TITLE_SUFFIXES = /\b(jr|sr|ii|iii|iv|mr|mrs|ms|dr|and|&)\b/gi;

export function normalizePersonName(name: string): string {
  return name
    .replace(TITLE_SUFFIXES, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fuzzyNameMatch(
  insuredName: string | null | undefined,
  ownerName: string | null | undefined,
): { match: boolean; confidence: number } {
  if (!insuredName || !ownerName) return { match: false, confidence: 0 };

  const normInsured = normalizePersonName(insuredName);
  const normOwner = normalizePersonName(ownerName);

  if (!normInsured || !normOwner) return { match: false, confidence: 0 };

  // Exact normalized match
  if (normInsured === normOwner) return { match: true, confidence: 1.0 };

  const insuredParts = normInsured.split(' ').filter(Boolean);
  const ownerParts = normOwner.split(' ').filter(Boolean);

  const insuredFirst = insuredParts[0] || '';
  const insuredLast = insuredParts[insuredParts.length - 1] || '';
  const ownerFirst = ownerParts[0] || '';
  const ownerLast = ownerParts[ownerParts.length - 1] || '';

  // Last name + first name match
  if (insuredLast === ownerLast && insuredFirst === ownerFirst) {
    return { match: true, confidence: 0.95 };
  }

  // Last name + first initial match
  if (insuredLast === ownerLast && insuredFirst[0] === ownerFirst[0]) {
    return { match: true, confidence: 0.7 };
  }

  // Last name only (could be spouse)
  if (insuredLast === ownerLast) {
    return { match: false, confidence: 0.4 };
  }

  // Different last name
  return { match: false, confidence: 0.1 };
}

// =============================================================================
// VERIFICATION RULES ENGINE
// =============================================================================

const CATEGORY = 'Property Verification';

function bestValue<T>(rpr: T | undefined | null, papi: T | undefined | null): T | null {
  return rpr ?? papi ?? null;
}

export function runPropertyVerification(input: PropertyVerificationInput): CheckResult[] {
  const { propertyContext, insuredName, dwellingLimit, rprData, propertyApiData, nearmapData } = input;
  const results: CheckResult[] = [];

  // If no public data at all, nothing to verify
  if (!rprData && !propertyApiData && !nearmapData) return results;

  const pc = propertyContext || {};

  // ---- PV-001: Year Built ----
  const publicYearBuilt = bestValue(rprData?.yearBuilt, propertyApiData?.building?.yearBuilt);
  if (publicYearBuilt && pc.yearBuilt) {
    const diff = Math.abs(pc.yearBuilt - publicYearBuilt);
    const severity = diff > 5 ? 'warning' : diff > 0 ? 'info' : 'unchanged';
    results.push(makeCheck('PV-001', {
      field: 'Year Built',
      previousValue: pc.yearBuilt,
      renewalValue: publicYearBuilt,
      change: diff > 0 ? `${diff} year difference` : 'Match',
      severity,
      message: severity === 'unchanged'
        ? `Year built matches public records (${publicYearBuilt})`
        : `HawkSoft year built (${pc.yearBuilt}) differs from public records (${publicYearBuilt}) by ${diff} years`,
      agentAction: severity === 'warning'
        ? 'Verify year built with insured — may affect replacement cost'
        : 'No action needed',
      checkType: 'cross_field',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-002: Square Footage ----
  const publicSqft = bestValue(rprData?.sqft, propertyApiData?.building?.sqft);
  if (publicSqft && pc.squareFeet) {
    const variance = Math.abs(pctChange(pc.squareFeet, publicSqft));
    const severity = variance > 25 ? 'critical' : variance > 10 ? 'warning' : variance > 0 ? 'info' : 'unchanged';
    results.push(makeCheck('PV-002', {
      field: 'Square Footage',
      previousValue: pc.squareFeet,
      renewalValue: publicSqft,
      change: variance > 0 ? `${variance.toFixed(0)}% variance` : 'Match',
      severity,
      message: severity === 'unchanged'
        ? `Square footage matches public records (${publicSqft.toLocaleString()} sqft)`
        : `HawkSoft (${pc.squareFeet.toLocaleString()} sqft) vs public records (${publicSqft.toLocaleString()} sqft) — ${variance.toFixed(0)}% variance`,
      agentAction: severity === 'critical'
        ? 'Square footage significantly off — update replacement cost estimate immediately'
        : severity === 'warning'
          ? 'Verify square footage with insured — may affect replacement cost'
          : 'No action needed',
      checkType: 'cross_field',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-003: Roof Type ----
  const publicRoof = rprData?.roofType || null;
  if (publicRoof && pc.roofType) {
    const hawkNorm = pc.roofType.toLowerCase().trim();
    const pubNorm = publicRoof.toLowerCase().trim();
    const matches = hawkNorm === pubNorm || hawkNorm.includes(pubNorm) || pubNorm.includes(hawkNorm);
    results.push(makeCheck('PV-003', {
      field: 'Roof Type',
      previousValue: pc.roofType,
      renewalValue: publicRoof,
      change: matches ? 'Match' : 'Different',
      severity: matches ? 'unchanged' : 'info',
      message: matches
        ? `Roof type matches public records (${publicRoof})`
        : `HawkSoft roof "${pc.roofType}" vs public records "${publicRoof}"`,
      agentAction: matches ? 'No action needed' : 'Verify roof type — may affect premium rating',
      checkType: 'cross_field',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-004: Construction Type ----
  const publicConstruction = rprData?.exteriorWalls || rprData?.constructionType || null;
  if (publicConstruction && pc.constructionType) {
    const hawkNorm = pc.constructionType.toLowerCase().trim();
    const pubNorm = publicConstruction.toLowerCase().trim();
    const matches = hawkNorm === pubNorm || hawkNorm.includes(pubNorm) || pubNorm.includes(hawkNorm);
    results.push(makeCheck('PV-004', {
      field: 'Construction Type',
      previousValue: pc.constructionType,
      renewalValue: publicConstruction,
      change: matches ? 'Match' : 'Different',
      severity: matches ? 'unchanged' : 'warning',
      message: matches
        ? `Construction type matches public records (${publicConstruction})`
        : `HawkSoft construction "${pc.constructionType}" vs public records "${publicConstruction}"`,
      agentAction: matches ? 'No action needed' : 'Verify construction type with insured — affects replacement cost',
      checkType: 'cross_field',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-005: Stories ----
  const publicStories = bestValue(rprData?.stories, propertyApiData?.building?.stories);
  if (publicStories) {
    results.push(makeCheck('PV-005', {
      field: 'Stories',
      previousValue: null,
      renewalValue: publicStories,
      change: `${publicStories} stories`,
      severity: 'info',
      message: `Public records show ${publicStories} ${publicStories === 1 ? 'story' : 'stories'}`,
      agentAction: 'Informational — verify matches policy application',
      checkType: 'existence',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-006: Owner / Insured Name Match ----
  const publicOwner = bestValue(rprData?.ownerName, propertyApiData?.owner?.name);
  if (publicOwner && insuredName) {
    const { match, confidence } = fuzzyNameMatch(insuredName, publicOwner);
    const severity = match
      ? 'unchanged'
      : confidence < 0.3 ? 'critical' : 'warning';
    results.push(makeCheck('PV-006', {
      field: 'Owner / Insured Name',
      previousValue: insuredName,
      renewalValue: publicOwner,
      change: match ? `Match (${(confidence * 100).toFixed(0)}%)` : `Mismatch (${(confidence * 100).toFixed(0)}% confidence)`,
      severity,
      message: match
        ? `Insured name matches property owner (${publicOwner})`
        : `Insured "${insuredName}" does not match property owner "${publicOwner}" — confidence ${(confidence * 100).toFixed(0)}%`,
      agentAction: severity === 'critical'
        ? 'Owner name mismatch — verify insurable interest. Property may have been sold or transferred.'
        : severity === 'warning'
          ? 'Possible name mismatch — could be spouse or trust. Verify with insured.'
          : 'No action needed',
      checkType: 'cross_field',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-007: Coverage Adequacy (Dwelling Limit vs Estimated Value) ----
  const estimatedValue = bestValue(rprData?.estimatedValue, propertyApiData?.valuation?.marketValue);
  if (estimatedValue && dwellingLimit && estimatedValue > 0) {
    const ratio = (dwellingLimit / estimatedValue) * 100;
    const severity = ratio < 50 ? 'critical' : ratio < 70 ? 'warning' : ratio > 150 ? 'info' : 'unchanged';
    results.push(makeCheck('PV-007', {
      field: 'Coverage Adequacy',
      previousValue: fmtDollars(estimatedValue),
      renewalValue: fmtDollars(dwellingLimit),
      change: `${ratio.toFixed(0)}% of estimated value`,
      severity,
      message: severity === 'unchanged'
        ? `Dwelling limit (${fmtDollars(dwellingLimit)}) is adequate vs estimated value (${fmtDollars(estimatedValue)})`
        : ratio > 150
          ? `Dwelling limit (${fmtDollars(dwellingLimit)}) is ${ratio.toFixed(0)}% of estimated value (${fmtDollars(estimatedValue)}) — may be over-insured`
          : `Dwelling limit (${fmtDollars(dwellingLimit)}) is only ${ratio.toFixed(0)}% of estimated value (${fmtDollars(estimatedValue)}) — potentially under-insured`,
      agentAction: severity === 'critical'
        ? 'Dwelling limit significantly below estimated value — discuss coverage increase with insured'
        : severity === 'warning'
          ? 'Dwelling limit may be inadequate — review replacement cost with insured'
          : severity === 'info'
            ? 'Dwelling limit exceeds estimated value — verify replacement cost is accurate'
            : 'No action needed',
      checkType: 'ratio',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-008: Listing / Sale Status ----
  const currentStatus = rprData?.currentStatus;
  if (currentStatus && currentStatus !== 'off_market' && currentStatus !== 'unknown') {
    const severity = 'critical';
    const statusLabel = currentStatus === 'active' ? 'actively listed for sale'
      : currentStatus === 'pending' ? 'pending sale'
        : currentStatus === 'sold' ? 'recently sold'
          : currentStatus;
    results.push(makeCheck('PV-008', {
      field: 'Listing / Sale Status',
      previousValue: null,
      renewalValue: currentStatus,
      change: statusLabel,
      severity,
      message: `Property is ${statusLabel}${rprData?.listing?.price ? ` at ${fmtDollars(rprData.listing.price)}` : ''}`,
      agentAction: 'Property may be changing hands — verify insurable interest and contact insured immediately',
      checkType: 'existence',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  // ---- PV-009: Hazard Detection (Nearmap) ----
  if (nearmapData) {
    const hazards: string[] = [];
    if (nearmapData.pool?.present) {
      if (!nearmapData.pool.fenced) {
        hazards.push('Unfenced pool detected');
      } else {
        hazards.push('Pool detected (fenced)');
      }
    }
    if (nearmapData.hazards?.trampoline) {
      hazards.push('Trampoline detected');
    }
    if (nearmapData.vegetation?.proximityToStructure === 'significant' || (nearmapData.vegetation?.treeOverhangArea && nearmapData.vegetation.treeOverhangArea > 100)) {
      hazards.push('Significant tree overhang near structure');
    }
    if (hazards.length > 0) {
      const hasUnfencedPool = hazards.some(h => h.includes('Unfenced'));
      results.push(makeCheck('PV-009', {
        field: 'Hazard Detection',
        previousValue: null,
        renewalValue: hazards.join('; '),
        change: `${hazards.length} hazard${hazards.length > 1 ? 's' : ''} detected`,
        severity: hasUnfencedPool ? 'warning' : 'info',
        message: hazards.join('. ') + '.',
        agentAction: hasUnfencedPool
          ? 'Unfenced pool is a liability concern — verify pool fencing with insured'
          : 'Review detected hazards with insured',
        checkType: 'existence',
        category: CATEGORY,
        isBlocking: false,
      }));
    }
  }

  // ---- PV-010: Roof Condition (Nearmap) ----
  if (nearmapData?.roof) {
    const score = nearmapData.roof.conditionScore;
    const condition = nearmapData.roof.condition;
    const isPoor = score < 50 || condition?.toLowerCase() === 'poor';
    results.push(makeCheck('PV-010', {
      field: 'Roof Condition',
      previousValue: null,
      renewalValue: `${condition} (score: ${score})`,
      change: isPoor ? 'Poor condition' : `${condition}`,
      severity: isPoor ? 'warning' : 'info',
      message: `Nearmap roof condition: ${condition} (score ${score}/100)${nearmapData.roof.issues?.length ? ` — Issues: ${nearmapData.roof.issues.join(', ')}` : ''}`,
      agentAction: isPoor
        ? 'Roof in poor condition — discuss roof inspection or replacement timeline with insured'
        : 'Informational — roof condition noted from aerial imagery',
      checkType: 'existence',
      category: CATEGORY,
      isBlocking: false,
    }));
  }

  return results;
}
