// Transform MergedProfile → Gaya entities
// Maps customer profile data to Gaya's clipboard record format

import type { GayaEntity, GayaField } from '@/types/gaya';
import { GAYA_ENTITY_TYPES } from '@/types/gaya';
import type { MergedProfile, Policy } from '@/types/customer-profile';

// =============================================================================
// HELPERS
// =============================================================================

/** Add a field only if value is non-empty */
function addField(fields: GayaField[], name: string, value: string | number | undefined | null): void {
  if (value === null || value === undefined || value === '') return;
  fields.push({ name, value: String(value) });
}

/** Format date string to MM/DD/YYYY for Gaya */
function formatDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return undefined;
  }
}

/** Format currency amount */
function formatCurrency(amount?: number): string | undefined {
  if (amount === undefined || amount === null) return undefined;
  return amount.toFixed(2);
}

// =============================================================================
// ENTITY BUILDERS
// =============================================================================

function buildCustomerEntity(profile: MergedProfile): GayaEntity {
  const fields: GayaField[] = [];

  addField(fields, 'first_name', profile.firstName);
  addField(fields, 'last_name', profile.lastName);
  addField(fields, 'email', profile.contact?.email);
  addField(fields, 'phone_number', profile.contact?.phone);
  addField(fields, 'mobile_phone_number', profile.contact?.mobilePhone);
  addField(fields, 'date_of_birth', formatDate(profile.dateOfBirth));

  // Address - street field disabled (Gaya rejects all variations: address, street_address, address_line_1)
  if (profile.address) {
    // addField(fields, 'address_line_1', profile.address.street); // Gaya rejects this
    addField(fields, 'city', profile.address.city);
    addField(fields, 'state', profile.address.state);
    addField(fields, 'zip_code', profile.address.zip);
  }

  return {
    entity: GAYA_ENTITY_TYPES.CUSTOMER,
    index: 1,
    fields,
  };
}

// NOTE: household_member entity is not supported by Gaya's clipboard creation API
// Household data is only returned during PDF extraction, not accepted for creation
function buildHouseholdEntities(_profile: MergedProfile): GayaEntity[] {
  return [];
}

function buildVehicleEntities(profile: MergedProfile): GayaEntity[] {
  const entities: GayaEntity[] = [];
  let index = 1;

  for (const policy of profile.policies) {
    if (policy.type !== 'auto' || !policy.vehicles?.length) continue;

    for (const vehicle of policy.vehicles) {
      const fields: GayaField[] = [];
      addField(fields, 'year', vehicle.year);
      addField(fields, 'make', vehicle.make);
      addField(fields, 'model', vehicle.model);
      addField(fields, 'vin', vehicle.vin);
      // 'use' field not supported by Gaya API
      addField(fields, 'annual_mileage', vehicle.annualMiles);

      // Add vehicle-level coverages (comp/coll deductibles)
      if (vehicle.coverages?.length) {
        for (const cov of vehicle.coverages) {
          const covType = cov.type.toLowerCase();
          if (covType.includes('comprehensive') || covType === 'comp') {
            addField(fields, 'comprehensive_deductible', cov.deductible);
          } else if (covType.includes('collision') || covType === 'coll') {
            addField(fields, 'collision_deductible', cov.deductible);
          }
        }
      }

      if (fields.length > 0) {
        entities.push({
          entity: GAYA_ENTITY_TYPES.CAR,
          index: index++,
          fields,
        });
      }
    }
  }

  return entities;
}

function buildDriverEntities(profile: MergedProfile): GayaEntity[] {
  const entities: GayaEntity[] = [];
  const seenDrivers = new Set<string>(); // Avoid duplicates across policies
  let index = 1;

  for (const policy of profile.policies) {
    if (policy.type !== 'auto' || !policy.drivers?.length) continue;

    for (const driver of policy.drivers) {
      // Skip if we've already added this driver (by name)
      const driverKey = `${driver.firstName}-${driver.lastName}`.toLowerCase();
      if (seenDrivers.has(driverKey)) continue;
      seenDrivers.add(driverKey);

      const fields: GayaField[] = [];
      addField(fields, 'first_name', driver.firstName);
      addField(fields, 'last_name', driver.lastName);
      addField(fields, 'date_of_birth', formatDate(driver.dateOfBirth));
      addField(fields, 'license_number', driver.licenseNumber);
      addField(fields, 'license_state', driver.licenseState);
      addField(fields, 'gender', driver.gender);
      addField(fields, 'marital_status', driver.maritalStatus);

      if (fields.length > 0) {
        entities.push({
          entity: GAYA_ENTITY_TYPES.DRIVER,
          index: index++,
          fields,
        });
      }
    }
  }

  return entities;
}

function buildPropertyEntities(profile: MergedProfile): GayaEntity[] {
  const entities: GayaEntity[] = [];
  let index = 1;

  for (const policy of profile.policies) {
    if (!['home', 'flood'].includes(policy.type) || !policy.property) continue;

    const prop = policy.property;
    const fields: GayaField[] = [];

    if (prop.address) {
      // addField(fields, 'address_line_1', prop.address.street); // Gaya rejects this
      addField(fields, 'city', prop.address.city);
      addField(fields, 'state', prop.address.state);
      addField(fields, 'zip_code', prop.address.zip);
    }

    addField(fields, 'year_built', prop.yearBuilt);
    addField(fields, 'square_footage', prop.squareFeet);
    addField(fields, 'number_of_stories', prop.stories);
    addField(fields, 'construction_type', prop.constructionType);
    addField(fields, 'roof_type', prop.roofType);
    addField(fields, 'roof_year', prop.roofAge);
    addField(fields, 'heating_type', prop.heatingType);
    addField(fields, 'protection_class', prop.protectionClass);

    if (fields.length > 0) {
      entities.push({
        entity: GAYA_ENTITY_TYPES.PROPERTY,
        index: index++,
        fields,
      });
    }
  }

  return entities;
}

function buildPolicyEntity(policy: Policy, entityType: string, index: number): GayaEntity | null {
  const fields: GayaField[] = [];

  addField(fields, 'carrier_name', policy.carrier?.name);
  addField(fields, 'policy_number', policy.policyNumber);
  addField(fields, 'policy_effective_date', formatDate(policy.effectiveDate));
  addField(fields, 'policy_expiration_date', formatDate(policy.expirationDate));
  addField(fields, 'annual_premium', formatCurrency(policy.premium));

  // Add coverages - use Gaya's standard coverage field names
  // Note: Dynamic coverage field names may not be supported by Gaya
  // Only include well-known coverage types with standardized names
  if (policy.coverages?.length) {
    for (const cov of policy.coverages) {
      const covType = cov.type.toLowerCase();
      // Map to Gaya-compatible coverage names (skip if not a known mapping)
      const covMapping: Record<string, { limit?: string; deductible?: string }> = {
        'bodily injury': { limit: 'bodily_injury_liability' },
        'property damage': { limit: 'property_damage_liability' },
        'uninsured motorist': { limit: 'uninsured_motorist' },
        'comprehensive': { deductible: 'comprehensive_deductible' },
        'collision': { deductible: 'collision_deductible' },
        'dwelling': { limit: 'dwelling_coverage' },
        'personal property': { limit: 'personal_property_coverage' },
        'liability': { limit: 'liability_coverage' },
      };
      const mapping = covMapping[covType];
      if (mapping) {
        if (mapping.limit && cov.limit) addField(fields, mapping.limit, cov.limit);
        if (mapping.deductible && cov.deductible) addField(fields, mapping.deductible, cov.deductible);
      }
    }
  }

  if (fields.length === 0) return null;

  return { entity: entityType, index, fields };
}

function buildPolicyEntities(profile: MergedProfile): GayaEntity[] {
  const entities: GayaEntity[] = [];
  let autoIndex = 1;
  let homeIndex = 1;

  for (const policy of profile.policies) {
    if (policy.status !== 'active') continue;

    if (policy.type === 'auto') {
      const entity = buildPolicyEntity(policy, GAYA_ENTITY_TYPES.AUTO_POLICY, autoIndex);
      if (entity) {
        entities.push(entity);
        autoIndex++;
      }
    } else if (policy.type === 'home' || policy.type === 'flood') {
      const entity = buildPolicyEntity(policy, GAYA_ENTITY_TYPES.HOME_POLICY, homeIndex);
      if (entity) {
        entities.push(entity);
        homeIndex++;
      }
    }
  }

  return entities;
}

// =============================================================================
// MAIN TRANSFORMER
// =============================================================================

export interface TransformResult {
  entities: GayaEntity[];
  entityCount: number;
  error?: string;
}

/**
 * Transform a MergedProfile into Gaya clipboard entities.
 * Validates that at least email or phone is present.
 */
export function transformProfileToGayaEntities(profile: MergedProfile): TransformResult {
  // Validate: must have email or phone
  const hasEmail = !!profile.contact?.email;
  const hasPhone = !!profile.contact?.phone || !!profile.contact?.mobilePhone;

  if (!hasEmail && !hasPhone) {
    return {
      entities: [],
      entityCount: 0,
      error: 'Customer must have at least an email or phone number to send to Gaya',
    };
  }

  const entities: GayaEntity[] = [
    buildCustomerEntity(profile),
    ...buildHouseholdEntities(profile),
    ...buildDriverEntities(profile),
    ...buildVehicleEntities(profile),
    ...buildPropertyEntities(profile),
    // Policy entities disabled - Gaya doesn't accept auto_policy/home_policy for clipboard creation
    // ...buildPolicyEntities(profile),
  ];

  return {
    entities,
    entityCount: entities.length,
  };
}
