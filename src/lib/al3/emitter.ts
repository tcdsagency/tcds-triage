/**
 * AL3 Emitter
 * ===========
 * Generates ACORD AL3 fixed-width records from canonical policy data.
 * Used for creating AL3-XML files for HawkSoft import.
 *
 * Record structure follows IVANS/ACORD AL3 specification:
 *   - 1MHG: File header
 *   - 2TRG: Transaction header
 *   - 5BIS: Insured name
 *   - 9BIS: Insured address
 *   - 5BPI: Policy info
 *   - 5VEH: Vehicle
 *   - 5DRV: Driver
 *   - 6CVA: Vehicle coverage
 *   - 6CVH: Home coverage
 *   - 5AOI: Mortgagee/lienholder
 *   - 3MTG: File trailer
 */

import type {
  PolicyCreatorDocument,
  CanonicalCoverage,
  CanonicalVehicle,
  CanonicalDriver,
  CanonicalProperty,
  CanonicalMortgagee,
} from '@/types/policy-creator.types';
import {
  validateRecord,
  verifyRoundTrip,
  type ValidationError,
  type CompilerResult,
} from './compiler';

// =============================================================================
// TYPES
// =============================================================================

export interface AL3Record {
  groupCode: string;
  content: string;
  length: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Pad a string to a fixed width with spaces (right-pad).
 */
function padRight(str: string | undefined | null, width: number): string {
  const s = (str ?? '').toString();
  return s.substring(0, width).padEnd(width, ' ');
}

/**
 * Pad a number to a fixed width with zeros (left-pad).
 */
function padZero(num: number | undefined | null, width: number): string {
  const n = Math.max(0, Math.round(num ?? 0));
  return n.toString().padStart(width, '0').substring(0, width);
}

/**
 * Format a date string (YYYY-MM-DD) to AL3 format (YYYYMMDD).
 */
function formatAL3Date(dateStr: string | undefined | null): string {
  if (!dateStr) return '00000000';
  const cleaned = dateStr.replace(/-/g, '');
  return cleaned.padEnd(8, '0').substring(0, 8);
}

/**
 * Format a date string (YYYY-MM-DD) to short AL3 format (YYMMDD).
 */
function formatAL3DateShort(dateStr: string | undefined | null): string {
  if (!dateStr) return '000000';
  const cleaned = dateStr.replace(/-/g, '');
  // Take last 6 chars (YYMMDD) from YYYYMMDD
  if (cleaned.length >= 8) {
    return cleaned.substring(2, 8);
  }
  return cleaned.padEnd(6, '0').substring(0, 6);
}

/**
 * Format a premium amount (dollars) to AL3 format (cents with sign).
 * Example: 1234.56 -> "00000123456+"
 */
function formatAL3Premium(amount: number | undefined | null): string {
  const cents = Math.round((amount ?? 0) * 100);
  const sign = cents >= 0 ? '+' : '-';
  return padZero(Math.abs(cents), 11) + sign;
}

/**
 * Format a limit amount to 8-digit zero-padded string.
 */
function formatAL3Limit(amount: number | undefined | null): string {
  return padZero(amount, 8);
}

/**
 * Map line of business to AL3 LOB code.
 */
function getLOBCode(lob: string | undefined): string {
  const lobMap: Record<string, string> = {
    'Personal Auto': 'PAUTO',
    'Homeowners': 'PHOME',
    'Dwelling Fire': 'PFIRE',
    'Renters': 'PRENT',
    'Umbrella': 'PUMBL',
    'Flood': 'PFLOOD',
    'Motorcycle': 'PMOTO',
    'Recreational Vehicle': 'PRVEH',
    'Mobile Home': 'PMOBL',
    'Commercial Auto': 'CAUTO',
    'General Liability': 'CGLOB',
    'BOP': 'CBOP',
    'Commercial Property': 'CPROP',
    'Workers Comp': 'CWC',
    'Professional Liability': 'CPROF',
    'Inland Marine': 'CIMAR',
  };
  return lobMap[lob ?? ''] ?? 'PAUTO';
}

// =============================================================================
// RECORD BUILDERS
// =============================================================================

/**
 * Build 1MHG - Master Header Group (file header).
 * Official AL3.mdb length: 196 bytes
 */
function build1MHG(): AL3Record {
  const length = 196;
  let content = '';

  // 0-3: Group code
  content += '1MHG';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8: Version (7 = AL3 version 7)
  content += '7';
  // 9-28: Sender ID (agency)
  content += padRight('TCDS_AGENCY', 20);
  // 29-48: Receiver ID
  content += padRight('HAWKSOFT', 20);
  // 49-56: Date (YYYYMMDD)
  content += formatAL3Date(new Date().toISOString().substring(0, 10));
  // 57-62: Time (HHMMSS)
  const now = new Date();
  content += padZero(now.getHours(), 2) + padZero(now.getMinutes(), 2) + padZero(now.getSeconds(), 2);
  // 63-72: Interchange control number
  content += padZero(Date.now() % 10000000000, 10);
  // Fill rest with spaces
  content = padRight(content, length);

  return { groupCode: '1MHG', content, length };
}

/**
 * Build 2TRG - Transaction Header Group.
 * Standard length: 212 bytes
 */
function build2TRG(doc: PolicyCreatorDocument): AL3Record {
  const length = 212;
  let content = '';

  // 0-3: Group code
  content += '2TRG';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8: Version
  content += '7';
  // 9-10: Filler
  content += '  ';
  // 11-23: Filler
  content += padRight('', 13);
  // 24-29: LOB code
  content += padRight(getLOBCode(doc.lineOfBusiness), 6);
  // 30-46: Filler
  content += padRight('', 17);
  // 47-79: Company name
  content += padRight(doc.carrier, 33);
  // 80-166: Filler
  content += padRight('', 87);
  // 167-169: Transaction type (NBS=New Business, RWL=Renewal)
  content += padRight(doc.transactionType || 'NBS', 3);
  // 170-195: Filler
  content += padRight('', 26);
  // 196-203: Processing date (YYYYMMDD)
  content += formatAL3Date(new Date().toISOString().substring(0, 10));
  // 204-211: Effective date (YYYYMMDD)
  content += formatAL3Date(doc.effectiveDate);
  // Fill to length
  content = padRight(content, length);

  return { groupCode: '2TRG', content, length };
}

/**
 * Build 5BIS - Basic Insured Segment (name).
 * Standard length: 172 bytes
 */
function build5BIS(doc: PolicyCreatorDocument): AL3Record {
  const length = 172;
  let content = '';

  // 0-3: Group code
  content += '5BIS';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-29: Reference header
  content += padRight('R100015BPIF10001', 22);
  // 30: Entity type (P=Person, C=Company)
  content += doc.insuredEntityType || 'P';
  // 31-38: Prefix (title)
  content += padRight('', 8);
  // 39-66: First name (28 chars)
  content += padRight(doc.insuredFirstName, 28);
  // 67-89: Last name (23 chars)
  content += padRight(doc.insuredLastName || doc.insuredName, 23);
  // 90-91: Suffix
  content += padRight('', 2);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '5BIS', content, length };
}

/**
 * Build 9BIS - Insured Address Continuation.
 * Official AL3.mdb length: 343 bytes
 */
function build9BIS(doc: PolicyCreatorDocument): AL3Record {
  const length = 343;
  let content = '';

  // 0-3: Group code
  content += '9BIS';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-28: Reference header
  content += padRight('R100015BPIF10001', 21);
  // 29-58: Address line 1 (30 chars)
  content += padRight(doc.insuredAddress, 30);
  // 59-78: City (20 chars)
  content += padRight(doc.insuredCity, 20);
  // 79-80: State (2 chars)
  content += padRight(doc.insuredState, 2);
  // 81-90: ZIP (10 chars, includes ZIP+4)
  content += padRight(doc.insuredZip, 10);
  // 91-100: Phone (10 chars)
  content += padRight((doc.insuredPhone ?? '').replace(/\D/g, ''), 10);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '9BIS', content, length };
}

/**
 * Build 5BPI - Basic Policy Information.
 * Official AL3.mdb length: 504 bytes
 */
function build5BPI(doc: PolicyCreatorDocument): AL3Record {
  const length = 504;
  let content = '';

  // 0-3: Group code
  content += '5BPI';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-23: Reference header
  content += padRight('F200015BPIF10001', 16);
  // 24-48: Policy number (25 chars)
  content += padRight(doc.policyNumber, 25);
  // 49-58: Filler
  content += padRight('', 10);
  // 59-63: NAIC code (5 chars)
  content += padRight(doc.carrierNAIC, 5);
  // 64-68: LOB code (5 chars)
  content += padRight(getLOBCode(doc.lineOfBusiness), 5);
  // 69-72: Filler
  content += padRight('', 4);
  // 73-78: Effective date short (YYMMDD)
  content += formatAL3DateShort(doc.effectiveDate);
  // 79-84: Expiration date short (YYMMDD)
  content += formatAL3DateShort(doc.expirationDate);
  // 85-97: Filler
  content += padRight('', 13);
  // 98-108: Written premium (11 chars, implied 2 decimals)
  content += padZero(Math.round((doc.totalPremium ?? 0) * 100), 11);
  // 109-119: Annual premium with sign
  content += formatAL3Premium(doc.totalPremium);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '5BPI', content, length };
}

/**
 * Build 5VEH - Vehicle record.
 * Official AL3.mdb length: 251 bytes
 */
function build5VEH(vehicle: CanonicalVehicle, vehicleIndex: number): AL3Record {
  const length = 251;
  let content = '';

  // 0-3: Group code
  content += '5VEH';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-29: Reference header
  content += padRight('R100015VEHR10001', 22);
  // 30-33: Vehicle sequence number (4 chars)
  content += padZero(vehicleIndex + 1, 4);
  // 34-37: Filler
  content += padRight('', 4);
  // 38-41: Year (4 chars)
  content += padZero(vehicle.year, 4);
  // 42-61: Make (20 chars)
  content += padRight(vehicle.make, 20);
  // 62-81: Model (20 chars)
  content += padRight(vehicle.model, 20);
  // 82-86: Usage (5 chars) - PLEAS, COMUT, BUSNS, FARM
  const usageCode = (vehicle.usage ?? '').toUpperCase().substring(0, 5);
  content += padRight(usageCode || 'PLEAS', 5);
  // 87-103: VIN (17 chars)
  content += padRight(vehicle.vin, 17);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '5VEH', content, length };
}

/**
 * Build 5DRV - Driver record.
 * Official AL3.mdb length: 218 bytes
 */
function build5DRV(driver: CanonicalDriver, driverIndex: number): AL3Record {
  const length = 218;
  let content = '';

  // 0-3: Group code
  content += '5DRV';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-29: Reference header
  content += padRight('F200015DRVR10001', 22);
  // 30-33: Filler
  content += padRight('', 4);
  // 34-37: Driver sequence number (4 chars)
  content += padZero(driverIndex + 1, 4);
  // 38: Relationship code (P=Primary, S=Spouse, D=Dependent, O=Other)
  const relCode = driver.relationship?.substring(0, 1).toUpperCase() || 'P';
  content += relCode === 'S' ? 'S' : relCode === 'N' ? 'P' : relCode === 'C' ? 'D' : 'O';
  // 39-73: First name (35 chars)
  content += padRight(driver.firstName, 35);
  // 74-97: Last name (24 chars)
  content += padRight(driver.lastName, 24);
  // 98-101: Filler
  content += padRight('', 4);
  // 102-114: License number (13 chars)
  content += padRight(driver.licenseNumber, 13);
  // 115-131: Filler
  content += padRight('', 17);
  // 132-133: License state (2 chars)
  content += padRight(driver.licenseState, 2);
  // 134-139: Filler
  content += padRight('', 6);
  // 140-145: DOB short (YYMMDD)
  content += formatAL3DateShort(driver.dateOfBirth);
  // 146: Gender (M/F)
  content += driver.gender || ' ';
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '5DRV', content, length };
}

/**
 * Build 6CVA - Vehicle-level coverage.
 * Official AL3.mdb length: 262 bytes
 */
function build6CVA(
  coverage: CanonicalCoverage,
  vehicleIndex: number
): AL3Record {
  const length = 262;
  let content = '';

  // 0-3: Group code
  content += '6CVA';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-29: Reference header with vehicle ref
  content += padRight(`W100${padZero(vehicleIndex + 1, 2)}5VEHR10001`, 22);
  // 30-44: Coverage code (15 chars)
  content += padRight(coverage.code, 15);
  // 45-59: Filler
  content += padRight('', 15);
  // 60-71: Premium (12 chars with sign)
  content += formatAL3Premium(coverage.premium);
  // 72-102: Filler
  content += padRight('', 31);
  // 103-112: Limit (10 chars)
  content += padZero(coverage.limit, 10);
  // 113-117: Limit 2 (5 chars) - per-accident part of split limit
  content += padZero(coverage.limit2, 5);
  // 118-124: Deductible (7 chars)
  content += padZero(coverage.deductible, 7);
  // 125-144: Filler
  content += padRight('', 20);
  // 145-194: Description (50 chars)
  content += padRight(coverage.description, 50);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '6CVA', content, length };
}

/**
 * Build 6CVH - Home/property coverage.
 * Official AL3.mdb length: 322 bytes
 */
function build6CVH(
  coverage: CanonicalCoverage,
  propertyIndex: number
): AL3Record {
  const length = 322;
  let content = '';

  // 0-3: Group code
  content += '6CVH';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-29: Reference header with property ref
  content += padRight(`W110${padZero(propertyIndex + 1, 2)}6HRUR10001`, 22);
  // 30-44: Coverage code (15 chars)
  content += padRight(coverage.code, 15);
  // 45-59: Filler
  content += padRight('', 15);
  // 60-71: Primary limit (12 chars)
  content += padZero(coverage.limit, 12);
  // 72-89: Filler
  content += padRight('', 18);
  // 90-100: Secondary amount / deductible (11 chars)
  content += padZero(coverage.deductible || coverage.limit2, 11);
  // 101-149: Filler
  content += padRight('', 49);
  // 150-199: Description (50 chars)
  content += padRight(coverage.description, 50);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '6CVH', content, length };
}

/**
 * Build 5AOI - Additional Other Insured / Mortgagee.
 * Standard length: 238 bytes
 */
function build5AOI(mortgagee: CanonicalMortgagee, index: number): AL3Record {
  const length = 238;
  let content = '';

  // Map interest type code
  const interestTypeMap: Record<string, string> = {
    'MG': 'MS', // Mortgagee
    'LH': 'LH', // Lienholder
    'LP': 'LP', // Loss Payee
    'AI': 'CN', // Additional Insured / Co-Named
  };

  // 0-3: Group code
  content += '5AOI';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-23: Reference header
  content += padRight('R100015AOIR10001', 16);
  // 24-26: Sequence number (3 chars)
  content += padZero(index + 1, 3);
  // 27-28: Interest type (2 chars)
  content += padRight(interestTypeMap[mortgagee.interestType] || 'MS', 2);
  // 29-30: Filler
  content += padRight('', 2);
  // 31: Entity type (C=Company, P=Person)
  content += 'C';
  // 32-71: Name (40 chars)
  content += padRight(mortgagee.name, 40);
  // 72-130: Filler (address fields would go here)
  content += padRight('', 59);
  // 131-140: Loan number (10 chars)
  content += padRight(mortgagee.loanNumber, 10);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '5AOI', content, length };
}

/**
 * Build 9AOI - Mortgagee address continuation.
 * Official AL3.mdb length: 252 bytes
 */
function build9AOI(mortgagee: CanonicalMortgagee): AL3Record {
  const length = 252;
  let content = '';

  // 0-3: Group code
  content += '9AOI';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-28: Reference header
  content += padRight('R100015AOIR10001', 21);
  // 29-58: Address line 1 (30 chars)
  content += padRight(mortgagee.address, 30);
  // 59-78: City (20 chars)
  content += padRight(mortgagee.city, 20);
  // 79-80: State (2 chars)
  content += padRight(mortgagee.state, 2);
  // 81-90: ZIP (10 chars)
  content += padRight(mortgagee.zip, 10);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '9AOI', content, length };
}

/**
 * Build 5LAG - Location Address Group (for properties).
 * Official AL3.mdb length: 510 bytes
 */
function build5LAG(property: CanonicalProperty, propertyIndex: number): AL3Record {
  const length = 510;
  let content = '';

  // 0-3: Group code
  content += '5LAG';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-23: Reference header
  content += padRight('F200015LAGR10001', 16);
  // 24-27: Location number (4 chars)
  content += padZero(propertyIndex + 1, 4);
  // 28-57: Address (30 chars)
  content += padRight(property.address, 30);
  // 58-87: Address 2 (30 chars)
  content += padRight('', 30);
  // 88-107: City (20 chars)
  content += padRight(property.city, 20);
  // 108-109: State (2 chars)
  content += padRight(property.state, 2);
  // 110-114: ZIP (5 chars)
  content += padRight(property.zip, 5);
  // 115-120: Filler
  content += padRight('', 6);
  // 121-135: County (15 chars)
  content += padRight(property.county, 15);
  // Fill rest
  content = padRight(content, length);

  return { groupCode: '5LAG', content, length };
}

/**
 * Build 3MTG - Master Trailer Group (file trailer).
 * Official AL3.mdb length: 240 bytes
 */
function build3MTG(recordCount: number): AL3Record {
  const length = 240;
  let content = '';

  // 0-3: Group code
  content += '3MTG';
  // 4-6: Record length
  content += padZero(length, 3);
  // 7: Separator
  content += ' ';
  // 8-17: Number of records (10 chars)
  content += padZero(recordCount, 10);
  // Fill rest with spaces
  content = padRight(content, length);

  return { groupCode: '3MTG', content, length };
}

// =============================================================================
// MAIN EMITTER
// =============================================================================

/**
 * Generate AL3 records from a PolicyCreatorDocument.
 * Returns an array of AL3Record objects ready for XML wrapping.
 */
export function emitAL3Records(doc: PolicyCreatorDocument): AL3Record[] {
  const records: AL3Record[] = [];

  // 1. File header
  records.push(build1MHG());

  // 2. Transaction header
  records.push(build2TRG(doc));

  // 3. Insured name (5BIS)
  records.push(build5BIS(doc));

  // 4. Insured address (9BIS)
  records.push(build9BIS(doc));

  // 5. Policy info (5BPI)
  records.push(build5BPI(doc));

  // 6. Properties (if home/dwelling)
  const isHomePolicy = [
    'Homeowners',
    'Dwelling Fire',
    'Renters',
    'Mobile Home',
  ].includes(doc.lineOfBusiness ?? '');

  if (isHomePolicy && doc.properties) {
    for (let i = 0; i < doc.properties.length; i++) {
      const prop = doc.properties[i];
      // Location address
      records.push(build5LAG(prop, i));
      // Property coverages (6CVH)
      if (prop.coverages) {
        for (const cov of prop.coverages) {
          records.push(build6CVH(cov, i));
        }
      }
    }
  }

  // 7. Policy-level home coverages (not tied to specific property)
  if (isHomePolicy && doc.coverages) {
    for (const cov of doc.coverages) {
      if (!cov.propertyNumber) {
        records.push(build6CVH(cov, 0));
      }
    }
  }

  // 8. Vehicles (if auto)
  const isAutoPolicy = [
    'Personal Auto',
    'Commercial Auto',
    'Motorcycle',
    'Recreational Vehicle',
  ].includes(doc.lineOfBusiness ?? '');

  if (isAutoPolicy && doc.vehicles) {
    for (let i = 0; i < doc.vehicles.length; i++) {
      const veh = doc.vehicles[i];
      // Vehicle record
      records.push(build5VEH(veh, i));
      // Vehicle coverages (6CVA)
      if (veh.coverages) {
        for (const cov of veh.coverages) {
          records.push(build6CVA(cov, i));
        }
      }
    }
  }

  // 9. Policy-level auto coverages (not tied to specific vehicle)
  if (isAutoPolicy && doc.coverages) {
    for (const cov of doc.coverages) {
      if (!cov.vehicleNumber) {
        // Emit as vehicle 1 coverage (policy-level)
        records.push(build6CVA(cov, 0));
      }
    }
  }

  // 10. Drivers
  if (doc.drivers) {
    for (let i = 0; i < doc.drivers.length; i++) {
      records.push(build5DRV(doc.drivers[i], i));
    }
  }

  // 11. Mortgagees and lienholders
  if (doc.mortgagees) {
    for (let i = 0; i < doc.mortgagees.length; i++) {
      const mort = doc.mortgagees[i];
      records.push(build5AOI(mort, i));
      // If address provided, add continuation record
      if (mort.address) {
        records.push(build9AOI(mort));
      }
    }
  }

  // 12. File trailer
  records.push(build3MTG(records.length + 1)); // +1 for the trailer itself

  return records;
}

/**
 * Generate raw AL3 content (line-by-line fixed-width records).
 * Each record is on its own line.
 */
export function emitAL3Content(doc: PolicyCreatorDocument): string {
  const records = emitAL3Records(doc);
  return records.map((r) => r.content).join('\n');
}

// =============================================================================
// VALIDATED EMITTER (with Compiler Validation)
// =============================================================================

export interface EmitResult {
  valid: boolean;
  records: AL3Record[];
  rawContent: string;
  compilerErrors: ValidationError[];
  compilerWarnings: string[];
  roundTripErrors: string[];
  roundTripWarnings: string[];
}

/**
 * Generate AL3 records with compiler validation.
 * This is the "hardened" version that validates each record against the AL3.mdb schema.
 *
 * Steps:
 * 1. Emit all records using standard emitter
 * 2. Validate each record against DDE field definitions
 * 3. Validate coded fields against DDT value tables
 * 4. Run round-trip verification (Gate E)
 *
 * If any errors are found, `valid` will be false and generation should be blocked.
 */
export function emitAL3RecordsValidated(doc: PolicyCreatorDocument): EmitResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: string[] = [];

  // Step 1: Emit records using standard emitter
  const records = emitAL3Records(doc);
  const rawContent = records.map((r) => r.content).join('\n');

  // Step 2: Validate each record against compiler schema
  for (const record of records) {
    const result: CompilerResult = validateRecord(record.groupCode, record.content);

    if (result.errors.length > 0) {
      allErrors.push(...result.errors);
    }
    if (result.warnings.length > 0) {
      allWarnings.push(...result.warnings);
    }
  }

  // Step 3: Run round-trip verification (Gate E)
  // This ensures key data survives the emit → parse cycle
  const recordStrings = records.map((r) => r.content);
  const roundTripResult = verifyRoundTrip(recordStrings, {
    policyNumber: doc.policyNumber,
    insuredName: doc.insuredName || `${doc.insuredFirstName} ${doc.insuredLastName}`.trim(),
    effectiveDate: doc.effectiveDate,
    vehicleCount: doc.vehicles?.length ?? 0,
    propertyCount: doc.properties?.length ?? 0,
    coverageCount: countTotalCoverages(doc),
  });

  return {
    valid: allErrors.length === 0 && roundTripResult.errors.length === 0,
    records,
    rawContent,
    compilerErrors: allErrors,
    compilerWarnings: allWarnings,
    roundTripErrors: roundTripResult.errors,
    roundTripWarnings: roundTripResult.warnings,
  };
}

/**
 * Count total coverages across all sources in a document.
 */
function countTotalCoverages(doc: PolicyCreatorDocument): number {
  let count = 0;

  // Policy-level coverages
  if (doc.coverages) {
    count += doc.coverages.length;
  }

  // Vehicle coverages
  if (doc.vehicles) {
    for (const v of doc.vehicles) {
      if (v.coverages) {
        count += v.coverages.length;
      }
    }
  }

  // Property coverages
  if (doc.properties) {
    for (const p of doc.properties) {
      if (p.coverages) {
        count += p.coverages.length;
      }
    }
  }

  return count;
}
