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
  addField(fields, 'phone', profile.contact?.phone);
  addField(fields, 'mobile_phone', profile.contact?.mobilePhone);
  addField(fields, 'date_of_birth', formatDate(profile.dateOfBirth));

  // Address
  if (profile.address) {
    addField(fields, 'street_address', profile.address.street);
    addField(fields, 'city', profile.address.city);
    addField(fields, 'state', profile.address.state);
    addField(fields, 'zip', profile.address.zip);
  }

  return {
    entity: GAYA_ENTITY_TYPES.CUSTOMER,
    index: 1,
    fields,
  };
}

function buildHouseholdEntities(profile: MergedProfile): GayaEntity[] {
  if (!profile.household?.length) return [];

  const entities: GayaEntity[] = [];
  let index = 1;

  for (const member of profile.household) {
    // Skip primary contact (already in customer entity)
    const isPrimary =
      member.firstName === profile.firstName &&
      member.lastName === profile.lastName;
    if (isPrimary) continue;

    const fields: GayaField[] = [];
    addField(fields, 'first_name', member.firstName);
    addField(fields, 'last_name', member.lastName);
    addField(fields, 'relationship', member.relationship);
    addField(fields, 'date_of_birth', formatDate(member.dateOfBirth));
    addField(fields, 'email', member.email);
    addField(fields, 'phone', member.phone);
    addField(fields, 'license_number', member.licenseNumber);
    addField(fields, 'license_state', member.licenseState);

    if (fields.length > 0) {
      entities.push({
        entity: GAYA_ENTITY_TYPES.HOUSEHOLD,
        index: index++,
        fields,
      });
    }
  }

  return entities;
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
      addField(fields, 'use', vehicle.use);
      addField(fields, 'annual_miles', vehicle.annualMiles);

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

function buildPropertyEntities(profile: MergedProfile): GayaEntity[] {
  const entities: GayaEntity[] = [];
  let index = 1;

  for (const policy of profile.policies) {
    if (!['home', 'flood'].includes(policy.type) || !policy.property) continue;

    const prop = policy.property;
    const fields: GayaField[] = [];

    if (prop.address) {
      addField(fields, 'street_address', prop.address.street);
      addField(fields, 'city', prop.address.city);
      addField(fields, 'state', prop.address.state);
      addField(fields, 'zip', prop.address.zip);
    }

    addField(fields, 'year_built', prop.yearBuilt);
    addField(fields, 'square_feet', prop.squareFeet);
    addField(fields, 'stories', prop.stories);
    addField(fields, 'construction_type', prop.constructionType);
    addField(fields, 'roof_type', prop.roofType);
    addField(fields, 'roof_age', prop.roofAge);
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

  addField(fields, 'carrier', policy.carrier?.name);
  addField(fields, 'policy_number', policy.policyNumber);
  addField(fields, 'effective_date', formatDate(policy.effectiveDate));
  addField(fields, 'expiration_date', formatDate(policy.expirationDate));
  addField(fields, 'premium', formatCurrency(policy.premium));

  // Add coverages
  if (policy.coverages?.length) {
    for (const cov of policy.coverages) {
      const covName = cov.type.toLowerCase().replace(/\s+/g, '_');
      if (cov.limit) addField(fields, `${covName}_limit`, cov.limit);
      if (cov.deductible) addField(fields, `${covName}_deductible`, cov.deductible);
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
    ...buildVehicleEntities(profile),
    ...buildPropertyEntities(profile),
    ...buildPolicyEntities(profile),
  ];

  return {
    entities,
    entityCount: entities.length,
  };
}
