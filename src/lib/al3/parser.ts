/**
 * AL3 Parser
 * ==========
 * Parses ACORD AL3 flat files into structured transaction data.
 * Three-tier strategy:
 *   1. Regex extraction for common fields
 *   2. Position-based for AL3 standard fields
 *   3. Carrier-specific overrides from carrierProfiles
 */

import type {
  AL3ParsedTransaction,
  AL3TransactionHeader,
  AL3Coverage,
  AL3Vehicle,
  AL3Driver,
  AL3Location,
  AL3Discount,
  AL3Claim,
  AL3Endorsement,
} from '@/types/renewal.types';
import {
  AL3_GROUP_CODES,
  TRG_FIELDS,
  CVG_FIELDS,
  VEH_FIELDS,
  DRV_FIELDS,
  DSC_FIELDS,
  CLM_FIELDS,
  END_FIELDS,
  LOB_CODES,
} from './constants';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse an AL3 date string (YYYYMMDD) to ISO string.
 */
export function parseAL3Date(dateStr: string): string | undefined {
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed.length < 8 || trimmed === '00000000') return undefined;

  const year = trimmed.substring(0, 4);
  const month = trimmed.substring(4, 6);
  const day = trimmed.substring(6, 8);

  const parsed = new Date(`${year}-${month}-${day}`);
  if (isNaN(parsed.getTime())) return undefined;

  return `${year}-${month}-${day}`;
}

/**
 * Parse an AL3 numeric field, trimming whitespace and removing non-numeric chars.
 */
export function parseAL3Number(str: string): number | undefined {
  const trimmed = str.trim().replace(/[^0-9.-]/g, '');
  if (!trimmed) return undefined;
  const num = parseFloat(trimmed);
  return isNaN(num) ? undefined : num;
}

/**
 * Extract a fixed-width field from a line.
 */
function extractField(line: string, pos: { start: number; end: number }): string {
  return (line.substring(pos.start, pos.end) || '').trim();
}

/**
 * Identify the group code of an AL3 record line.
 */
function getGroupCode(line: string): string {
  return line.substring(0, 4);
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Parse an entire AL3 file into parsed transactions.
 * Splits by transaction boundaries (2TRG...3MTG) and parses each.
 */
export function parseAL3File(content: string): AL3ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter((l) => l.length >= 4);
  const transactions: AL3ParsedTransaction[] = [];

  let currentLines: string[] = [];
  let inTransaction = false;

  for (const line of lines) {
    const groupCode = getGroupCode(line);

    if (groupCode === AL3_GROUP_CODES.TRANSACTION_HEADER) {
      // Start a new transaction
      if (inTransaction && currentLines.length > 0) {
        // Close previous (missing trailer)
        const parsed = parseTransaction(currentLines);
        if (parsed) transactions.push(parsed);
      }
      currentLines = [line];
      inTransaction = true;
    } else if (groupCode === AL3_GROUP_CODES.MASTER_TRAILER) {
      if (inTransaction) {
        currentLines.push(line);
        const parsed = parseTransaction(currentLines);
        if (parsed) transactions.push(parsed);
        currentLines = [];
        inTransaction = false;
      }
    } else if (inTransaction) {
      currentLines.push(line);
    }
    // Lines outside transactions (1MHG headers, etc.) are skipped
  }

  // Handle unclosed transaction
  if (inTransaction && currentLines.length > 0) {
    const parsed = parseTransaction(currentLines);
    if (parsed) transactions.push(parsed);
  }

  return transactions;
}

/**
 * Parse a single transaction (group of lines between 2TRG and 3MTG).
 */
function parseTransaction(lines: string[]): AL3ParsedTransaction | null {
  if (lines.length === 0) return null;

  const headerLine = lines.find((l) => getGroupCode(l) === AL3_GROUP_CODES.TRANSACTION_HEADER);
  if (!headerLine) return null;

  const header = parseTransactionHeader(headerLine);
  const coverages: AL3Coverage[] = [];
  const vehicles: AL3Vehicle[] = [];
  const drivers: AL3Driver[] = [];
  const locations: AL3Location[] = [];
  const remarks: string[] = [];
  const claims: AL3Claim[] = [];
  const endorsementRecords: AL3Endorsement[] = [];
  const discountRecords: AL3Discount[] = [];

  let currentVehicle: AL3Vehicle | null = null;
  let confidence = 0.7; // Base confidence

  for (const line of lines) {
    const groupCode = getGroupCode(line);

    switch (groupCode) {
      case AL3_GROUP_CODES.COVERAGE: {
        const cov = parseCoverage(line);
        if (cov) {
          if (currentVehicle) {
            currentVehicle.coverages.push(cov);
          } else {
            coverages.push(cov);
          }
        }
        break;
      }

      case AL3_GROUP_CODES.VEHICLE: {
        // Save previous vehicle
        if (currentVehicle) vehicles.push(currentVehicle);
        currentVehicle = parseVehicle(line);
        break;
      }

      case AL3_GROUP_CODES.DRIVER: {
        const drv = parseDriver(line);
        if (drv) drivers.push(drv);
        break;
      }

      case AL3_GROUP_CODES.LOCATION: {
        const loc = parseLocation(line);
        if (loc) locations.push(loc);
        break;
      }

      case AL3_GROUP_CODES.REMARK: {
        const remark = line.substring(4).trim();
        if (remark) remarks.push(remark);
        break;
      }

      case AL3_GROUP_CODES.DISCOUNT: {
        const disc = parseDiscount(line);
        if (disc) discountRecords.push(disc);
        break;
      }

      case AL3_GROUP_CODES.CLAIM: {
        const clm = parseClaim(line);
        if (clm) claims.push(clm);
        break;
      }

      case AL3_GROUP_CODES.ENDORSEMENT: {
        const end = parseEndorsement(line);
        if (end) endorsementRecords.push(end);
        break;
      }

      case AL3_GROUP_CODES.PREMIUM: {
        // Try to extract total premium from premium record
        const premiumStr = line.substring(4).trim();
        const premium = parseAL3Number(premiumStr);
        if (premium && !header.policyNumber) {
          // Fallback premium extraction
        }
        break;
      }
    }
  }

  // Save last vehicle
  if (currentVehicle) vehicles.push(currentVehicle);

  // Adjust confidence based on data completeness
  if (header.policyNumber && header.transactionType) confidence += 0.1;
  if (coverages.length > 0 || vehicles.length > 0) confidence += 0.1;
  if (header.effectiveDate) confidence += 0.05;
  confidence = Math.min(confidence, 1.0);

  return {
    header,
    coverages,
    vehicles,
    drivers,
    locations,
    remarks,
    claims,
    endorsementRecords,
    discountRecords,
    rawContent: lines.join('\n'),
    parseConfidence: confidence,
  };
}

/**
 * Parse a transaction header line (2TRG).
 */
function parseTransactionHeader(line: string): AL3TransactionHeader {
  // Try position-based extraction first
  const transactionType = extractField(line, TRG_FIELDS.TRANSACTION_TYPE);
  const carrierCode = extractField(line, TRG_FIELDS.COMPANY_CODE);
  const policyNumber = extractField(line, TRG_FIELDS.POLICY_NUMBER);
  const effectiveDateRaw = extractField(line, TRG_FIELDS.EFFECTIVE_DATE);
  const expirationDateRaw = extractField(line, TRG_FIELDS.EXPIRATION_DATE);
  const lobCode = extractField(line, TRG_FIELDS.LOB_CODE);
  const insuredName = extractField(line, TRG_FIELDS.INSURED_NAME);

  const header: AL3TransactionHeader = {
    transactionType: transactionType || 'UNKNOWN',
    policyNumber: policyNumber || '',
    carrierCode: carrierCode || '',
    lineOfBusiness: LOB_CODES[lobCode] || lobCode || undefined,
    effectiveDate: parseAL3Date(effectiveDateRaw),
    expirationDate: parseAL3Date(expirationDateRaw),
    insuredName: insuredName || undefined,
  };

  // Fallback: regex extraction for common patterns
  if (!header.policyNumber) {
    const policyMatch = line.match(/(?:POL|POLICY)[#:\s]*([A-Z0-9-]+)/i);
    if (policyMatch) header.policyNumber = policyMatch[1];
  }

  return header;
}

/**
 * Parse a coverage record (5CVG).
 */
function parseCoverage(line: string): AL3Coverage | null {
  const code = extractField(line, CVG_FIELDS.COVERAGE_CODE);
  if (!code) return null;

  return {
    code,
    description: extractField(line, CVG_FIELDS.DESCRIPTION) || undefined,
    limit: extractField(line, CVG_FIELDS.LIMIT) || undefined,
    limitAmount: parseAL3Number(extractField(line, CVG_FIELDS.LIMIT)),
    deductible: extractField(line, CVG_FIELDS.DEDUCTIBLE) || undefined,
    deductibleAmount: parseAL3Number(extractField(line, CVG_FIELDS.DEDUCTIBLE)),
    premium: parseAL3Number(extractField(line, CVG_FIELDS.PREMIUM)),
  };
}

/**
 * Parse a vehicle record (5VEH).
 */
function parseVehicle(line: string): AL3Vehicle {
  return {
    vin: extractField(line, VEH_FIELDS.VIN) || undefined,
    year: parseAL3Number(extractField(line, VEH_FIELDS.YEAR)) as number | undefined,
    make: extractField(line, VEH_FIELDS.MAKE) || undefined,
    model: extractField(line, VEH_FIELDS.MODEL) || undefined,
    usage: extractField(line, VEH_FIELDS.USAGE) || undefined,
    coverages: [],
  };
}

/**
 * Parse a driver record (5DRV).
 */
function parseDriver(line: string): AL3Driver | null {
  const name = extractField(line, DRV_FIELDS.NAME);
  if (!name) return null;

  return {
    name,
    dateOfBirth: parseAL3Date(extractField(line, DRV_FIELDS.DOB)),
    licenseNumber: extractField(line, DRV_FIELDS.LICENSE_NUMBER) || undefined,
    licenseState: extractField(line, DRV_FIELDS.LICENSE_STATE) || undefined,
    relationship: extractField(line, DRV_FIELDS.RELATIONSHIP) || undefined,
  };
}

/**
 * Parse a location record (5LOC).
 */
function parseLocation(line: string): AL3Location | null {
  const content = line.substring(4).trim();
  if (!content) return null;

  // Location records vary significantly - attempt basic extraction
  return {
    address: content.substring(0, 60).trim() || undefined,
    city: content.substring(60, 90).trim() || undefined,
    state: content.substring(90, 92).trim() || undefined,
    zip: content.substring(92, 102).trim() || undefined,
  };
}

/**
 * Parse a discount record (5DSC).
 */
function parseDiscount(line: string): AL3Discount | null {
  const code = extractField(line, DSC_FIELDS.DISCOUNT_CODE);
  if (!code) return null;

  return {
    code,
    description: extractField(line, DSC_FIELDS.DESCRIPTION) || undefined,
    amount: parseAL3Number(extractField(line, DSC_FIELDS.AMOUNT)),
    percent: parseAL3Number(extractField(line, DSC_FIELDS.PERCENT)),
  };
}

/**
 * Parse a claim record (5CLM).
 */
function parseClaim(line: string): AL3Claim | null {
  const claimNumber = extractField(line, CLM_FIELDS.CLAIM_NUMBER);
  const claimType = extractField(line, CLM_FIELDS.CLAIM_TYPE);
  if (!claimNumber && !claimType) return null;

  return {
    claimNumber: claimNumber || undefined,
    claimDate: parseAL3Date(extractField(line, CLM_FIELDS.CLAIM_DATE)),
    claimType: claimType || undefined,
    amount: parseAL3Number(extractField(line, CLM_FIELDS.AMOUNT)),
    status: extractField(line, CLM_FIELDS.STATUS) || undefined,
  };
}

/**
 * Parse an endorsement record (5END).
 */
function parseEndorsement(line: string): AL3Endorsement | null {
  const code = extractField(line, END_FIELDS.ENDORSEMENT_CODE);
  if (!code) return null;

  return {
    code,
    description: extractField(line, END_FIELDS.DESCRIPTION) || undefined,
    effectiveDate: parseAL3Date(extractField(line, END_FIELDS.EFFECTIVE_DATE)),
    premium: parseAL3Number(extractField(line, END_FIELDS.PREMIUM)),
  };
}
