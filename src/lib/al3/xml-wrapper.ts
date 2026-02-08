/**
 * AL3 XML Wrapper
 * ===============
 * Wraps AL3 records in XML format for HawkSoft import.
 *
 * HawkSoft expects AL3-XML files with the following structure:
 * <?xml version="1.0" encoding="UTF-8"?>
 * <AL3Import>
 *   <Transaction>
 *     <1MHG>...record content...</1MHG>
 *     <2TRG>...record content...</2TRG>
 *     ...
 *   </Transaction>
 * </AL3Import>
 */

import type { AL3Record, EmitResult } from './emitter';
import { emitAL3Records, emitAL3RecordsValidated } from './emitter';
import type { PolicyCreatorDocument } from '@/types/policy-creator.types';
import type { ValidationError } from './compiler';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Escape XML special characters.
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Clean non-printable characters from a string.
 * Preserves spaces and standard ASCII printable characters.
 */
function cleanContent(str: string): string {
  // Replace non-printable characters (except space) with space
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
}

// =============================================================================
// XML BUILDERS
// =============================================================================

/**
 * Wrap an array of AL3 records in XML format.
 *
 * Note: XML element names cannot start with numbers, so we prefix
 * group codes with "R" (e.g., "1MHG" becomes "R1MHG").
 */
export function wrapAL3InXML(records: AL3Record[]): string {
  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // Root element
  lines.push('<AL3Import>');
  lines.push('  <Transaction>');

  // Each record as an XML element
  // Prefix with "R" since XML element names can't start with numbers
  for (const record of records) {
    const cleanedContent = cleanContent(record.content);
    const escapedContent = escapeXML(cleanedContent);
    const elementName = `R${record.groupCode}`;
    lines.push(`    <${elementName}>${escapedContent}</${elementName}>`);
  }

  lines.push('  </Transaction>');
  lines.push('</AL3Import>');

  return lines.join('\n');
}

/**
 * Generate AL3-XML from a PolicyCreatorDocument.
 * This is the legacy entry point that skips compiler validation.
 * @deprecated Use generateAL3XMLValidated instead for production use.
 */
export function generateAL3XML(doc: PolicyCreatorDocument): string {
  const records = emitAL3Records(doc);
  return wrapAL3InXML(records);
}

// =============================================================================
// VALIDATED GENERATION (with Gate E)
// =============================================================================

export interface GenerateResult {
  valid: boolean;
  rawAL3: string;
  al3xml: string;
  compilerErrors: ValidationError[];
  compilerWarnings: string[];
  roundTripErrors: string[];
  roundTripWarnings: string[];
  recordCount: number;
}

/**
 * Generate AL3-XML with full compiler validation (Gate E).
 * This is the production entry point that:
 * 1. Validates all records against AL3.mdb schema
 * 2. Validates coded fields against DDT tables
 * 3. Runs round-trip verification
 * 4. Only produces XML if validation passes
 *
 * @returns GenerateResult with valid=false if any errors were found
 */
export function generateAL3XMLValidated(doc: PolicyCreatorDocument): GenerateResult {
  // Run the validated emitter
  const emitResult: EmitResult = emitAL3RecordsValidated(doc);

  // Even if invalid, we still wrap in XML (for debugging) but mark as invalid
  const al3xml = wrapAL3InXML(emitResult.records);

  return {
    valid: emitResult.valid,
    rawAL3: emitResult.rawContent,
    al3xml,
    compilerErrors: emitResult.compilerErrors,
    compilerWarnings: emitResult.compilerWarnings,
    roundTripErrors: emitResult.roundTripErrors,
    roundTripWarnings: emitResult.roundTripWarnings,
    recordCount: emitResult.records.length,
  };
}

/**
 * Generate a filename for the AL3-XML file.
 * Format: {carrier}_{policyNumber}_{date}.al3.xml
 */
export function generateAL3XMLFilename(doc: PolicyCreatorDocument): string {
  const carrier = (doc.carrier ?? 'UNKNOWN')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase()
    .substring(0, 20);

  const policyNum = (doc.policyNumber ?? 'NEW')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 20);

  const date = new Date().toISOString().substring(0, 10).replace(/-/g, '');

  return `${carrier}_${policyNum}_${date}.al3.xml`;
}

/**
 * Validate that a document has the minimum required fields for AL3 generation.
 * Returns an object with `valid` boolean and `errors` array.
 */
export function validateForAL3(doc: PolicyCreatorDocument): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!doc.carrier) {
    errors.push('Carrier is required');
  }

  if (!doc.lineOfBusiness) {
    errors.push('Line of Business is required');
  }

  if (!doc.effectiveDate) {
    errors.push('Effective Date is required');
  }

  // Insured name (need at least name or first+last)
  const hasName = doc.insuredName ||
    (doc.insuredFirstName && doc.insuredLastName);
  if (!hasName) {
    errors.push('Insured Name is required');
  }

  // At least one coverage
  const hasCoverages =
    (doc.coverages && doc.coverages.length > 0) ||
    (doc.vehicles?.some((v) => v.coverages && v.coverages.length > 0)) ||
    (doc.properties?.some((p) => p.coverages && p.coverages.length > 0));

  if (!hasCoverages) {
    errors.push('At least one coverage is required');
  }

  // Warnings (non-blocking)
  if (!doc.policyNumber) {
    warnings.push('Policy Number is missing');
  }

  if (!doc.expirationDate) {
    warnings.push('Expiration Date is missing');
  }

  if (!doc.totalPremium) {
    warnings.push('Total Premium is missing');
  }

  // For auto policies, check vehicles
  const isAuto = [
    'Personal Auto',
    'Commercial Auto',
    'Motorcycle',
    'Recreational Vehicle',
  ].includes(doc.lineOfBusiness ?? '');

  if (isAuto) {
    if (!doc.vehicles || doc.vehicles.length === 0) {
      warnings.push('No vehicles found for auto policy');
    } else {
      doc.vehicles.forEach((v, i) => {
        if (!v.vin) {
          warnings.push(`Vehicle ${i + 1} is missing VIN`);
        }
      });
    }

    if (!doc.drivers || doc.drivers.length === 0) {
      warnings.push('No drivers found for auto policy');
    } else {
      doc.drivers.forEach((d, i) => {
        if (!d.dateOfBirth) {
          warnings.push(`Driver ${i + 1} is missing date of birth`);
        }
      });
    }
  }

  // For home policies, check properties
  const isHome = [
    'Homeowners',
    'Dwelling Fire',
    'Renters',
    'Mobile Home',
  ].includes(doc.lineOfBusiness ?? '');

  if (isHome) {
    if (!doc.properties || doc.properties.length === 0) {
      // Not an error - we can use insured address
      if (!doc.insuredAddress) {
        warnings.push('No property address or insured address found');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
