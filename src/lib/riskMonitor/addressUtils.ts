// Address Normalization Utilities for Risk Monitor
// Provides consistent address formatting for comparison and matching

/**
 * Common street type abbreviations
 */
const STREET_TYPE_MAP: Record<string, string> = {
  // Standard abbreviations
  street: "ST",
  st: "ST",
  avenue: "AVE",
  ave: "AVE",
  boulevard: "BLVD",
  blvd: "BLVD",
  drive: "DR",
  dr: "DR",
  road: "RD",
  rd: "RD",
  lane: "LN",
  ln: "LN",
  court: "CT",
  ct: "CT",
  circle: "CIR",
  cir: "CIR",
  place: "PL",
  pl: "PL",
  terrace: "TER",
  ter: "TER",
  trail: "TRL",
  trl: "TRL",
  way: "WAY",
  highway: "HWY",
  hwy: "HWY",
  parkway: "PKWY",
  pkwy: "PKWY",
  expressway: "EXPY",
  expy: "EXPY",
  freeway: "FWY",
  fwy: "FWY",
  pike: "PIKE",
  pass: "PASS",
  path: "PATH",
  crossing: "XING",
  xing: "XING",
  run: "RUN",
  ridge: "RDG",
  rdg: "RDG",
  hill: "HL",
  hl: "HL",
  point: "PT",
  pt: "PT",
  cove: "CV",
  cv: "CV",
  bay: "BAY",
  loop: "LOOP",
  alley: "ALY",
  aly: "ALY",
  square: "SQ",
  sq: "SQ",
};

/**
 * Directional abbreviations
 */
const DIRECTIONAL_MAP: Record<string, string> = {
  north: "N",
  n: "N",
  south: "S",
  s: "S",
  east: "E",
  e: "E",
  west: "W",
  w: "W",
  northeast: "NE",
  ne: "NE",
  northwest: "NW",
  nw: "NW",
  southeast: "SE",
  se: "SE",
  southwest: "SW",
  sw: "SW",
};

/**
 * Unit type abbreviations
 */
const UNIT_TYPE_MAP: Record<string, string> = {
  apartment: "APT",
  apt: "APT",
  suite: "STE",
  ste: "STE",
  unit: "UNIT",
  building: "BLDG",
  bldg: "BLDG",
  floor: "FL",
  fl: "FL",
  room: "RM",
  rm: "RM",
  number: "#",
  no: "#",
  "#": "#",
};

/**
 * State name to abbreviation mapping
 */
const STATE_MAP: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

export interface NormalizedAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
  normalizedKey: string; // Lowercase key for comparison
}

export interface ParsedAddressComponents {
  streetNumber: string;
  preDirectional: string | null;
  streetName: string;
  streetType: string | null;
  postDirectional: string | null;
  unitType: string | null;
  unitNumber: string | null;
}

/**
 * Normalize a street type to its standard abbreviation
 */
function normalizeStreetType(streetType: string): string {
  const lower = streetType.toLowerCase().replace(/\./g, "");
  return STREET_TYPE_MAP[lower] || streetType.toUpperCase();
}

/**
 * Normalize a directional to its standard abbreviation
 */
function normalizeDirectional(dir: string): string {
  const lower = dir.toLowerCase().replace(/\./g, "");
  return DIRECTIONAL_MAP[lower] || dir.toUpperCase();
}

/**
 * Normalize a unit type to its standard abbreviation
 */
function normalizeUnitType(unitType: string): string {
  const lower = unitType.toLowerCase().replace(/\./g, "");
  return UNIT_TYPE_MAP[lower] || unitType.toUpperCase();
}

/**
 * Normalize a state to its two-letter abbreviation
 */
function normalizeState(state: string): string {
  const lower = state.toLowerCase().trim();

  // Already a two-letter code
  if (/^[a-z]{2}$/i.test(lower)) {
    return lower.toUpperCase();
  }

  return STATE_MAP[lower] || state.toUpperCase();
}

/**
 * Clean and normalize a zip code
 */
function normalizeZipCode(zip: string): string {
  // Remove all non-numeric characters except hyphen
  const cleaned = zip.replace(/[^\d-]/g, "");

  // Handle ZIP+4 format
  if (cleaned.includes("-")) {
    return cleaned.split("-")[0]; // Return just the 5-digit portion
  }

  // Return first 5 digits
  return cleaned.substring(0, 5);
}

/**
 * Normalize city name
 */
function normalizeCity(city: string): string {
  return city
    .trim()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/[^\w\s-]/g, "") // Remove special chars except hyphens
    .toUpperCase();
}

/**
 * Parse and normalize an address line (street address)
 */
function normalizeAddressLine(line: string): string {
  if (!line) return "";

  let normalized = line
    .trim()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/[^\w\s#.-]/g, "") // Keep alphanumeric, spaces, #, dots, hyphens
    .replace(/\./g, " ") // Replace dots with spaces
    .replace(/\s+/g, " ") // Collapse spaces again
    .trim();

  // Split into words and normalize each
  const words = normalized.split(" ");
  const normalizedWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lowerWord = word.toLowerCase();

    // Check if it's a directional
    if (DIRECTIONAL_MAP[lowerWord]) {
      normalizedWords.push(normalizeDirectional(word));
      continue;
    }

    // Check if it's a street type
    if (STREET_TYPE_MAP[lowerWord]) {
      normalizedWords.push(normalizeStreetType(word));
      continue;
    }

    // Check if it's a unit type
    if (UNIT_TYPE_MAP[lowerWord]) {
      normalizedWords.push(normalizeUnitType(word));
      continue;
    }

    // Keep as-is (uppercase)
    normalizedWords.push(word.toUpperCase());
  }

  return normalizedWords.join(" ");
}

/**
 * Normalize a full address into a standardized format
 */
export function normalizeAddress(
  line1: string,
  line2: string | null | undefined,
  city: string,
  state: string,
  zipCode: string
): NormalizedAddress {
  const normalizedLine1 = normalizeAddressLine(line1);
  const normalizedLine2 = line2 ? normalizeAddressLine(line2) : null;
  const normalizedCity = normalizeCity(city);
  const normalizedState = normalizeState(state);
  const normalizedZip = normalizeZipCode(zipCode);

  // Build full address
  const addressParts = [normalizedLine1];
  if (normalizedLine2) {
    addressParts.push(normalizedLine2);
  }
  addressParts.push(`${normalizedCity}, ${normalizedState} ${normalizedZip}`);
  const fullAddress = addressParts.join(", ");

  // Build normalized key for comparison (lowercase, no special chars)
  const keyParts = [
    normalizedLine1,
    normalizedLine2,
    normalizedCity,
    normalizedState,
    normalizedZip,
  ].filter(Boolean);
  const normalizedKey = keyParts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return {
    line1: normalizedLine1,
    line2: normalizedLine2,
    city: normalizedCity,
    state: normalizedState,
    zipCode: normalizedZip,
    fullAddress,
    normalizedKey,
  };
}

/**
 * Parse a full address string into components
 */
export function parseFullAddress(fullAddress: string): NormalizedAddress | null {
  if (!fullAddress) return null;

  // Try to parse common formats:
  // "123 Main St, City, ST 12345"
  // "123 Main St, Apt 4, City, ST 12345"

  const parts = fullAddress.split(",").map((p) => p.trim());

  if (parts.length < 2) return null;

  // Last part should contain state and zip
  const lastPart = parts[parts.length - 1];
  const stateZipMatch = lastPart.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  if (!stateZipMatch) {
    // Try alternative format where city and state/zip are together
    const altMatch = lastPart.match(/^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (altMatch) {
      const city = altMatch[1];
      const state = altMatch[2];
      const zip = altMatch[3];
      const line1 = parts[0];
      const line2 = parts.length > 2 ? parts.slice(1, -1).join(", ") : null;

      return normalizeAddress(line1, line2, city, state, zip);
    }
    return null;
  }

  const state = stateZipMatch[1];
  const zip = stateZipMatch[2];

  // Second to last part should be city
  if (parts.length < 3) return null;
  const city = parts[parts.length - 2];

  // First part is line1, anything in between is line2
  const line1 = parts[0];
  const line2 = parts.length > 3 ? parts.slice(1, -2).join(", ") : null;

  return normalizeAddress(line1, line2, city, state, zip);
}

/**
 * Compare two addresses for equality (ignoring formatting differences)
 */
export function addressesMatch(
  addr1: NormalizedAddress | null,
  addr2: NormalizedAddress | null
): boolean {
  if (!addr1 || !addr2) return false;
  return addr1.normalizedKey === addr2.normalizedKey;
}

/**
 * Calculate similarity score between two addresses (0.0 - 1.0)
 * Useful for fuzzy matching when exact match fails
 */
export function addressSimilarity(
  addr1: NormalizedAddress | null,
  addr2: NormalizedAddress | null
): number {
  if (!addr1 || !addr2) return 0;

  // Exact match
  if (addr1.normalizedKey === addr2.normalizedKey) return 1.0;

  let score = 0;
  let maxScore = 0;

  // State match (required for any similarity)
  if (addr1.state !== addr2.state) return 0;

  // Zip code match (high weight)
  maxScore += 0.3;
  if (addr1.zipCode === addr2.zipCode) {
    score += 0.3;
  } else if (addr1.zipCode.substring(0, 3) === addr2.zipCode.substring(0, 3)) {
    // Same zip prefix (regional match)
    score += 0.15;
  }

  // City match
  maxScore += 0.2;
  if (addr1.city === addr2.city) {
    score += 0.2;
  }

  // Street address similarity using Levenshtein-like comparison
  maxScore += 0.5;
  const line1Sim = stringSimilarity(addr1.line1, addr2.line1);
  score += line1Sim * 0.5;

  return score / maxScore;
}

/**
 * Simple string similarity (Dice coefficient)
 */
function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const a = s1.toLowerCase();
  const b = s2.toLowerCase();

  // Create bigrams
  const getBigrams = (s: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Extract street number from address line
 */
export function extractStreetNumber(line1: string): string | null {
  const match = line1.match(/^(\d+)/);
  return match ? match[1] : null;
}

/**
 * Format address for display
 */
export function formatAddressForDisplay(
  addr: NormalizedAddress,
  singleLine: boolean = false
): string {
  if (singleLine) {
    return addr.fullAddress;
  }

  const lines = [addr.line1];
  if (addr.line2) lines.push(addr.line2);
  lines.push(`${addr.city}, ${addr.state} ${addr.zipCode}`);
  return lines.join("\n");
}
