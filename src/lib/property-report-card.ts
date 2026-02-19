// Property Report Card
// Cross-references ALL 6 data sources and flags verified vs. conflicting fields.

import type { RPRPropertyData } from '@/lib/rpr';
import type { PropertyAPIData } from '@/lib/propertyapi';
import type { Orion180PropertyData } from '@/lib/orion180';
import type { NearmapFeatures } from '@/lib/nearmap';
import type { FloodZoneData } from '@/lib/fema-flood';
import { fuzzyNameMatch } from '@/lib/property-verification';

// =============================================================================
// TYPES
// =============================================================================

type FieldStatus = 'verified' | 'conflict' | 'single_source' | 'unavailable';
type ProviderName = 'rpr' | 'propertyApi' | 'orion180' | 'nearmap' | 'mmi' | 'fema';

interface SourceEntry<T = any> {
  provider: ProviderName;
  raw: any;
  normalized: T | null;
}

interface ReportCardField<T = string | number | boolean | null> {
  field: string;
  status: FieldStatus;
  resolved: T | null;
  sources: SourceEntry<T>[];
  notes?: string;
}

// MMI data shape (from schema inline type)
interface MMIData {
  propertyId?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  listingHistory?: any[];
  deedHistory?: any[];
  currentStatus?: 'off_market' | 'active' | 'pending' | 'sold' | 'unknown';
  lastSaleDate?: string;
  lastSalePrice?: number;
  lastUpdated?: string;
}

export interface PropertyReportCard {
  generatedAt: string;
  address: string;
  providers: Record<ProviderName, boolean>;

  basics: {
    yearBuilt: ReportCardField<number>;
    sqft: ReportCardField<number>;
    stories: ReportCardField<number>;
    beds: ReportCardField<number>;
    baths: ReportCardField<number>;
    lotAcres: ReportCardField<number>;
    propertyType: ReportCardField<string>;
  };
  construction: {
    roofMaterial: ReportCardField<string>;
    roofShape: ReportCardField<string>;
    roofCondition: ReportCardField<string>;
    roofScore: ReportCardField<number>;
    constructionType: ReportCardField<string>;
    foundation: ReportCardField<string>;
    exteriorWalls: ReportCardField<string>;
    hvac: ReportCardField<string>;
  };
  owner: {
    ownerName: ReportCardField<string>;
    ownerOccupied: ReportCardField<boolean>;
    mailingAddress: ReportCardField<string>;
  };
  valuation: {
    marketValue: ReportCardField<number>;
    assessedValue: ReportCardField<number>;
    annualTax: ReportCardField<number>;
    lastSaleDate: ReportCardField<string>;
    lastSalePrice: ReportCardField<number>;
  };
  risk: {
    hurricaneGrade: ReportCardField<string>;
    floodGrade: ReportCardField<string>;
    tornadoGrade: ReportCardField<string>;
    wildfireGrade: ReportCardField<string>;
    convectionGrade: ReportCardField<string>;
    lightningGrade: ReportCardField<string>;
    femaFloodZone: ReportCardField<string>;
    floodRisk: ReportCardField<string>;
    specialFloodHazardArea: ReportCardField<boolean>;
    protectionClass: ReportCardField<string>;
  };
  aerial: {
    roofMaterial: ReportCardField<string>;
    roofConditionScore: ReportCardField<number>;
    roofIssues: ReportCardField<string[]>;
    buildingCount: ReportCardField<number>;
    buildingFootprint: ReportCardField<number>;
    solarPresent: ReportCardField<boolean>;
    treeOverhang: ReportCardField<number>;
    poolDetected: ReportCardField<boolean>;
  };
  market: {
    currentStatus: ReportCardField<string>;
    listingHistory: ReportCardField<any[]>;
    deedHistory: ReportCardField<any[]>;
  };
  parcel: {
    fips: ReportCardField<string>;
    apn: ReportCardField<string>;
    county: ReportCardField<string>;
    legalDescription: ReportCardField<string>;
    coordinates: ReportCardField<{ lat: number; lng: number }>;
  };

  summary: {
    totalFields: number;
    verifiedCount: number;
    conflictCount: number;
    singleSourceCount: number;
    unavailableCount: number;
    overallConfidence: number;
    conflicts: Array<{
      field: string;
      section: string;
      values: Partial<Record<ProviderName, any>>;
      notes?: string;
    }>;
  };
}

// =============================================================================
// NORMALIZATION HELPERS
// =============================================================================

const ROOF_MATERIAL_MAP: Record<string, string> = {
  'composition shingle': 'asphalt_shingle',
  'asphaltshingle': 'asphalt_shingle',
  'asphalt shingle': 'asphalt_shingle',
  'comp shingle': 'asphalt_shingle',
  'shingle': 'asphalt_shingle',
  'asphalt': 'asphalt_shingle',
  'architectural shingle': 'asphalt_shingle',
  'dimensional shingle': 'asphalt_shingle',
  '3-tab shingle': 'asphalt_shingle',
  'metal': 'metal',
  'standing seam metal': 'metal',
  'steel': 'metal',
  'aluminum': 'metal',
  'tile': 'tile',
  'clay tile': 'tile',
  'concrete tile': 'tile',
  'barrel tile': 'tile',
  'spanish tile': 'tile',
  'slate': 'slate',
  'wood shake': 'wood_shake',
  'wood shingle': 'wood_shake',
  'shake': 'wood_shake',
  'flat': 'flat',
  'built-up': 'flat',
  'tar and gravel': 'flat',
  'membrane': 'flat',
  'rubber': 'flat',
  'tpo': 'flat',
  'epdm': 'flat',
};

function normalizeRoofMaterial(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return ROOF_MATERIAL_MAP[key] ?? key;
}

const CONSTRUCTION_MAP: Record<string, string> = {
  'masonry': 'masonry',
  'brick': 'masonry',
  'block': 'masonry',
  'concrete block': 'masonry',
  'cbs': 'masonry',
  'concrete': 'masonry',
  'stucco': 'masonry',
  'frame': 'frame',
  'wood': 'frame',
  'wood frame': 'frame',
  'log': 'frame',
  'steel': 'steel',
  'metal': 'steel',
  'manufactured': 'manufactured',
  'modular': 'manufactured',
  'mobile': 'manufactured',
};

function normalizeConstructionType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return CONSTRUCTION_MAP[key] ?? key;
}

const FOUNDATION_MAP: Record<string, string> = {
  'basement': 'basement',
  'full basement': 'basement',
  'finished basement': 'basement',
  'unfinished basement': 'basement',
  'partial basement': 'basement',
  'walkout basement': 'basement',
  'slab': 'slab',
  'slab on grade': 'slab',
  'concrete slab': 'slab',
  'crawl space': 'crawl_space',
  'crawlspace': 'crawl_space',
  'crawl': 'crawl_space',
  'pier': 'pier',
  'piers': 'pier',
  'pilings': 'pier',
  'stilts': 'pier',
  'raised': 'pier',
};

function normalizeFoundation(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return FOUNDATION_MAP[key] ?? key;
}

function normalizeFloodZone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let z = raw.toUpperCase().trim();
  // Normalize variants
  if (z === 'X (UNSHADED)' || z === 'X UNSHADED') z = 'X';
  if (z === 'X (SHADED)' || z === 'X SHADED' || z === 'X500') z = 'X (shaded)';
  return z;
}

// =============================================================================
// FIELD COMPARISON
// =============================================================================

// Priority order for resolved value
const PRIORITY: ProviderName[] = ['rpr', 'propertyApi', 'orion180', 'nearmap', 'mmi', 'fema'];

function compareField<T>(
  fieldName: string,
  entries: SourceEntry<T>[],
  options?: { tolerance?: number; fuzzy?: boolean; yearTolerance?: number },
): ReportCardField<T> {
  const withValues = entries.filter(e => e.normalized !== null && e.normalized !== undefined);

  if (withValues.length === 0) {
    return { field: fieldName, status: 'unavailable', resolved: null, sources: entries };
  }

  if (withValues.length === 1) {
    return { field: fieldName, status: 'single_source', resolved: withValues[0].normalized, sources: entries };
  }

  // Check agreement
  const first = withValues[0].normalized;
  let allAgree = true;

  for (let i = 1; i < withValues.length; i++) {
    const val = withValues[i].normalized;
    if (!valuesMatch(first, val, options)) {
      allAgree = false;
      break;
    }
  }

  // Pick priority winner for resolved value
  const resolved = pickPriorityValue(withValues);

  if (allAgree) {
    return { field: fieldName, status: 'verified', resolved, sources: entries };
  }

  return { field: fieldName, status: 'conflict', resolved, sources: entries };
}

function valuesMatch<T>(a: T, b: T, options?: { tolerance?: number; yearTolerance?: number; fuzzy?: boolean }): boolean {
  if (a === b) return true;

  // Number comparison with tolerance
  if (typeof a === 'number' && typeof b === 'number') {
    if (options?.yearTolerance !== undefined) {
      return Math.abs(a - b) <= options.yearTolerance;
    }
    const tolerance = options?.tolerance ?? 0.05;
    const avg = (Math.abs(a) + Math.abs(b)) / 2;
    if (avg === 0) return a === b;
    return Math.abs(a - b) / avg <= tolerance;
  }

  // String comparison
  if (typeof a === 'string' && typeof b === 'string') {
    if (options?.fuzzy) {
      const result = fuzzyNameMatch(a, b);
      return result.confidence >= 0.7;
    }
    return a.toLowerCase().trim() === b.toLowerCase().trim();
  }

  // Boolean
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }

  return false;
}

function pickPriorityValue<T>(entries: SourceEntry<T>[]): T | null {
  for (const p of PRIORITY) {
    const found = entries.find(e => e.provider === p && e.normalized !== null && e.normalized !== undefined);
    if (found) return found.normalized;
  }
  return entries[0]?.normalized ?? null;
}

// =============================================================================
// REPORT CARD GENERATOR
// =============================================================================

export function generateReportCard(
  address: string,
  rprData: RPRPropertyData | null,
  propertyApiData: PropertyAPIData | null,
  orion180Data: Orion180PropertyData | null,
  nearmapData: NearmapFeatures | null,
  mmiData: MMIData | null,
  femaData: FloodZoneData | null,
): PropertyReportCard {
  const providers: Record<ProviderName, boolean> = {
    rpr: !!rprData,
    propertyApi: !!propertyApiData,
    orion180: !!orion180Data,
    nearmap: !!nearmapData,
    mmi: !!mmiData,
    fema: !!femaData,
  };

  // ── Basics ──
  const yearBuilt = compareField<number>('Year Built', [
    { provider: 'rpr', raw: rprData?.yearBuilt, normalized: rprData?.yearBuilt ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.building?.yearBuilt, normalized: propertyApiData?.building?.yearBuilt ?? null },
    { provider: 'orion180', raw: orion180Data?.yearBuilt, normalized: orion180Data?.yearBuilt ?? null },
  ], { yearTolerance: 2 });

  // Sqft: special handling for Orion180 basement inclusion
  const rprSqft = rprData?.sqft ?? null;
  const paSqft = propertyApiData?.building?.sqft ?? null;
  const o180Sqft = orion180Data?.sqft ?? null;
  const referenceSqft = rprSqft ?? paSqft;
  let sqftNotes: string | undefined;
  let sqftEntries: SourceEntry<number>[] = [
    { provider: 'rpr', raw: rprSqft, normalized: rprSqft },
    { provider: 'propertyApi', raw: paSqft, normalized: paSqft },
    { provider: 'orion180', raw: o180Sqft, normalized: o180Sqft },
  ];

  // If Orion180 sqft is >30% higher AND Orion180 reports basement → exclude from comparison
  if (o180Sqft && referenceSqft && o180Sqft > referenceSqft * 1.3) {
    const o180Foundation = orion180Data?.construction?.toLowerCase() ?? '';
    if (FOUNDATION_MAP[o180Foundation] === 'basement' || o180Foundation.includes('basement')) {
      sqftNotes = `Orion180 sqft likely includes basement (${o180Sqft} sqft vs ${referenceSqft} sqft)`;
      sqftEntries = sqftEntries.filter(e => e.provider !== 'orion180');
    }
  }
  const sqft = compareField<number>('Square Footage', sqftEntries);
  if (sqftNotes) sqft.notes = sqftNotes;

  const stories = compareField<number>('Stories', [
    { provider: 'rpr', raw: rprData?.stories, normalized: rprData?.stories ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.building?.stories, normalized: propertyApiData?.building?.stories ?? null },
    { provider: 'orion180', raw: orion180Data?.numFloors, normalized: orion180Data?.numFloors ?? null },
  ]);

  const beds = compareField<number>('Bedrooms', [
    { provider: 'rpr', raw: rprData?.beds, normalized: rprData?.beds ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.building?.bedrooms, normalized: propertyApiData?.building?.bedrooms ?? null },
  ]);

  const baths = compareField<number>('Bathrooms', [
    { provider: 'rpr', raw: rprData?.baths, normalized: rprData?.baths ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.building?.bathrooms, normalized: propertyApiData?.building?.bathrooms ?? null },
  ]);

  const lotAcres = compareField<number>('Lot Acres', [
    { provider: 'rpr', raw: rprData?.lotAcres, normalized: rprData?.lotAcres ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.building?.lotSizeAcres, normalized: propertyApiData?.building?.lotSizeAcres ?? null },
  ]);

  const propertyType = compareField<string>('Property Type', [
    { provider: 'rpr', raw: rprData?.propertyType, normalized: rprData?.propertyType?.toLowerCase() ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.propertyType, normalized: propertyApiData?.propertyType?.toLowerCase() ?? null },
  ]);

  // ── Construction ──
  const roofMaterial = compareField<string>('Roof Material', [
    { provider: 'rpr', raw: rprData?.roofMaterial ?? rprData?.roofType, normalized: normalizeRoofMaterial(rprData?.roofMaterial ?? rprData?.roofType) },
    { provider: 'orion180', raw: orion180Data?.roofMaterial, normalized: normalizeRoofMaterial(orion180Data?.roofMaterial) },
    { provider: 'nearmap', raw: nearmapData?.roof?.material, normalized: normalizeRoofMaterial(nearmapData?.roof?.material) },
  ]);
  // Flag visual vs records mismatch
  if (roofMaterial.status === 'conflict') {
    const nearmapEntry = roofMaterial.sources.find(s => s.provider === 'nearmap' && s.normalized);
    const recordEntries = roofMaterial.sources.filter(s => s.provider !== 'nearmap' && s.normalized);
    if (nearmapEntry && recordEntries.length > 0) {
      const recordsAgree = recordEntries.every(e => valuesMatch(e.normalized, recordEntries[0].normalized));
      if (recordsAgree && !valuesMatch(nearmapEntry.normalized, recordEntries[0].normalized)) {
        roofMaterial.notes = 'Visual inspection (Nearmap) differs from public records';
      }
    }
  }

  const roofShape = compareField<string>('Roof Shape', [
    { provider: 'orion180', raw: orion180Data?.roofShape, normalized: orion180Data?.roofShape?.toLowerCase() ?? null },
  ]);

  const roofCondition = compareField<string>('Roof Condition', [
    { provider: 'nearmap', raw: nearmapData?.roof?.condition, normalized: nearmapData?.roof?.condition?.toLowerCase() ?? null },
  ]);

  const roofScore = compareField<number>('Roof Score', [
    { provider: 'nearmap', raw: nearmapData?.roof?.conditionScore, normalized: nearmapData?.roof?.conditionScore ?? null },
  ]);

  const constructionType = compareField<string>('Construction Type', [
    { provider: 'rpr', raw: rprData?.constructionType, normalized: normalizeConstructionType(rprData?.constructionType) },
    { provider: 'orion180', raw: orion180Data?.construction, normalized: normalizeConstructionType(orion180Data?.construction) },
  ]);

  const foundation = compareField<string>('Foundation', [
    { provider: 'rpr', raw: rprData?.foundation, normalized: normalizeFoundation(rprData?.foundation) },
  ]);

  const exteriorWalls = compareField<string>('Exterior Walls', [
    { provider: 'rpr', raw: rprData?.exteriorWalls, normalized: rprData?.exteriorWalls?.toLowerCase() ?? null },
  ]);

  const hvac = compareField<string>('HVAC', [
    { provider: 'rpr', raw: rprData?.hvac, normalized: rprData?.hvac?.toLowerCase() ?? null },
  ]);

  // ── Owner ──
  const ownerName = compareField<string>('Owner Name', [
    { provider: 'rpr', raw: rprData?.ownerName, normalized: rprData?.ownerName ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.owner?.name, normalized: propertyApiData?.owner?.name ?? null },
  ], { fuzzy: true });

  const ownerOccupied = compareField<boolean>('Owner Occupied', [
    { provider: 'rpr', raw: rprData?.ownerOccupied, normalized: rprData?.ownerOccupied ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.owner?.ownerOccupied, normalized: propertyApiData?.owner?.ownerOccupied ?? null },
  ]);

  const mailingAddress = compareField<string>('Mailing Address', [
    { provider: 'rpr', raw: rprData?.mailingAddress, normalized: rprData?.mailingAddress?.toLowerCase() ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.owner?.mailingAddress, normalized: propertyApiData?.owner?.mailingAddress?.toLowerCase() ?? null },
  ]);

  // ── Valuation ──
  const marketValue = compareField<number>('Market Value', [
    { provider: 'rpr', raw: rprData?.estimatedValue, normalized: rprData?.estimatedValue ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.valuation?.marketValue, normalized: propertyApiData?.valuation?.marketValue ?? null },
  ], { tolerance: 0.15 }); // wider tolerance for valuations

  const assessedValue = compareField<number>('Assessed Value', [
    { provider: 'rpr', raw: rprData?.assessedValue, normalized: rprData?.assessedValue ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.valuation?.assessedTotal, normalized: propertyApiData?.valuation?.assessedTotal ?? null },
  ], { tolerance: 0.05 });

  const annualTax = compareField<number>('Annual Tax', [
    { provider: 'rpr', raw: rprData?.taxAmount, normalized: rprData?.taxAmount ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.tax?.annualTax, normalized: propertyApiData?.tax?.annualTax ?? null },
  ], { tolerance: 0.05 });

  // Last sale: most recent date wins
  const lastSaleDateEntries: SourceEntry<string>[] = [
    { provider: 'rpr', raw: rprData?.lastSaleDate, normalized: rprData?.lastSaleDate ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.saleHistory?.lastSaleDate, normalized: propertyApiData?.saleHistory?.lastSaleDate ?? null },
    { provider: 'mmi', raw: mmiData?.lastSaleDate, normalized: mmiData?.lastSaleDate ?? null },
  ];
  const lastSaleDate = compareField<string>('Last Sale Date', lastSaleDateEntries);
  // Override resolved to most recent date
  const validDates = lastSaleDateEntries.filter(e => e.normalized).map(e => ({ ...e, parsed: new Date(e.normalized!) }));
  if (validDates.length > 1) {
    validDates.sort((a, b) => b.parsed.getTime() - a.parsed.getTime());
    lastSaleDate.resolved = validDates[0].normalized;
    if (validDates[0].provider === 'propertyApi' && validDates.some(v => v.provider === 'mmi')) {
      lastSaleDate.notes = 'PropertyAPI has newer sale than MMI';
    }
  }

  const lastSalePrice = compareField<number>('Last Sale Price', [
    { provider: 'rpr', raw: rprData?.lastSalePrice, normalized: rprData?.lastSalePrice ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.saleHistory?.lastSalePrice, normalized: propertyApiData?.saleHistory?.lastSalePrice ?? null },
    { provider: 'mmi', raw: mmiData?.lastSalePrice, normalized: mmiData?.lastSalePrice ?? null },
  ], { tolerance: 0.01 });

  // ── Risk ──
  const hurricaneGrade = compareField<string>('Hurricane Grade', [
    { provider: 'orion180', raw: orion180Data?.hurricaneGrade, normalized: orion180Data?.hurricaneGrade ?? null },
  ]);

  const floodGrade = compareField<string>('Flood Grade', [
    { provider: 'orion180', raw: orion180Data?.floodGrade, normalized: orion180Data?.floodGrade ?? null },
  ]);

  const tornadoGrade = compareField<string>('Tornado Grade', [
    { provider: 'orion180', raw: orion180Data?.tornadoGrade, normalized: orion180Data?.tornadoGrade ?? null },
  ]);

  const wildfireGrade = compareField<string>('Wildfire Grade', [
    { provider: 'orion180', raw: orion180Data?.wildfireGrade, normalized: orion180Data?.wildfireGrade ?? null },
  ]);

  const convectionGrade = compareField<string>('Convection Storm Grade', [
    { provider: 'orion180', raw: orion180Data?.convectionStormGrade, normalized: orion180Data?.convectionStormGrade ?? null },
  ]);

  const lightningGrade = compareField<string>('Lightning Grade', [
    { provider: 'orion180', raw: orion180Data?.lightningGrade, normalized: orion180Data?.lightningGrade ?? null },
  ]);

  // FEMA Flood Zone: cross-verify Orion180 vs FEMA/Lightbox
  const femaFloodZone = compareField<string>('FEMA Flood Zone', [
    { provider: 'orion180', raw: orion180Data?.femaFloodZone, normalized: normalizeFloodZone(orion180Data?.femaFloodZone) },
    { provider: 'fema', raw: femaData?.floodZone, normalized: normalizeFloodZone(femaData?.floodZone) },
  ]);

  const floodRisk = compareField<string>('Flood Risk', [
    { provider: 'fema', raw: femaData?.floodRisk, normalized: femaData?.floodRisk ?? null },
  ]);

  const specialFloodHazardArea = compareField<boolean>('Special Flood Hazard Area', [
    { provider: 'fema', raw: femaData?.specialFloodHazardArea, normalized: femaData?.specialFloodHazardArea ?? null },
  ]);

  const protectionClass = compareField<string>('Protection Class', [
    { provider: 'orion180', raw: orion180Data?.protectionClass, normalized: orion180Data?.protectionClass ?? null },
  ]);

  // ── Aerial ──
  const aerialRoofMaterial = compareField<string>('Aerial Roof Material', [
    { provider: 'nearmap', raw: nearmapData?.roof?.material, normalized: normalizeRoofMaterial(nearmapData?.roof?.material) },
  ]);

  const roofConditionScore = compareField<number>('Roof Condition Score', [
    { provider: 'nearmap', raw: nearmapData?.roof?.conditionScore, normalized: nearmapData?.roof?.conditionScore ?? null },
  ]);

  const roofIssues = compareField<string[]>('Roof Issues', [
    { provider: 'nearmap', raw: nearmapData?.roof?.issues, normalized: nearmapData?.roof?.issues ?? null },
  ]);

  const buildingCount = compareField<number>('Building Count', [
    { provider: 'nearmap', raw: nearmapData?.building?.count, normalized: nearmapData?.building?.count ?? null },
  ]);

  const buildingFootprint = compareField<number>('Building Footprint', [
    { provider: 'nearmap', raw: nearmapData?.building?.footprintArea, normalized: nearmapData?.building?.footprintArea ?? null },
  ]);

  const solarPresent = compareField<boolean>('Solar Present', [
    { provider: 'nearmap', raw: nearmapData?.solar?.present, normalized: nearmapData?.solar?.present ?? null },
  ]);

  const treeOverhang = compareField<number>('Tree Overhang', [
    { provider: 'nearmap', raw: nearmapData?.vegetation?.treeOverhangArea, normalized: nearmapData?.vegetation?.treeOverhangArea ?? null },
  ]);

  const poolDetected = compareField<boolean>('Pool Detected', [
    { provider: 'rpr', raw: rprData?.hasPool, normalized: rprData?.hasPool ?? null },
  ]);

  // ── Market ──
  const currentStatus = compareField<string>('Current Status', [
    { provider: 'rpr', raw: rprData?.currentStatus, normalized: rprData?.currentStatus ?? null },
    { provider: 'mmi', raw: mmiData?.currentStatus, normalized: mmiData?.currentStatus ?? null },
  ]);

  const listingHistory = compareField<any[]>('Listing History', [
    { provider: 'mmi', raw: mmiData?.listingHistory, normalized: mmiData?.listingHistory ?? null },
  ]);

  const deedHistory = compareField<any[]>('Deed History', [
    { provider: 'mmi', raw: mmiData?.deedHistory, normalized: mmiData?.deedHistory ?? null },
  ]);

  // ── Parcel ──
  const fips = compareField<string>('FIPS', [
    { provider: 'propertyApi', raw: propertyApiData?.parcel?.fips, normalized: propertyApiData?.parcel?.fips ?? null },
  ]);

  const apn = compareField<string>('APN', [
    { provider: 'propertyApi', raw: propertyApiData?.parcel?.apn, normalized: propertyApiData?.parcel?.apn ?? null },
  ]);

  const county = compareField<string>('County', [
    { provider: 'rpr', raw: rprData?.address?.county, normalized: rprData?.address?.county?.toLowerCase() ?? null },
    { provider: 'propertyApi', raw: propertyApiData?.parcel?.county, normalized: propertyApiData?.parcel?.county?.toLowerCase() ?? null },
  ]);

  const legalDescription = compareField<string>('Legal Description', [
    { provider: 'propertyApi', raw: propertyApiData?.parcel?.legalDescription, normalized: propertyApiData?.parcel?.legalDescription ?? null },
  ]);

  const coordinates = compareField<{ lat: number; lng: number }>('Coordinates', [
    { provider: 'rpr', raw: rprData?.coordinates, normalized: rprData?.coordinates ? { lat: rprData.coordinates.latitude, lng: rprData.coordinates.longitude } : null },
    { provider: 'propertyApi', raw: propertyApiData?.location, normalized: propertyApiData?.location?.lat && propertyApiData?.location?.lng ? { lat: propertyApiData.location.lat, lng: propertyApiData.location.lng } : null },
  ]);

  // ── Build the card ──
  const card: PropertyReportCard = {
    generatedAt: new Date().toISOString(),
    address,
    providers,
    basics: { yearBuilt, sqft, stories, beds, baths, lotAcres, propertyType },
    construction: { roofMaterial, roofShape, roofCondition, roofScore, constructionType, foundation, exteriorWalls, hvac },
    owner: { ownerName, ownerOccupied, mailingAddress },
    valuation: { marketValue, assessedValue, annualTax, lastSaleDate, lastSalePrice },
    risk: { hurricaneGrade, floodGrade, tornadoGrade, wildfireGrade, convectionGrade, lightningGrade, femaFloodZone, floodRisk, specialFloodHazardArea, protectionClass },
    aerial: { roofMaterial: aerialRoofMaterial, roofConditionScore, roofIssues, buildingCount, buildingFootprint, solarPresent, treeOverhang, poolDetected },
    market: { currentStatus, listingHistory, deedHistory },
    parcel: { fips, apn, county, legalDescription, coordinates },
    summary: { totalFields: 0, verifiedCount: 0, conflictCount: 0, singleSourceCount: 0, unavailableCount: 0, overallConfidence: 0, conflicts: [] },
  };

  // ── Compute summary ──
  const allFields = collectAllFields(card);
  let verified = 0, conflict = 0, singleSource = 0, unavailable = 0;
  const conflicts: PropertyReportCard['summary']['conflicts'] = [];

  for (const { field, section } of allFields) {
    switch (field.status) {
      case 'verified': verified++; break;
      case 'conflict':
        conflict++;
        const vals: Partial<Record<ProviderName, any>> = {};
        for (const s of field.sources) {
          if (s.normalized !== null && s.normalized !== undefined) {
            vals[s.provider] = s.normalized;
          }
        }
        conflicts.push({ field: field.field, section, values: vals, notes: field.notes });
        break;
      case 'single_source': singleSource++; break;
      case 'unavailable': unavailable++; break;
    }
  }

  const totalFields = allFields.length;
  const available = totalFields - unavailable;
  const overallConfidence = available > 0
    ? Math.round((verified * 100 + singleSource * 50) / available)
    : 0;

  card.summary = { totalFields, verifiedCount: verified, conflictCount: conflict, singleSourceCount: singleSource, unavailableCount: unavailable, overallConfidence, conflicts };

  return card;
}

// =============================================================================
// HELPERS
// =============================================================================

function collectAllFields(card: PropertyReportCard): Array<{ field: ReportCardField<any>; section: string }> {
  const result: Array<{ field: ReportCardField<any>; section: string }> = [];
  const sections: Array<[string, Record<string, ReportCardField<any>>]> = [
    ['basics', card.basics],
    ['construction', card.construction],
    ['owner', card.owner],
    ['valuation', card.valuation],
    ['risk', card.risk],
    ['aerial', card.aerial],
    ['market', card.market],
    ['parcel', card.parcel],
  ];

  for (const [section, fields] of sections) {
    for (const key of Object.keys(fields)) {
      result.push({ field: (fields as any)[key], section });
    }
  }
  return result;
}
