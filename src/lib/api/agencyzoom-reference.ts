/**
 * AgencyZoom Reference Data Cache
 * ================================
 * Caches carriers, product lines, and other reference data.
 * Provides fuzzy matching helpers for quote extraction.
 */

import {
  getAgencyZoomClient,
  AgencyZoomCarrier,
  AgencyZoomProductLine,
  AgencyZoomProductCategory,
  AgencyZoomLeadSource,
  AgencyZoomCSR,
  AgencyZoomEmployee,
} from './agencyzoom';

// ============================================================================
// TYPES
// ============================================================================

interface ReferenceDataCache {
  carriers: AgencyZoomCarrier[];
  productLines: AgencyZoomProductLine[];
  productCategories: AgencyZoomProductCategory[];
  leadSources: AgencyZoomLeadSource[];
  csrs: AgencyZoomCSR[];
  employees: AgencyZoomEmployee[];
  lastFetched: Date | null;
}

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

// ============================================================================
// CACHE STATE
// ============================================================================

let cache: ReferenceDataCache = {
  carriers: [],
  productLines: [],
  productCategories: [],
  leadSources: [],
  csrs: [],
  employees: [],
  lastFetched: null,
};

let fetchPromise: Promise<void> | null = null;

// ============================================================================
// QUOTE TYPE TO PRODUCT LINE MAPPING
// ============================================================================

/**
 * Maps extracted quote types to AgencyZoom product line names/IDs
 * Key: quote type from extraction (lowercase)
 * Value: array of possible product line name patterns (in priority order)
 */
const QUOTE_TYPE_TO_PRODUCT_LINE: Record<string, string[]> = {
  // Auto
  'auto': ['Auto', 'Standard Auto', 'Personal Auto'],
  'standard_auto': ['Standard Auto', 'Auto', 'Personal Auto'],
  'personal_auto': ['Personal Auto', 'Standard Auto', 'Auto'],

  // Home/Property
  'home': ['Home', 'Homeowners', 'HO3'],
  'homeowners': ['Homeowners', 'Home', 'HO3'],
  'ho3': ['HO3', 'Homeowners', 'Home'],
  'condo': ['Condo', 'HO6', 'Condominium'],
  'ho6': ['HO6', 'Condo', 'Condominium'],
  'renters': ['Renters', 'HO4', 'Renter'],
  'ho4': ['HO4', 'Renters', 'Renter'],
  'dwelling': ['Dwelling', 'DP3', 'Dwelling Fire'],
  'dp3': ['DP3', 'Dwelling', 'Dwelling Fire'],
  'mobile_home': ['Mobile Home', 'Manufactured Home', 'MH'],
  'manufactured_home': ['Manufactured Home', 'Mobile Home', 'MH'],

  // Specialty
  'umbrella': ['Umbrella', 'Personal Umbrella', 'Excess Liability'],
  'flood': ['Flood', 'Flood Insurance', 'NFIP'],
  'earthquake': ['Earthquake', 'EQ'],
  'boat': ['Boat', 'Watercraft', 'Marine'],
  'watercraft': ['Watercraft', 'Boat', 'Marine'],
  'rv': ['RV', 'Recreational Vehicle', 'Motor Home'],
  'recreational_vehicle': ['Recreational Vehicle', 'RV', 'Motor Home'],
  'motorcycle': ['Motorcycle', 'Cycle', 'MC'],
  'atv': ['ATV', 'All-Terrain Vehicle', 'Off-Road'],
  'golf_cart': ['Golf Cart', 'LSV'],

  // Commercial
  'commercial_auto': ['Commercial Auto', 'Business Auto', 'CA'],
  'business_auto': ['Business Auto', 'Commercial Auto', 'CA'],
  'general_liability': ['General Liability', 'GL', 'CGL'],
  'gl': ['GL', 'General Liability', 'CGL'],
  'bop': ['BOP', 'Business Owner Policy', 'Business Package'],
  'business_owner_policy': ['Business Owner Policy', 'BOP', 'Business Package'],
  'workers_comp': ['Workers Comp', 'Workers Compensation', 'WC'],
  'workers_compensation': ['Workers Compensation', 'Workers Comp', 'WC'],
  'professional_liability': ['Professional Liability', 'E&O', 'Errors and Omissions'],
  'errors_omissions': ['E&O', 'Errors and Omissions', 'Professional Liability'],
  'commercial_property': ['Commercial Property', 'CP', 'Business Property'],
  'commercial_umbrella': ['Commercial Umbrella', 'CUL', 'Business Umbrella'],

  // Life & Health (if applicable)
  'life': ['Life', 'Term Life', 'Whole Life'],
  'health': ['Health', 'Medical', 'Health Insurance'],
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Check if cache is stale and needs refresh
 */
function isCacheStale(): boolean {
  if (!cache.lastFetched) return true;
  return Date.now() - cache.lastFetched.getTime() > CACHE_TTL_MS;
}

/**
 * Fetch all reference data from AgencyZoom
 */
async function fetchReferenceData(): Promise<void> {
  // Prevent concurrent fetches
  if (fetchPromise) {
    await fetchPromise;
    return;
  }

  fetchPromise = (async () => {
    const client = getAgencyZoomClient();

    console.log('[AgencyZoom Reference] Fetching reference data...');

    try {
      // Fetch all reference data in parallel
      const [
        carriers,
        productLines,
        productCategories,
        leadSources,
        csrs,
        employees,
      ] = await Promise.all([
        client.getCarriers().catch(e => { console.warn('[AZ Ref] Failed to fetch carriers:', e.message); return []; }),
        client.getProductLines().catch(e => { console.warn('[AZ Ref] Failed to fetch product lines:', e.message); return []; }),
        client.getProductCategories().catch(e => { console.warn('[AZ Ref] Failed to fetch product categories:', e.message); return []; }),
        client.getLeadSources().catch(e => { console.warn('[AZ Ref] Failed to fetch lead sources:', e.message); return []; }),
        client.getCSRs().catch(e => { console.warn('[AZ Ref] Failed to fetch CSRs:', e.message); return []; }),
        client.getEmployees().catch(e => { console.warn('[AZ Ref] Failed to fetch employees:', e.message); return []; }),
      ]);

      cache = {
        carriers,
        productLines,
        productCategories,
        leadSources,
        csrs,
        employees,
        lastFetched: new Date(),
      };

      console.log('[AgencyZoom Reference] Cache populated:', {
        carriers: carriers.length,
        productLines: productLines.length,
        productCategories: productCategories.length,
        leadSources: leadSources.length,
        csrs: csrs.length,
        employees: employees.length,
      });
    } catch (error) {
      console.error('[AgencyZoom Reference] Failed to fetch reference data:', error);
      throw error;
    }
  })();

  try {
    await fetchPromise;
  } finally {
    fetchPromise = null;
  }
}

/**
 * Ensure cache is populated
 */
async function ensureCache(): Promise<void> {
  if (isCacheStale()) {
    await fetchReferenceData();
  }
}

// ============================================================================
// PUBLIC GETTERS
// ============================================================================

export async function getCarriers(): Promise<AgencyZoomCarrier[]> {
  await ensureCache();
  return cache.carriers;
}

export async function getProductLines(): Promise<AgencyZoomProductLine[]> {
  await ensureCache();
  return cache.productLines;
}

export async function getProductCategories(): Promise<AgencyZoomProductCategory[]> {
  await ensureCache();
  return cache.productCategories;
}

export async function getLeadSources(): Promise<AgencyZoomLeadSource[]> {
  await ensureCache();
  return cache.leadSources;
}

export async function getCSRs(): Promise<AgencyZoomCSR[]> {
  await ensureCache();
  return cache.csrs;
}

export async function getEmployees(): Promise<AgencyZoomEmployee[]> {
  await ensureCache();
  return cache.employees;
}

/**
 * Force refresh the cache
 */
export async function refreshCache(): Promise<void> {
  cache.lastFetched = null;
  await fetchReferenceData();
}

// ============================================================================
// FUZZY MATCHING HELPERS
// ============================================================================

/**
 * Normalize a string for comparison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters
    .trim();
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses a simple approach: longest common substring ratio
 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;
  if (!na || !nb) return 0;

  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) {
    return 0.9;
  }

  // Check word overlap
  const wordsA = a.toLowerCase().split(/\s+/);
  const wordsB = b.toLowerCase().split(/\s+/);
  const commonWords = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));

  if (commonWords.length > 0) {
    return 0.5 + (0.4 * commonWords.length / Math.max(wordsA.length, wordsB.length));
  }

  return 0;
}

/**
 * Find best matching carrier by name
 * Returns the carrier with highest similarity score above threshold
 */
export async function findCarrierByName(name: string): Promise<AgencyZoomCarrier | null> {
  await ensureCache();

  if (!name) return null;

  const normalizedName = normalize(name);
  let bestMatch: AgencyZoomCarrier | null = null;
  let bestScore = 0;

  for (const carrier of cache.carriers) {
    const score = similarity(name, carrier.name);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = carrier;
    }

    // Also check against standardCarrierCode if present
    if (carrier.standardCarrierCode) {
      const codeScore = similarity(name, carrier.standardCarrierCode);
      if (codeScore > bestScore && codeScore >= 0.5) {
        bestScore = codeScore;
        bestMatch = carrier;
      }
    }
  }

  if (bestMatch) {
    console.log(`[AZ Ref] Matched carrier "${name}" -> "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
  } else {
    console.warn(`[AZ Ref] No carrier match found for "${name}"`);
  }

  return bestMatch;
}

/**
 * Find product line by quote type
 * Uses the mapping table and fuzzy matching
 */
export async function findProductLineByQuoteType(quoteType: string): Promise<AgencyZoomProductLine | null> {
  await ensureCache();

  if (!quoteType) return null;

  const normalizedType = quoteType.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // First, check our mapping table
  const mappedNames = QUOTE_TYPE_TO_PRODUCT_LINE[normalizedType];

  if (mappedNames) {
    // Try each mapped name in priority order
    for (const targetName of mappedNames) {
      const found = cache.productLines.find(pl =>
        normalize(pl.name) === normalize(targetName)
      );
      if (found) {
        console.log(`[AZ Ref] Mapped quote type "${quoteType}" -> product line "${found.name}" (id: ${found.id})`);
        return found;
      }
    }

    // If exact matches failed, try fuzzy matching against mapped names
    for (const targetName of mappedNames) {
      for (const pl of cache.productLines) {
        if (similarity(targetName, pl.name) >= 0.7) {
          console.log(`[AZ Ref] Fuzzy matched quote type "${quoteType}" -> product line "${pl.name}" (id: ${pl.id})`);
          return pl;
        }
      }
    }
  }

  // Fallback: direct fuzzy match against all product lines
  let bestMatch: AgencyZoomProductLine | null = null;
  let bestScore = 0;

  for (const pl of cache.productLines) {
    const score = similarity(quoteType, pl.name);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = pl;
    }
  }

  if (bestMatch) {
    console.log(`[AZ Ref] Fuzzy matched quote type "${quoteType}" -> product line "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
  } else {
    console.warn(`[AZ Ref] No product line match found for quote type "${quoteType}"`);
  }

  return bestMatch;
}

/**
 * Find lead source by name
 */
export async function findLeadSourceByName(name: string): Promise<AgencyZoomLeadSource | null> {
  await ensureCache();

  if (!name) return null;

  // Exact match first
  const exact = cache.leadSources.find(ls =>
    normalize(ls.name) === normalize(name)
  );
  if (exact) return exact;

  // Fuzzy match
  let bestMatch: AgencyZoomLeadSource | null = null;
  let bestScore = 0;

  for (const ls of cache.leadSources) {
    const score = similarity(name, ls.name);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = ls;
    }
  }

  return bestMatch;
}

/**
 * Find employee by name
 */
export async function findEmployeeByName(name: string): Promise<AgencyZoomEmployee | null> {
  await ensureCache();

  if (!name) return null;

  const normalizedName = normalize(name);

  for (const emp of cache.employees) {
    const fullName = normalize(`${emp.firstname} ${emp.lastname}`);
    if (fullName.includes(normalizedName) || normalizedName.includes(fullName)) {
      return emp;
    }
  }

  return null;
}

// ============================================================================
// KNOWN IDS (Your Agency's Specific IDs)
// ============================================================================

export const KNOWN_IDS = {
  // Lead Sources
  leadSources: {
    AI_AGENT: 9021878,
    CALL_IN: 8913413,
    LARA: 9279826,
    QUOTE_EXTRACTOR: 9021878, // Use AI Agent for quote extractor
  },

  // Common Carriers
  carriers: {
    NATIONWIDE: 137,
    ALLSTATE: 1,
    STEADILY: 1390058,
    ASSURANCE_AMERICA: 241,
    BERKSHIRE_HATHAWAY_GUARD: 184,
  },

  // Common Product Lines
  productLines: {
    STANDARD_AUTO: 1,
    AUTO: 381861,
    HOME: 21,
    CONDO: 20,
    RENTERS: 24,
    COMMERCIAL_AUTO: 5,
    COMMERCIAL_BOP: 6,
    FLOOD: 18,
  },

  // Employees (Producers)
  employees: {
    TODD_CONN: 94004,
    MONTRICE_LEMASTER: 94005,
    BLAIR_LEE: 94006,
    LEE_TIDWELL: 94007,
    ANGIE_SOUSA: 94008,
    AI_AGENT: 114877,
  },

  // Pipelines
  pipelines: {
    NEW_LEADS: 87550,
  },

  // Stages
  stages: {
    NEW_LEAD_DATA_ENTRY: 386245,
  },

  // Loss Reasons
  lossReasons: {
    PREMIUM_TOO_HIGH: 28278,
    NOT_INTERESTED: 28279,
    LOST_TO_COMPETITOR: 28280,
    OTHER: 28328,
  },
};

// ============================================================================
// QUOTE TYPE VALIDATION
// ============================================================================

export const VALID_QUOTE_TYPES = [
  'auto',
  'home',
  'renters',
  'condo',
  'umbrella',
  'flood',
  'boat',
  'rv',
  'motorcycle',
  'mobile_home',
  'commercial_auto',
  'general_liability',
  'bop',
  'workers_comp',
  'professional_liability',
  'commercial_property',
  'life',
  'health',
  'other',
] as const;

export type ValidQuoteType = typeof VALID_QUOTE_TYPES[number];

/**
 * Validate and normalize a quote type string
 */
export function normalizeQuoteType(quoteType: string | null): ValidQuoteType | null {
  if (!quoteType) return null;

  const normalized = quoteType.toLowerCase().replace(/[^a-z0-9]/g, '_');

  if (VALID_QUOTE_TYPES.includes(normalized as ValidQuoteType)) {
    return normalized as ValidQuoteType;
  }

  // Try to map common variations
  const variations: Record<string, ValidQuoteType> = {
    'homeowners': 'home',
    'ho3': 'home',
    'ho4': 'renters',
    'ho6': 'condo',
    'dp3': 'home',
    'personal_auto': 'auto',
    'standard_auto': 'auto',
    'watercraft': 'boat',
    'recreational_vehicle': 'rv',
    'manufactured_home': 'mobile_home',
    'business_auto': 'commercial_auto',
    'gl': 'general_liability',
    'cgl': 'general_liability',
    'business_owner_policy': 'bop',
    'workers_compensation': 'workers_comp',
    'wc': 'workers_comp',
    'e_o': 'professional_liability',
    'errors_omissions': 'professional_liability',
  };

  return variations[normalized] || null;
}
