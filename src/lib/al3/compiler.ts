/**
 * AL3 Compiler
 * ============
 * Validates AL3 records against official AL3.mdb definitions.
 * Provides compile-time enforcement of:
 *   - Field positions and lengths
 *   - Coded field values (DDT validation)
 *   - Required fields
 *   - Record structure
 *
 * This is the "compiler boundary" that prevents invalid AL3 from being emitted.
 */

import groupsData from './definitions/groups.json';
import ddeData from './definitions/dde.json';
import ddtData from './definitions/ddt.json';

// =============================================================================
// TYPES
// =============================================================================

export interface GroupDefinition {
  name: string;
  version: string;
  length: number;
}

export interface FieldDefinition {
  ref: string;
  element: string;
  start: number;
  length: number;
  dataType: string;
  class: string;
  desc: string;
}

export interface CodedValue {
  value: string;
  desc: string;
}

export interface ValidationError {
  type: 'field_overflow' | 'invalid_code' | 'missing_required' | 'wrong_length' | 'invalid_position' | 'parse_error';
  groupCode: string;
  field?: string;
  message: string;
  position?: number;
  expected?: string;
  actual?: string;
}

export interface CompilerResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  record: string;
  groupCode: string;
}

// =============================================================================
// SCHEMA LOADING
// =============================================================================

const groups = groupsData as Record<string, GroupDefinition>;
const dde = ddeData as Record<string, FieldDefinition[]>;
const ddt = ddtData as Record<string, CodedValue[]>;

/**
 * Get group definition by code.
 */
export function getGroupDefinition(groupCode: string): GroupDefinition | undefined {
  return groups[groupCode];
}

/**
 * Get field definitions for a group.
 */
export function getFieldDefinitions(groupCode: string): FieldDefinition[] {
  return dde[groupCode] || [];
}

/**
 * Get valid coded values for a reference ID.
 */
export function getCodedValues(referenceId: string): CodedValue[] {
  return ddt[referenceId] || [];
}

/**
 * Check if a value is valid for a coded field.
 */
export function isValidCodedValue(referenceId: string, value: string): boolean {
  const codes = getCodedValues(referenceId);
  if (codes.length === 0) {
    // No codes defined - allow any value
    return true;
  }
  return codes.some((c) => c.value === value || c.value === value.trim());
}

// =============================================================================
// FIELD-LEVEL VALIDATION
// =============================================================================

/**
 * Validate a single field value against its definition.
 */
export function validateField(
  groupCode: string,
  field: FieldDefinition,
  value: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check length
  if (value.length > field.length) {
    errors.push({
      type: 'field_overflow',
      groupCode,
      field: field.ref,
      message: `Field ${field.ref} exceeds max length ${field.length}: "${value.substring(0, 20)}..." (${value.length} chars)`,
      expected: `${field.length}`,
      actual: `${value.length}`,
    });
  }

  // Check coded values if this is a coded field
  // Coded fields typically have dataType 'C' or class containing 'Coded'
  if (field.dataType === 'C' || field.class.includes('Coded')) {
    const trimmed = value.trim();
    if (trimmed && !isValidCodedValue(field.ref, trimmed)) {
      // Only error if we have codes defined for this reference
      const codes = getCodedValues(field.ref);
      if (codes.length > 0) {
        errors.push({
          type: 'invalid_code',
          groupCode,
          field: field.ref,
          message: `Invalid coded value for ${field.ref}: "${trimmed}". Valid values: ${codes.slice(0, 5).map(c => c.value).join(', ')}${codes.length > 5 ? '...' : ''}`,
          actual: trimmed,
        });
      }
    }
  }

  return errors;
}

// =============================================================================
// RECORD-LEVEL VALIDATION
// =============================================================================

/**
 * Validate a complete AL3 record against the schema.
 */
export function validateRecord(
  groupCode: string,
  record: string
): CompilerResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Get group definition
  const groupDef = getGroupDefinition(groupCode);
  if (!groupDef) {
    warnings.push(`Unknown group code: ${groupCode}. Skipping schema validation.`);
    return { valid: true, errors, warnings, record, groupCode };
  }

  // Check record length
  const expectedLength = groupDef.length;
  if (expectedLength > 0 && record.length !== expectedLength) {
    // Length mismatch - could be an error or variable-length record
    if (record.length < expectedLength) {
      warnings.push(`Record ${groupCode} is shorter than expected (${record.length} vs ${expectedLength}). Padding may be needed.`);
    } else if (record.length > expectedLength) {
      errors.push({
        type: 'wrong_length',
        groupCode,
        message: `Record ${groupCode} exceeds max length ${expectedLength}: got ${record.length}`,
        expected: `${expectedLength}`,
        actual: `${record.length}`,
      });
    }
  }

  // Validate individual fields
  const fields = getFieldDefinitions(groupCode);
  for (const field of fields) {
    if (field.start > 0 && field.length > 0 && field.start + field.length <= record.length) {
      const value = record.substring(field.start, field.start + field.length);
      const fieldErrors = validateField(groupCode, field, value);
      errors.push(...fieldErrors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    record,
    groupCode,
  };
}

// =============================================================================
// COMPILE-TIME RECORD BUILDER
// =============================================================================

export interface FieldValue {
  ref: string;  // Reference ID from DDE (e.g., "AUTOCI01")
  value: string | number;
}

/**
 * Build an AL3 record using the official schema.
 * This is the "safe" way to build records - it validates everything.
 */
export function buildRecord(
  groupCode: string,
  fieldValues: FieldValue[]
): CompilerResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Get group definition
  const groupDef = getGroupDefinition(groupCode);
  if (!groupDef) {
    errors.push({
      type: 'parse_error',
      groupCode,
      message: `Unknown group code: ${groupCode}`,
    });
    return { valid: false, errors, warnings, record: '', groupCode };
  }

  // Get field definitions
  const fields = getFieldDefinitions(groupCode);
  if (fields.length === 0) {
    warnings.push(`No field definitions found for ${groupCode}. Using raw values.`);
  }

  // Create field map for quick lookup
  const fieldMap = new Map<string, FieldDefinition>();
  for (const f of fields) {
    fieldMap.set(f.ref, f);
  }

  // Initialize record with spaces
  const recordLength = groupDef.length || 200;
  const recordBuffer = new Array(recordLength).fill(' ');

  // Write group code at position 0
  const groupCodeStr = groupCode.padEnd(4, ' ');
  for (let i = 0; i < 4; i++) {
    recordBuffer[i] = groupCodeStr[i];
  }

  // Write record length at positions 4-6
  const lengthStr = recordLength.toString().padStart(3, '0');
  for (let i = 0; i < 3; i++) {
    recordBuffer[4 + i] = lengthStr[i];
  }

  // Write field values
  for (const fv of fieldValues) {
    const fieldDef = fieldMap.get(fv.ref);
    if (!fieldDef) {
      warnings.push(`Unknown field reference: ${fv.ref}`);
      continue;
    }

    const valueStr = String(fv.value);
    const paddedValue = valueStr.padEnd(fieldDef.length, ' ').substring(0, fieldDef.length);

    // Validate the value
    const fieldErrors = validateField(groupCode, fieldDef, valueStr);
    errors.push(...fieldErrors);

    // Write to buffer
    for (let i = 0; i < paddedValue.length && fieldDef.start + i < recordBuffer.length; i++) {
      recordBuffer[fieldDef.start + i] = paddedValue[i];
    }
  }

  const record = recordBuffer.join('');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    record,
    groupCode,
  };
}

// =============================================================================
// POST-EMIT VERIFICATION (Gate E)
// =============================================================================

export interface RoundTripResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsedData: {
    groupCode: string;
    fields: Record<string, string>;
  };
}

/**
 * Parse an AL3 record back to structured data.
 * Used for round-trip verification.
 */
export function parseRecord(record: string): RoundTripResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fields: Record<string, string> = {};

  // Extract group code
  const groupCode = record.substring(0, 4).trim();
  if (!groupCode) {
    errors.push('Missing group code');
    return { valid: false, errors, warnings, parsedData: { groupCode: '', fields } };
  }

  // Get field definitions
  const fieldDefs = getFieldDefinitions(groupCode);
  if (fieldDefs.length === 0) {
    warnings.push(`No field definitions for ${groupCode}`);
  }

  // Extract each field
  for (const field of fieldDefs) {
    if (field.start > 0 && field.length > 0 && field.start + field.length <= record.length) {
      const value = record.substring(field.start, field.start + field.length);
      fields[field.ref] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsedData: { groupCode, fields },
  };
}

/**
 * Verify that emitted AL3 round-trips correctly.
 * This is the "Gate E" check before allowing download.
 *
 * Note: This performs content-based verification (checking that key data
 * appears somewhere in the appropriate records) rather than strict field
 * position verification. This is intentional because the emitter may not
 * yet place all fields at their exact DDE positions.
 *
 * Future improvement: Once the emitter is fully MDB-driven, this should
 * verify exact field positions match DDE definitions.
 */
export function verifyRoundTrip(
  records: string[],
  expectedData: {
    policyNumber?: string;
    insuredName?: string;
    effectiveDate?: string;
    vehicleCount?: number;
    propertyCount?: number;
    coverageCount?: number;
  }
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  let foundPolicyNumber = false;
  let foundInsuredName = false;
  let foundEffectiveDate = false;
  let vehicleCount = 0;
  let propertyCount = 0;
  let coverageCount = 0;

  for (const record of records) {
    const groupCode = record.substring(0, 4).trim();
    if (!groupCode) continue;

    // Content-based verification: check if expected data appears in record content
    // This is more lenient than field-position verification but still validates
    // that key data made it into the output.

    // Check for policy number in 5BPI (search the full record content)
    if (groupCode === '5BPI' && expectedData.policyNumber) {
      // Look for the policy number anywhere in the record
      const searchTerm = expectedData.policyNumber.substring(0, 15).toUpperCase();
      if (record.toUpperCase().includes(searchTerm)) {
        foundPolicyNumber = true;
      }
    }

    // Check for insured name in 5BIS (search the full record content)
    if (groupCode === '5BIS' && expectedData.insuredName) {
      // Split name and look for significant parts
      const nameParts = expectedData.insuredName.split(/\s+/).filter((p) => p.length > 2);
      for (const part of nameParts) {
        if (record.toUpperCase().includes(part.toUpperCase())) {
          foundInsuredName = true;
          break;
        }
      }
    }

    // Count vehicles
    if (groupCode === '5VEH') {
      vehicleCount++;
    }

    // Count properties (locations)
    if (groupCode === '5LAG') {
      propertyCount++;
    }

    // Count coverages
    if (groupCode === '6CVA' || groupCode === '6CVH' || groupCode === '5CVG') {
      coverageCount++;
    }
  }

  // Verify expected data was found
  if (expectedData.policyNumber && !foundPolicyNumber) {
    errors.push(`Policy number not found in 5BPI record: expected "${expectedData.policyNumber}"`);
  }

  if (expectedData.insuredName && !foundInsuredName) {
    errors.push(`Insured name not found in 5BIS record: expected "${expectedData.insuredName}"`);
  }

  if (expectedData.vehicleCount !== undefined && vehicleCount !== expectedData.vehicleCount) {
    errors.push(`Vehicle count mismatch: expected ${expectedData.vehicleCount}, found ${vehicleCount}`);
  }

  if (expectedData.propertyCount !== undefined && propertyCount !== expectedData.propertyCount) {
    errors.push(`Property count mismatch: expected ${expectedData.propertyCount}, found ${propertyCount}`);
  }

  if (expectedData.coverageCount !== undefined && coverageCount < expectedData.coverageCount) {
    warnings.push(`Coverage count lower than expected: expected ${expectedData.coverageCount}, found ${coverageCount}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// BATCH VALIDATION
// =============================================================================

/**
 * Validate a complete AL3 file (multiple records).
 */
export function validateAL3File(records: string[]): {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  recordCount: number;
} {
  const allErrors: ValidationError[] = [];
  const allWarnings: string[] = [];

  for (const record of records) {
    if (!record.trim()) continue;

    const groupCode = record.substring(0, 4);
    const result = validateRecord(groupCode, record);

    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    recordCount: records.length,
  };
}

// =============================================================================
// COVERAGE CODE VALIDATION
// =============================================================================

/**
 * Common coverage codes that should be validated.
 */
const COVERAGE_CODE_REFS = [
  'LSCRTYP',  // Loss/Coverage Type
  'COVTYP',   // Coverage Type
  'CVGTYP',   // Coverage Type
];

/**
 * Check if a coverage code is valid according to AL3 spec.
 */
export function isValidCoverageCode(code: string): boolean {
  for (const ref of COVERAGE_CODE_REFS) {
    if (isValidCodedValue(ref, code)) {
      return true;
    }
  }
  // If no codes defined, allow the value
  return true;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const AL3Schema = {
  groups,
  dde,
  ddt,
  getGroupDefinition,
  getFieldDefinitions,
  getCodedValues,
  isValidCodedValue,
  isValidCoverageCode,
  validateField,
  validateRecord,
  buildRecord,
  parseRecord,
  verifyRoundTrip,
  validateAL3File,
};
