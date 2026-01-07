// =============================================================================
// QUOTE SCHEMAS INDEX
// Export all quote schemas and utilities
// =============================================================================

export * from './types';
export { personalAutoSchema } from './personal-auto';
export { homeownersSchema } from './homeowners';

import { QuoteSchema, QuoteType } from './types';
import { personalAutoSchema } from './personal-auto';
import { homeownersSchema } from './homeowners';

// Registry of all available schemas
export const QUOTE_SCHEMAS: Record<QuoteType, QuoteSchema | null> = {
  personal_auto: personalAutoSchema,
  homeowners: homeownersSchema,
  auto_home_bundle: null,     // TODO: Implement
  recreational: null,         // TODO: Implement
  mobile_home: null,          // TODO: Implement
  commercial: null,           // TODO: Implement
  flood: null,                // TODO: Implement
};

// Get schema by type
export function getQuoteSchema(type: QuoteType): QuoteSchema | null {
  return QUOTE_SCHEMAS[type] || null;
}

// Get list of available quote types
export function getAvailableQuoteTypes(): { type: QuoteType; name: string; icon: string; available: boolean }[] {
  return [
    { type: 'personal_auto', name: 'Personal Auto', icon: '🚗', available: true },
    { type: 'homeowners', name: 'Homeowners', icon: '🏠', available: true },
    { type: 'auto_home_bundle', name: 'Auto + Home Bundle', icon: '🏡', available: false },
    { type: 'recreational', name: 'Recreational (Boat, RV, etc.)', icon: '🚤', available: false },
    { type: 'mobile_home', name: 'Mobile Home', icon: '🏘️', available: false },
    { type: 'commercial', name: 'Commercial', icon: '🏢', available: false },
    { type: 'flood', name: 'Flood Insurance', icon: '🌊', available: false },
  ];
}

// =============================================================================
// SCHEMA UTILITIES
// =============================================================================

/**
 * Calculate completeness percentage for a quote
 */
export function calculateCompleteness(schema: QuoteSchema, data: Record<string, any>, arrays: Record<string, any[]>): number {
  let requiredFields = 0;
  let completedFields = 0;

  for (const group of schema.groups) {
    if (group.isArray) {
      // For array groups, check if we have the minimum required items
      const items = arrays[group.key] || [];
      if (group.minItems && items.length >= group.minItems) {
        requiredFields++;
        completedFields++;
      } else if (group.minItems) {
        requiredFields++;
      }
      
      // Check required fields within each item
      for (const item of items) {
        for (const field of group.fields) {
          if (field.validation?.required && !shouldSkipField(field, { ...data, ...item })) {
            requiredFields++;
            if (item[field.key] !== undefined && item[field.key] !== '' && item[field.key] !== null) {
              completedFields++;
            }
          }
        }
      }
    } else {
      // For regular groups, check each field
      for (const field of group.fields) {
        if (field.validation?.required && !shouldSkipField(field, data)) {
          requiredFields++;
          if (data[field.key] !== undefined && data[field.key] !== '' && data[field.key] !== null) {
            completedFields++;
          }
        }
      }
    }
  }

  if (requiredFields === 0) return 100;
  return Math.round((completedFields / requiredFields) * 100);
}

/**
 * Check if a field should be skipped based on conditions
 */
export function shouldSkipField(field: { showIf?: string; skipIf?: string }, data: Record<string, any>): boolean {
  if (field.showIf) {
    try {
      // Simple condition evaluation
      const result = evaluateCondition(field.showIf, data);
      if (!result) return true;
    } catch {
      // If evaluation fails, don't skip
    }
  }
  
  if (field.skipIf) {
    try {
      const result = evaluateCondition(field.skipIf, data);
      if (result) return true;
    } catch {
      // If evaluation fails, don't skip
    }
  }
  
  return false;
}

/**
 * Simple condition evaluator for field visibility
 */
export function evaluateCondition(condition: string, data: Record<string, any>): boolean {
  // Replace field references with actual values
  let evalString = condition;
  
  // Handle simple equality: field === "value"
  const simpleMatch = condition.match(/^(\w+)\s*(===|!==|==|!=)\s*["']?([^"']+)["']?$/);
  if (simpleMatch) {
    const [, field, operator, value] = simpleMatch;
    const fieldValue = data[field];
    
    switch (operator) {
      case '===':
      case '==':
        return String(fieldValue) === value || fieldValue === (value === 'true' ? true : value === 'false' ? false : value);
      case '!==':
      case '!=':
        return String(fieldValue) !== value && fieldValue !== (value === 'true' ? true : value === 'false' ? false : value);
    }
  }
  
  // Handle boolean: field === true
  const boolMatch = condition.match(/^(\w+)\s*(===|!==)\s*(true|false)$/);
  if (boolMatch) {
    const [, field, operator, value] = boolMatch;
    const fieldValue = data[field];
    const boolValue = value === 'true';
    
    if (operator === '===' || operator === '==') {
      return fieldValue === boolValue;
    } else {
      return fieldValue !== boolValue;
    }
  }
  
  // Handle AND conditions
  if (condition.includes(' && ')) {
    const parts = condition.split(' && ');
    return parts.every(part => evaluateCondition(part.trim(), data));
  }
  
  // Handle OR conditions
  if (condition.includes(' || ')) {
    const parts = condition.split(' || ');
    return parts.some(part => evaluateCondition(part.trim(), data));
  }
  
  return false;
}

/**
 * Get missing required fields for a schema
 */
export function getMissingFields(schema: QuoteSchema, data: Record<string, any>, arrays: Record<string, any[]>): string[] {
  const missing: string[] = [];

  for (const group of schema.groups) {
    if (group.isArray) {
      const items = arrays[group.key] || [];
      if (group.minItems && items.length < group.minItems) {
        missing.push(`At least ${group.minItems} ${group.itemLabel || group.label} required`);
      }
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        for (const field of group.fields) {
          if (field.validation?.required && !shouldSkipField(field, { ...data, ...item })) {
            if (item[field.key] === undefined || item[field.key] === '' || item[field.key] === null) {
              missing.push(`${group.itemLabel || group.label} ${i + 1}: ${field.label}`);
            }
          }
        }
      }
    } else {
      for (const field of group.fields) {
        if (field.validation?.required && !shouldSkipField(field, data)) {
          if (data[field.key] === undefined || data[field.key] === '' || data[field.key] === null) {
            missing.push(field.label);
          }
        }
      }
    }
  }

  return missing;
}

/**
 * Get next fields to collect based on current data
 */
export function getNextFieldsToCollect(schema: QuoteSchema, data: Record<string, any>, arrays: Record<string, any[]>, limit = 5): string[] {
  const suggestions: string[] = [];

  for (const group of schema.groups) {
    if (suggestions.length >= limit) break;

    if (group.isArray) {
      const items = arrays[group.key] || [];
      if (group.minItems && items.length < group.minItems) {
        suggestions.push(`Add ${group.itemLabel || group.label}`);
        continue;
      }
      
      for (const item of items) {
        for (const field of group.fields) {
          if (suggestions.length >= limit) break;
          if (field.validation?.required && !shouldSkipField(field, { ...data, ...item })) {
            if (item[field.key] === undefined || item[field.key] === '' || item[field.key] === null) {
              suggestions.push(field.label);
            }
          }
        }
      }
    } else {
      for (const field of group.fields) {
        if (suggestions.length >= limit) break;
        if (field.validation?.required && !shouldSkipField(field, data)) {
          if (data[field.key] === undefined || data[field.key] === '' || data[field.key] === null) {
            suggestions.push(field.label);
          }
        }
      }
    }
  }

  return suggestions;
}
