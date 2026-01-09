// =============================================================================
// ELIGIBILITY ENGINE
// Evaluates quote data against gatekeeper rules defined in schemas
// =============================================================================

import {
  EligibilityResult,
  EligibilityAlert,
  EligibilityStatus,
  AlertSeverity,
  GatekeeperDefinition,
  QuoteType,
  EMPTY_ELIGIBILITY_RESULT,
} from './types';

// Import schemas with gatekeepers
import { personalAutoSchema } from '@/lib/quote-schemas/personal-auto';
import { homeownersSchema } from '@/lib/quote-schemas/homeowners';
import { mobileHomeSchema } from '@/lib/quote-schemas/mobile-home';
import { recreationalSchema } from '@/lib/quote-schemas/recreational';
import { floodSchema } from '@/lib/quote-schemas/flood';
import { commercialAutoSchema } from '@/lib/quote-schemas/commercial-auto';

// =============================================================================
// SCHEMA REGISTRY
// =============================================================================

const SCHEMA_MAP: Record<string, { gatekeepers?: GatekeeperDefinition[] }> = {
  personal_auto: personalAutoSchema,
  homeowners: homeownersSchema,
  mobile_home: mobileHomeSchema,
  recreational: recreationalSchema,
  flood: floodSchema,
  commercial_auto: commercialAutoSchema,
};

// =============================================================================
// CONDITION EVALUATION
// =============================================================================

/**
 * Safely evaluate a condition string against form data
 * Supports: ===, !==, >, <, >=, <=, &&, ||, true, false
 */
function evaluateCondition(condition: string, value: any, formData: Record<string, any>): boolean {
  try {
    // Handle simple comparisons
    if (condition.includes('value')) {
      // Replace 'value' with actual value for evaluation
      const normalizedCondition = condition
        .replace(/value\s*===\s*true/g, String(value === true))
        .replace(/value\s*===\s*false/g, String(value === false))
        .replace(/value\s*===\s*"([^"]+)"/g, (_, str) => String(value === str))
        .replace(/value\s*===\s*'([^']+)'/g, (_, str) => String(value === str))
        .replace(/value\s*!==\s*"([^"]+)"/g, (_, str) => String(value !== str))
        .replace(/value\s*!==\s*'([^']+)'/g, (_, str) => String(value !== str))
        .replace(/value\s*>\s*(\d+)/g, (_, num) => String(Number(value) > Number(num)))
        .replace(/value\s*<\s*(\d+)/g, (_, num) => String(Number(value) < Number(num)))
        .replace(/value\s*>=\s*(\d+)/g, (_, num) => String(Number(value) >= Number(num)))
        .replace(/value\s*<=\s*(\d+)/g, (_, num) => String(Number(value) <= Number(num)));

      // Handle complex expressions with new Date()
      if (condition.includes('new Date()')) {
        const currentYear = new Date().getFullYear();
        const evalCondition = condition
          .replace(/new Date\(\)\.getFullYear\(\)/g, String(currentYear))
          .replace(/value/g, String(value));

        // Simple evaluation for year-based conditions
        const yearMatch = evalCondition.match(/(\d+)\s*-\s*(\d+)\s*>\s*(\d+)/);
        if (yearMatch) {
          const [, a, b, c] = yearMatch;
          return Number(a) - Number(b) > Number(c);
        }
      }

      // Evaluate boolean result
      if (normalizedCondition === 'true') return true;
      if (normalizedCondition === 'false') return false;

      // Handle OR conditions
      if (normalizedCondition.includes('||')) {
        return normalizedCondition.split('||').some(part => part.trim() === 'true');
      }

      // Handle AND conditions
      if (normalizedCondition.includes('&&')) {
        return normalizedCondition.split('&&').every(part => part.trim() === 'true');
      }

      return normalizedCondition === 'true';
    }

    return false;
  } catch (error) {
    console.warn(`[Eligibility] Failed to evaluate condition: ${condition}`, error);
    return false;
  }
}

/**
 * Get field value from form data, supporting nested paths like "vehicles[].usage"
 */
function getFieldValue(fieldPath: string, formData: Record<string, any>): { value: any; isArray: boolean; arrayValues?: any[] } {
  // Handle array field notation: "vehicles[].usage" or "drivers[].age"
  if (fieldPath.includes('[]')) {
    const [arrayName, ...rest] = fieldPath.split('[].');
    const nestedPath = rest.join('.');
    const array = formData[arrayName] || formData.arrays?.[arrayName] || [];

    if (Array.isArray(array) && array.length > 0) {
      const values = array.map(item => {
        if (nestedPath) {
          return nestedPath.split('.').reduce((obj, key) => obj?.[key], item);
        }
        return item;
      });
      return { value: values, isArray: true, arrayValues: values };
    }
    return { value: undefined, isArray: true, arrayValues: [] };
  }

  // Handle nested paths like "drivingHistory.hasDui"
  const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], formData);
  return { value, isArray: false };
}

/**
 * Get human-readable label for a field
 */
function getFieldLabel(fieldPath: string): string {
  const labels: Record<string, string> = {
    'vehicles[].usage': 'Vehicle Usage',
    'drivingHistory.hasDui': 'DUI History',
    'occupancy': 'Occupancy Type',
    'propertyType': 'Property Type',
    'roofAge': 'Roof Age',
    'customer.ownershipType': 'Ownership Type',
    'usageStorage.primaryUse': 'Primary Use',
    'boat.year': 'Boat Year',
    'yearManufactured': 'Year Manufactured',
    'tieDownType': 'Tie-Down Type',
    'floodZone': 'Flood Zone',
    'isSRL': 'Severe Repetitive Loss',
    'hasBasement': 'Basement',
    'buildingType': 'Building Type',
    'gvw': 'Gross Vehicle Weight',
    'hazmatCargo': 'Hazmat Cargo',
    'isForHire': 'For-Hire Operations',
    'hasViolations': 'Violations History',
    'motorhome.isFullTimeResidence': 'Full-Time Residence',
  };
  return labels[fieldPath] || fieldPath.split('.').pop() || fieldPath;
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate eligibility for a quote based on form data
 */
export function evaluateEligibility(
  quoteType: QuoteType | string,
  formData: Record<string, any>
): EligibilityResult {
  // Get schema for this quote type
  const schema = SCHEMA_MAP[quoteType];
  if (!schema?.gatekeepers || schema.gatekeepers.length === 0) {
    return EMPTY_ELIGIBILITY_RESULT;
  }

  const alerts: EligibilityAlert[] = [];

  // Evaluate each gatekeeper
  for (const gatekeeper of schema.gatekeepers) {
    const { value, isArray, arrayValues } = getFieldValue(gatekeeper.field, formData);

    // Skip if field has no value
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // For array fields, check each item
    if (isArray && arrayValues) {
      for (let i = 0; i < arrayValues.length; i++) {
        const itemValue = arrayValues[i];
        if (itemValue === undefined || itemValue === null || itemValue === '') {
          continue;
        }

        if (evaluateCondition(gatekeeper.condition, itemValue, formData)) {
          const severity: AlertSeverity = gatekeeper.action === 'warn' ? 'yellow' : 'red';
          alerts.push({
            id: `${gatekeeper.field}-${i}-${Date.now()}`,
            field: gatekeeper.field,
            fieldLabel: `${getFieldLabel(gatekeeper.field)} #${i + 1}`,
            triggeredValue: itemValue,
            severity,
            action: gatekeeper.action,
            message: gatekeeper.message,
            agentScript: gatekeeper.agentScript,
            acknowledged: false,
            triggeredAt: new Date(),
          });
        }
      }
    } else {
      // Single value field
      if (evaluateCondition(gatekeeper.condition, value, formData)) {
        const severity: AlertSeverity = gatekeeper.action === 'warn' ? 'yellow' : 'red';
        alerts.push({
          id: `${gatekeeper.field}-${Date.now()}`,
          field: gatekeeper.field,
          fieldLabel: getFieldLabel(gatekeeper.field),
          triggeredValue: value,
          severity,
          action: gatekeeper.action,
          message: gatekeeper.message,
          agentScript: gatekeeper.agentScript,
          acknowledged: false,
          triggeredAt: new Date(),
        });
      }
    }
  }

  // Categorize alerts
  const blockers = alerts.filter(a => a.severity === 'red');
  const warnings = alerts.filter(a => a.severity === 'yellow');

  // Determine overall status
  let status: EligibilityStatus = 'ELIGIBLE';
  if (blockers.length > 0) {
    status = 'DECLINE';
  } else if (warnings.length > 0) {
    status = 'REVIEW';
  }

  return {
    status,
    alerts,
    blockers,
    warnings,
    hasUnacknowledgedBlockers: blockers.some(b => !b.acknowledged),
    hasUnacknowledgedWarnings: warnings.some(w => !w.acknowledged),
    issueCount: alerts.length,
  };
}

/**
 * Get all gatekeepers for a quote type
 */
export function getGatekeepers(quoteType: QuoteType | string): GatekeeperDefinition[] {
  const schema = SCHEMA_MAP[quoteType];
  return schema?.gatekeepers || [];
}

/**
 * Check if a specific field would trigger any gatekeepers with a given value
 */
export function checkFieldEligibility(
  quoteType: QuoteType | string,
  fieldPath: string,
  value: any
): EligibilityAlert | null {
  const schema = SCHEMA_MAP[quoteType];
  if (!schema?.gatekeepers) return null;

  const gatekeeper = schema.gatekeepers.find(g => g.field === fieldPath);
  if (!gatekeeper) return null;

  if (evaluateCondition(gatekeeper.condition, value, {})) {
    const severity: AlertSeverity = gatekeeper.action === 'warn' ? 'yellow' : 'red';
    return {
      id: `${fieldPath}-${Date.now()}`,
      field: fieldPath,
      fieldLabel: getFieldLabel(fieldPath),
      triggeredValue: value,
      severity,
      action: gatekeeper.action,
      message: gatekeeper.message,
      agentScript: gatekeeper.agentScript,
      acknowledged: false,
      triggeredAt: new Date(),
    };
  }

  return null;
}
