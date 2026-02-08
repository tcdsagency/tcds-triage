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
 * Create a fixed-width buffer and write fields at specific positions.
 * Uses 1-based positioning to match AL3 DDE spec (convert to 0-based internally).
 */
class AL3Buffer {
  private buffer: string[];

  constructor(length: number) {
    this.buffer = new Array(length).fill(' ');
  }

  /**
   * Write a string at a 1-based position (matching DDE spec).
   */
  writeAt(pos1Based: number, value: string, maxLen?: number): void {
    const pos = pos1Based - 1; // Convert to 0-based
    const val = maxLen ? value.substring(0, maxLen) : value;
    for (let i = 0; i < val.length && pos + i < this.buffer.length; i++) {
      this.buffer[pos + i] = val[i];
    }
  }

  /**
   * Write a zero-padded number at a 1-based position.
   */
  writeNumAt(pos1Based: number, value: number | undefined | null, width: number): void {
    this.writeAt(pos1Based, padZero(value, width));
  }

  /**
   * Write a right-padded string at a 1-based position.
   */
  writeStrAt(pos1Based: number, value: string | undefined | null, width: number): void {
    this.writeAt(pos1Based, padRight(value, width));
  }

  toString(): string {
    return this.buffer.join('');
  }
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
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header (group code + length + reference)
 *   31-90:  INAME  Insured's Name (60 chars)
 *   91-120: IIDCO  Company's ID for Insured (30 chars)
 *   121-150: IIDAG Agency's ID for Insured (30 chars)
 *   151-152: LECD  Legal Entity Code (2 chars) - P=Person, C=Company
 */
function build5BIS(doc: PolicyCreatorDocument): AL3Record {
  const length = 172;
  const buf = new AL3Buffer(length);

  // Header section (1-30)
  buf.writeAt(1, '5BIS');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, 'R100015BPIF10001', 22);

  // Insured Name (31-90) - 60 chars
  // Format: "FirstName LastName" or just full name
  const fullName = doc.insuredName ||
    `${doc.insuredFirstName || ''} ${doc.insuredLastName || ''}`.trim();
  buf.writeStrAt(31, fullName, 60);

  // Legal Entity Code (151-152)
  buf.writeStrAt(151, doc.insuredEntityType || 'P', 2);

  return { groupCode: '5BIS', content: buf.toString(), length };
}

/**
 * Build 9BIS - Insured Address Continuation.
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header
 *   31-60:  ADLN   Street Address Line 1 (30 chars)
 *   61-90:  ADLN   Street Address Line 2 (30 chars)
 *   91-109: CITY   City (19 chars)
 *   110-111: STATE State (2 chars)
 *   112-120: ZIPCD ZIP Code (9 chars)
 *   121-134: PHONE Phone (14 chars)
 */
function build9BIS(doc: PolicyCreatorDocument): AL3Record {
  const length = 343;
  const buf = new AL3Buffer(length);

  // Header (1-30)
  buf.writeAt(1, '9BIS');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, 'R100015BPIF10001', 22);

  // Street Address Line 1 (31-60)
  buf.writeStrAt(31, doc.insuredAddress, 30);

  // City (91-109) - 19 chars
  buf.writeStrAt(91, doc.insuredCity, 19);

  // State (110-111)
  buf.writeStrAt(110, doc.insuredState, 2);

  // ZIP Code (112-120) - 9 chars
  buf.writeStrAt(112, doc.insuredZip, 9);

  // Phone (121-134) - 14 chars
  const phone = (doc.insuredPhone ?? '').replace(/\D/g, '');
  buf.writeStrAt(121, phone, 14);

  return { groupCode: '9BIS', content: buf.toString(), length };
}

/**
 * Build 5BPI - Basic Policy Information.
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header
 *   31-55:  POLNO  Policy Number (25 chars)
 *   66-71:  COCD   Company Code / NAIC (6 chars)
 *   72-76:  LOBCD  Line of Business Code (5 chars)
 *   81-86:  ZZMOV  Policy Effective Date (YYMMDD)
 *   87-92:  ZZMOV  Policy Expiration Date (YYMMDD)
 *   112-123: FPREM Current Term Amount / Premium (12 chars)
 *   160-171: WRPRM Written Amount (12 chars)
 */
function build5BPI(doc: PolicyCreatorDocument): AL3Record {
  const length = 504;
  const buf = new AL3Buffer(length);

  // Header (1-30)
  buf.writeAt(1, '5BPI');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, 'F200015BPIF10001', 22);

  // Policy Number (31-55) - 25 chars
  buf.writeStrAt(31, doc.policyNumber, 25);

  // Company Code / NAIC (66-71) - 6 chars
  buf.writeStrAt(66, doc.carrierNAIC, 6);

  // Line of Business Code (72-76) - 5 chars
  buf.writeStrAt(72, getLOBCode(doc.lineOfBusiness), 5);

  // Policy Effective Date (81-86) - YYMMDD
  buf.writeAt(81, formatAL3DateShort(doc.effectiveDate));

  // Policy Expiration Date (87-92) - YYMMDD
  buf.writeAt(87, formatAL3DateShort(doc.expirationDate));

  // Current Term Amount / Premium (112-123) - 12 chars
  const premiumCents = Math.round((doc.totalPremium ?? 0) * 100);
  buf.writeNumAt(112, premiumCents, 12);

  // Written Amount (160-171) - 12 chars
  buf.writeNumAt(160, premiumCents, 12);

  return { groupCode: '5BPI', content: buf.toString(), length };
}

/**
 * Build 5VEH - Vehicle record.
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header
 *   31-34:  VEHNO  Company Vehicle Number (4 chars)
 *   35-38:  VEHNO  Agency Vehicle Number (4 chars)
 *   39-42:  VEHYR  Vehicle Year (4 chars)
 *   43-62:  VEHMK  Vehicle Make (20 chars)
 *   63-82:  VEHMD  Vehicle Model (20 chars)
 *   83-87:  BODCD  Body Type Code (5 chars)
 *   88-112: VIN    VIN (25 chars)
 */
function build5VEH(vehicle: CanonicalVehicle, vehicleIndex: number): AL3Record {
  const length = 251;
  const buf = new AL3Buffer(length);

  // Header (1-30)
  buf.writeAt(1, '5VEH');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, 'R100015VEHR10001', 22);

  // Company Vehicle Number (31-34)
  buf.writeNumAt(31, vehicleIndex + 1, 4);

  // Agency Vehicle Number (35-38)
  buf.writeNumAt(35, vehicleIndex + 1, 4);

  // Vehicle Year (39-42)
  buf.writeNumAt(39, vehicle.year, 4);

  // Vehicle Make (43-62)
  buf.writeStrAt(43, vehicle.make, 20);

  // Vehicle Model (63-82)
  buf.writeStrAt(63, vehicle.model, 20);

  // Body Type Code (83-87) - use usage as proxy
  const usageCode = (vehicle.usage ?? '').toUpperCase().substring(0, 5);
  buf.writeStrAt(83, usageCode || 'PLEAS', 5);

  // VIN (88-112) - 25 chars
  buf.writeStrAt(88, vehicle.vin, 25);

  return { groupCode: '5VEH', content: buf.toString(), length };
}

/**
 * Build 5DRV - Driver record.
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header
 *   31-34:  DRVNO  Agency Driver Number (4 chars)
 *   35-38:  DRVNO  Company Driver Number (4 chars)
 *   39-98:  DRVNM  Driver Name (60 chars)
 *   108-132: LICNO License Number (25 chars)
 *   133-134: STATE Licensed State (2 chars)
 *   141-146: ZZMOV DOB (YYMMDD)
 *   147:    SEXCD  Sex Code (M/F)
 *   161-168: BIRDT DOB long format (YYYYMMDD)
 */
function build5DRV(driver: CanonicalDriver, driverIndex: number): AL3Record {
  const length = 218;
  const buf = new AL3Buffer(length);

  // Header (1-30)
  buf.writeAt(1, '5DRV');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, 'F200015DRVR10001', 22);

  // Agency Driver Number (31-34)
  buf.writeNumAt(31, driverIndex + 1, 4);

  // Company Driver Number (35-38)
  buf.writeNumAt(35, driverIndex + 1, 4);

  // Driver Name (39-98) - 60 chars "FirstName LastName"
  const fullName = `${driver.firstName || ''} ${driver.lastName || ''}`.trim();
  buf.writeStrAt(39, fullName, 60);

  // License Number (108-132) - 25 chars
  buf.writeStrAt(108, driver.licenseNumber, 25);

  // Licensed State (133-134)
  buf.writeStrAt(133, driver.licenseState, 2);

  // DOB short (141-146) - YYMMDD
  buf.writeAt(141, formatAL3DateShort(driver.dateOfBirth));

  // Sex Code (147)
  buf.writeAt(147, driver.gender || ' ');

  // DOB long (161-168) - YYYYMMDD
  buf.writeAt(161, formatAL3Date(driver.dateOfBirth));

  return { groupCode: '5DRV', content: buf.toString(), length };
}

/**
 * Build 6CVA - Vehicle-level coverage.
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header
 *   31-35:  ACVCD  Coverage Code (5 chars)
 *   61-72:  FPREM  Premium (12 chars)
 *   103-110: PALMT Limit1 (8 chars)
 *   111-118: PALMT Limit2 (8 chars)
 *   119-124: PADED Deductible (6 chars)
 */
function build6CVA(
  coverage: CanonicalCoverage,
  vehicleIndex: number
): AL3Record {
  const length = 262;
  const buf = new AL3Buffer(length);

  // Header (1-30)
  buf.writeAt(1, '6CVA');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, `W100${padZero(vehicleIndex + 1, 2)}5VEHR10001`, 22);

  // Coverage Code (31-35) - 5 chars
  buf.writeStrAt(31, coverage.code, 5);

  // Premium (61-72) - 12 chars
  const premiumCents = Math.round((coverage.premium ?? 0) * 100);
  buf.writeNumAt(61, premiumCents, 12);

  // Limit1 (103-110) - 8 chars
  buf.writeNumAt(103, coverage.limit, 8);

  // Limit2 (111-118) - 8 chars
  buf.writeNumAt(111, coverage.limit2, 8);

  // Deductible (119-124) - 6 chars
  buf.writeNumAt(119, coverage.deductible, 6);

  return { groupCode: '6CVA', content: buf.toString(), length };
}

/**
 * Build 6CVH - Home/property coverage.
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header
 *   31-35:  HCVCD  Coverage Code (5 chars)
 *   61-72:  FPREM  Premium (12 chars)
 *   103-110: ZZMOV Limit1 (8 chars)
 *   111-115: ZZMOV Deductible1 (5 chars)
 */
function build6CVH(
  coverage: CanonicalCoverage,
  propertyIndex: number
): AL3Record {
  const length = 322;
  const buf = new AL3Buffer(length);

  // Header (1-30)
  buf.writeAt(1, '6CVH');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, `W110${padZero(propertyIndex + 1, 2)}6HRUR10001`, 22);

  // Coverage Code (31-35) - 5 chars
  buf.writeStrAt(31, coverage.code, 5);

  // Premium (61-72) - 12 chars
  const premiumCents = Math.round((coverage.premium ?? 0) * 100);
  buf.writeNumAt(61, premiumCents, 12);

  // Limit1 (103-110) - 8 chars
  buf.writeNumAt(103, coverage.limit, 8);

  // Deductible (111-115) - 5 chars
  buf.writeNumAt(111, coverage.deductible, 5);

  return { groupCode: '6CVH', content: buf.toString(), length };
}

/**
 * Build 5AOI - Additional Other Insured / Mortgagee.
 * DDE field positions (1-based):
 *   1-30:   HEADR  Header
 *   31-33:  ZZMOV  Interest ID Number (3 chars)
 *   34-35:  INTCD  Nature of Interest Code (2 chars)
 *   39-98:  INAME  Interest Name (60 chars)
 *   117-130: ZZMOV Interest Holder Account No (14 chars) - loan number
 */
function build5AOI(mortgagee: CanonicalMortgagee, index: number): AL3Record {
  const length = 238;
  const buf = new AL3Buffer(length);

  // Map interest type code
  const interestTypeMap: Record<string, string> = {
    'MG': 'MO', // Mortgagee
    'LH': 'LH', // Lienholder
    'LP': 'LP', // Loss Payee
    'AI': 'AI', // Additional Insured
  };

  // Header (1-30)
  buf.writeAt(1, '5AOI');
  buf.writeNumAt(5, length, 3);
  buf.writeAt(8, ' ');
  buf.writeStrAt(9, 'R100015AOIR10001', 22);

  // Interest ID Number (31-33)
  buf.writeNumAt(31, index + 1, 3);

  // Nature of Interest Code (34-35)
  buf.writeStrAt(34, interestTypeMap[mortgagee.interestType] || 'LH', 2);

  // Interest Name (39-98) - 60 chars
  buf.writeStrAt(39, mortgagee.name, 60);

  // Interest Holder Account No / Loan Number (117-130) - 14 chars
  buf.writeStrAt(117, mortgagee.loanNumber, 14);

  return { groupCode: '5AOI', content: buf.toString(), length };
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
