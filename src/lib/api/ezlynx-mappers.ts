/**
 * EZLynx Data Mappers
 * ===================
 * Convert between TCDS-Triage data formats and EZLynx Bot API formats.
 */

import type { CreateApplicantData, UpdateApplicantData } from './ezlynx-bot';

// =============================================================================
// HELPERS
// =============================================================================

/** Convert MM/DD/YYYY or ISO to YYYY-MM-DD for EZLynx API */
function toEzlynxDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // If ISO date
  if (dateStr.includes('T')) return dateStr.split('T')[0];
  // If MM/DD/YYYY
  const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) return `${parts[3]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  // Try parsing as Date
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return undefined;
}

/** Strip phone to digits only */
function cleanPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : undefined;
}

/** Map gender from various formats to EZLynx expected values */
function mapGender(gender?: string | null): string | undefined {
  if (!gender) return undefined;
  const g = gender.toLowerCase().trim();
  if (g === 'm' || g === 'male') return 'Male';
  if (g === 'f' || g === 'female') return 'Female';
  return undefined;
}

/** Map marital status from various formats */
function mapMaritalStatus(status?: string | null): string | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase().trim();
  if (s.includes('single') || s === 's') return 'Single';
  if (s.includes('married') || s === 'm') return 'Married';
  if (s.includes('divorced') || s === 'd') return 'Divorced';
  if (s.includes('widowed') || s === 'w') return 'Widowed';
  if (s.includes('separated')) return 'Separated';
  if (s.includes('domestic')) return 'Domestic Partner';
  return status; // pass through if unrecognized
}

// =============================================================================
// CUSTOMER → APPLICANT
// =============================================================================

/**
 * Convert a TCDS MergedProfile to EZLynx Bot create-smart body.
 * Works with the full merged profile from /api/customers/[id]/merged-profile.
 */
export function customerToApplicant(profile: any): CreateApplicantData {
  const data: CreateApplicantData = {
    firstName: profile.firstName || profile.name?.split(' ')[0] || '',
    lastName: profile.lastName || profile.name?.split(' ').slice(1).join(' ') || '',
    dateOfBirth: toEzlynxDate(profile.dateOfBirth),
    gender: mapGender(profile.household?.[0]?.gender),
    maritalStatus: mapMaritalStatus(profile.household?.[0]?.maritalStatus),
    email: profile.contact?.email,
    phone: cleanPhone(profile.contact?.phone || profile.contact?.mobilePhone),
    addressLine1: profile.address?.street,
    addressCity: profile.address?.city,
    addressState: profile.address?.state,
    addressZip: profile.address?.zip,
  };

  // Add co-applicant if there's a spouse/partner in household
  const spouse = profile.household?.find((m: any) =>
    m.relationship && /spouse|partner|wife|husband/i.test(m.relationship)
  );
  if (spouse) {
    data.coApplicant = {
      firstName: spouse.firstName || spouse.name?.split(' ')[0] || '',
      lastName: spouse.lastName || spouse.name?.split(' ').slice(1).join(' ') || '',
      dateOfBirth: toEzlynxDate(spouse.dateOfBirth),
      gender: mapGender(spouse.gender),
      relationship: 'Spouse',
    };
  }

  return data;
}

/**
 * Build an update payload from a TCDS profile to push to an existing EZLynx applicant.
 */
export function customerToUpdatePayload(profile: any): UpdateApplicantData {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: toEzlynxDate(profile.dateOfBirth),
    email: profile.contact?.email,
    phone: cleanPhone(profile.contact?.phone || profile.contact?.mobilePhone),
    addressLine1: profile.address?.street,
    addressCity: profile.address?.city,
    addressState: profile.address?.state,
    addressZip: profile.address?.zip,
  };
}

// =============================================================================
// POLICY → HOME QUOTE
// =============================================================================

/**
 * Convert a TCDS policy (home type) + customer to EZLynx bot home quote body.
 * Used for reshop and Quote push scenarios.
 */
export function policyToHomeQuote(policy: any, customer: any, renewalSnapshot?: any): any {
  const property = renewalSnapshot?.property || policy.property;
  const coverages = renewalSnapshot?.coverages || policy.coverages || [];

  // Map coverage codes to EZLynx field names
  const coverageMap: Record<string, string> = {};
  for (const cov of coverages) {
    const code = (cov.type || cov.code || '').toUpperCase();
    if (code === 'DWELL' || code === 'DWEL') coverageMap.dwellingCoverage = cov.limit;
    if (code === 'PERS') coverageMap.personalProperty = cov.limit;
    if (code === 'LIAB') coverageMap.personalLiability = cov.limit;
    if (code === 'LOSS') coverageMap.lossOfUse = cov.limit;
    if (code === 'MEDC' || code === 'MEDPAY') coverageMap.medicalPayments = cov.limit;
    if (cov.deductible) coverageMap.deductible = cov.deductible;
  }

  return {
    // Property info
    yearBuilt: property?.yearBuilt || renewalSnapshot?.baselineSnapshot?.propertyContext?.yearBuilt,
    squareFeet: property?.squareFeet || renewalSnapshot?.baselineSnapshot?.propertyContext?.sqFt,
    roofType: property?.roofType || renewalSnapshot?.baselineSnapshot?.propertyContext?.roofType,
    constructionType: property?.constructionType,
    stories: property?.stories,
    protectionClass: property?.protectionClass,

    // Address
    propertyAddress: customer?.address?.street || property?.address?.street,
    propertyCity: customer?.address?.city || property?.address?.city,
    propertyState: customer?.address?.state || property?.address?.state,
    propertyZip: customer?.address?.zip || property?.address?.zip,

    // Coverages
    ...coverageMap,
  };
}

// =============================================================================
// POLICY → AUTO QUOTE
// =============================================================================

/**
 * Convert a TCDS policy (auto type) + customer to EZLynx bot auto quote body.
 */
export function policyToAutoQuote(policy: any, customer: any, renewalSnapshot?: any): any {
  const vehicles = renewalSnapshot?.vehicles || policy.vehicles || [];
  const drivers = renewalSnapshot?.drivers || policy.drivers || [];
  const coverages = renewalSnapshot?.coverages || policy.coverages || [];

  return {
    vehicles: vehicles.map((v: any) => ({
      year: v.year,
      make: v.make,
      model: v.model,
      vin: v.vin,
      use: v.use || v.primaryUse,
      annualMiles: v.annualMiles,
    })),
    drivers: drivers.map((d: any) => ({
      firstName: d.firstName,
      lastName: d.lastName,
      dateOfBirth: toEzlynxDate(d.dateOfBirth || d.dob),
      gender: mapGender(d.gender),
      maritalStatus: mapMaritalStatus(d.maritalStatus),
      licenseNumber: d.licenseNumber,
      licenseState: d.licenseState,
      relationship: d.relationship,
    })),
    // Policy-level coverage limits
    bodilyInjuryLimit: findCoverageLimit(coverages, ['BI', 'BIPD']),
    propertyDamageLimit: findCoverageLimit(coverages, ['PD']),
    uninsuredMotoristLimit: findCoverageLimit(coverages, ['UM', 'UMBI']),
    medicalPaymentsLimit: findCoverageLimit(coverages, ['MEDPM', 'MEDPAY', 'MP', 'PIP']),
    comprehensiveDeductible: findCoverageDeductible(coverages, ['COMP', 'OTC']),
    collisionDeductible: findCoverageDeductible(coverages, ['COLL']),
  };
}

// =============================================================================
// QUOTE RECORD → EZLYNX
// =============================================================================

/**
 * Convert a TCDS quotes table record to EZLynx bot quote body.
 * Used from the Quotes page "Push to EZLynx" action.
 */
export function quoteRecordToEzlynx(quote: any): { type: 'home' | 'auto'; data: any } {
  const type = quote.type?.includes('auto') ? 'auto' : 'home';

  if (type === 'auto') {
    return {
      type: 'auto',
      data: {
        vehicles: quote.vehicles || [],
        drivers: quote.drivers || [],
      },
    };
  }

  return {
    type: 'home',
    data: {
      yearBuilt: quote.property?.yearBuilt,
      squareFeet: quote.property?.squareFeet,
      roofType: quote.property?.roofType,
      constructionType: quote.property?.constructionType,
      propertyAddress: quote.property?.address?.street,
      propertyCity: quote.property?.address?.city,
      propertyState: quote.property?.address?.state,
      propertyZip: quote.property?.address?.zip,
    },
  };
}

// =============================================================================
// RENEWAL → QUOTE DATA
// =============================================================================

/**
 * Convert renewal comparison data to EZLynx bot quote body.
 * Used for the "Update for Reshop" action on the renewal detail page.
 */
export function renewalToQuoteData(
  comparison: any,
  snapshot: any,
  customer: any
): { type: 'home' | 'auto'; data: any } {
  const lob = (comparison?.lineOfBusiness || snapshot?.lineOfBusiness || '').toLowerCase();
  const isAuto = lob.includes('auto');

  if (isAuto) {
    return {
      type: 'auto',
      data: policyToAutoQuote(
        { vehicles: snapshot?.vehicles, drivers: snapshot?.drivers, coverages: snapshot?.coverages },
        customer,
        snapshot
      ),
    };
  }

  return {
    type: 'home',
    data: policyToHomeQuote(
      { property: snapshot?.property, coverages: snapshot?.coverages },
      customer,
      { property: snapshot?.property, coverages: snapshot?.coverages, baselineSnapshot: snapshot?.baselineSnapshot }
    ),
  };
}

// =============================================================================
// LEAD → APPLICANT
// =============================================================================

/**
 * Convert a TCDS lead queue entry to EZLynx Bot applicant creation data.
 */
export function leadToApplicant(lead: any): CreateApplicantData {
  const nameParts = (lead.contactName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || firstName; // fallback: use firstName as lastName

  // Parse address if it's a single string
  let addressLine1: string | undefined;
  let addressCity: string | undefined;
  let addressState: string | undefined;
  let addressZip: string | undefined;

  if (lead.contactAddress) {
    // Try to parse "123 Main St, City, ST 12345" format
    const parts = lead.contactAddress.split(',').map((s: string) => s.trim());
    if (parts.length >= 3) {
      addressLine1 = parts[0];
      addressCity = parts[1];
      const stateZip = parts[2].match(/^([A-Z]{2})\s*(\d{5})?/i);
      if (stateZip) {
        addressState = stateZip[1];
        addressZip = stateZip[2];
      }
    } else {
      addressLine1 = lead.contactAddress;
    }
  }

  return {
    firstName,
    lastName,
    email: lead.contactEmail || undefined,
    phone: cleanPhone(lead.contactPhone),
    addressLine1,
    addressCity,
    addressState,
    addressZip,
  };
}

// =============================================================================
// CANOPY CONNECT → EZLYNX APPLICANT
// =============================================================================

/**
 * Convert a Canopy Connect pull record → EZLynx CreateApplicantData.
 * Maps personal info, address, phones, co-applicant from the pull record.
 */
export function canopyPullToApplicant(pull: any): CreateApplicantData {
  const drivers = pull.drivers || [];
  // Find primary driver — try is_primary flag, then match by first/last name, then first entry
  const primaryDriver = drivers.find((d: any) => d.is_primary)
    || drivers.find((d: any) =>
      (d.first_name || '').toLowerCase() === (pull.firstName || '').toLowerCase()
      && (d.last_name || '').toLowerCase() === (pull.lastName || '').toLowerCase()
    )
    || drivers[0];

  // DOB: try pull-level first, then primary driver's date_of_birth_str
  const dob = pull.date_of_birth || pull.dateOfBirth
    || primaryDriver?.date_of_birth_str || primaryDriver?.date_of_birth || primaryDriver?.dateOfBirth;

  // Address: pull.address may be empty {} — fall back to first vehicle's garaging address
  const pullAddr = pull.address && Object.keys(pull.address).length > 0 ? pull.address : null;
  const garagingAddr = (pull.vehicles || [])[0]?.garaging_address || (pull.vehicles || [])[0]?.GaragingAddress;
  const addr = pullAddr || garagingAddr;
  const isGaragingFormat = !pullAddr && !!garagingAddr; // garaging has number/street/type instead of street_one

  let addrLine1: string | undefined;
  let addrCity: string | undefined;
  let addrState: string | undefined;
  let addrZip: string | undefined;

  if (addr) {
    if (isGaragingFormat) {
      // Garaging address: compose from full_address or number+street+type parts
      if (addr.full_address) {
        addrLine1 = addr.full_address.split(',')[0]?.trim();
      } else if (addr.number) {
        addrLine1 = `${addr.number} ${addr.street || ''} ${addr.type || ''}`.trim();
      }
    } else {
      // Standard Canopy address: street_one or address1
      addrLine1 = addr.street_one || addr.address1 || addr.street || undefined;
    }
    addrCity = addr.city || undefined;
    addrState = addr.state || undefined;
    addrZip = addr.zip || addr.zipCode || undefined;
  }

  const data: CreateApplicantData = {
    firstName: pull.first_name || pull.firstName || '',
    lastName: pull.last_name || pull.lastName || '',
    dateOfBirth: toEzlynxDate(dob),
    email: pull.email || pull.account_email || undefined,
    phone: formatPhoneEzlynx(pull.phone || pull.mobile_phone),
    addressLine1: addrLine1,
    addressCity: addrCity,
    addressState: addrState,
    addressZip: addrZip,
    gender: mapGender(primaryDriver?.gender),
    maritalStatus: mapMaritalStatus(primaryDriver?.marital_status || primaryDriver?.maritalStatus),
  };

  // Co-applicant from secondary insured
  const si = pull.secondaryInsured || pull.secondary_insured;
  if (si?.firstName || si?.first_name) {
    data.coApplicant = {
      firstName: si.firstName || si.first_name || '',
      lastName: si.lastName || si.last_name || pull.last_name || pull.lastName || '',
      dateOfBirth: toEzlynxDate(si.dateOfBirth || si.date_of_birth || si.date_of_birth_str),
      relationship: mapCanopyRelationshipToCoApplicant(si.relationship),
    };
  }

  return data;
}

/**
 * Convert a Canopy pull → EZLynx Auto Quote data.
 * Maps vehicles, drivers, and coverages using EZLynx auto-specific enums.
 */
export function canopyPullToAutoQuote(pull: any): any {
  const vehicles = (pull.vehicles || []).map((v: any) => ({
    year: v.year,
    make: (v.make || '').toUpperCase(),
    model: (v.model || '').toUpperCase(),
    vin: v.vin || undefined,
    use: mapCanopyVehicleUsage(v.usage),
    annualMiles: v.annual_mileage || v.annualMileage || undefined,
    ownership: mapCanopyOwnership(v.ownership),
  }));

  // Deduplicate drivers: same person can appear from CARRIER + CONSUMER sources.
  // Merge by matching first_name. Prefer CONSUMER data (has DOB, DL#) over CARRIER.
  const rawDrivers = pull.drivers || [];
  const driverMap = new Map<string, any>();
  for (const d of rawDrivers) {
    const key = (d.first_name || '').toLowerCase().trim();
    const existing = driverMap.get(key);
    if (!existing) {
      driverMap.set(key, { ...d });
    } else {
      // Merge: non-null fields from this entry fill in gaps
      for (const [k, v] of Object.entries(d)) {
        if (v != null && v !== '' && (existing[k] == null || existing[k] === '')) {
          existing[k] = v;
        }
      }
    }
  }

  const drivers = Array.from(driverMap.values()).map((d: any) => ({
    firstName: (d.first_name || d.firstName || '').toUpperCase(),
    lastName: (d.last_name || d.lastName || '').toUpperCase(),
    dateOfBirth: toEzlynxDate(d.date_of_birth_str || d.date_of_birth || d.dateOfBirth),
    gender: mapCanopyAutoDriverGender(d.gender),
    maritalStatus: mapCanopyAutoDriverMarital(d.marital_status || d.maritalStatus),
    licenseNumber: d.drivers_license || d.license_number || d.licenseNumber || undefined,
    licenseState: d.license_state || d.licenseState || undefined,
    licenseStatus: mapCanopyLicenseStatus(d.license_status || d.licenseStatus),
    relationship: mapCanopyRelationshipToDriver(d.relationship),
    isPrimary: d.is_primary || d.isPrimary || false,
  }));

  // General coverages — collect from pull.coverages AND from vehicle-level coverages (first vehicle)
  // Canopy uses names like BODILY_INJURY_LIABILITY, PROPERTY_DAMAGE_LIABILITY, etc.
  const pullCoverages = pull.coverages || [];
  const firstVehicleCovs = (pull.vehicles || [])[0]?.coverages || [];
  const allCoverages = [...pullCoverages, ...firstVehicleCovs];
  const biCov = findCanopyCoverage(allCoverages, ['bodily_injury', 'bi', 'bodily_injury_liability']);
  const pdCov = findCanopyCoverage(allCoverages, ['property_damage', 'pd', 'property_damage_liability']);
  const umCov = findCanopyCoverage(allCoverages, ['uninsured_motorist', 'um', 'uninsured_and_underinsured_motorist_bodily_injury_liability', 'uninsured_motorist_bodily_injury']);
  const uimCov = findCanopyCoverage(allCoverages, ['underinsured_motorist', 'uim', 'underinsured_motorist_bodily_injury']);
  const mpCov = findCanopyCoverage(allCoverages, ['medical_payments', 'med_pay', 'medical_payments_coverage']);

  const generalCoverage: any = {};
  if (biCov) {
    generalCoverage.bodilyInjury = canopyCentsToBILimit(biCov.per_person_limit_cents, biCov.per_incident_limit_cents);
  }
  if (pdCov) generalCoverage.propertyDamage = canopyCentsToLimit(pdCov.per_incident_limit_cents, PD_ENUMS);
  if (umCov) generalCoverage.uninsuredMotorist = canopyCentsToBILimit(umCov.per_person_limit_cents, umCov.per_incident_limit_cents, UM_ENUMS);
  if (uimCov) generalCoverage.underinsuredMotorist = canopyCentsToBILimit(uimCov.per_person_limit_cents, uimCov.per_incident_limit_cents, UM_ENUMS);
  if (mpCov) generalCoverage.medicalPayments = canopyCentsToLimit(mpCov.per_person_limit_cents || mpCov.per_incident_limit_cents, MEDPAY_ENUMS);

  // Per-vehicle coverages
  const vehicleCoverages = (pull.vehicles || []).map((v: any, idx: number) => {
    const vCovs = v.coverages || [];
    const compCov = findCanopyCoverage(vCovs, ['comprehensive', 'comp', 'other_than_collision']);
    const collCov = findCanopyCoverage(vCovs, ['collision', 'coll']);
    const towCov = findCanopyCoverage(vCovs, ['towing', 'roadside', 'towing_and_labor', 'roadside_assistance']);
    const rentalCov = findCanopyCoverage(vCovs, ['rental', 'rental_reimbursement', 'transportation_expense']);

    return {
      vehicleIndex: idx,
      compDeductible: compCov ? canopyCentsToDeductible(compCov.deductible_cents) : undefined,
      collDeductible: collCov ? canopyCentsToDeductible(collCov.deductible_cents) : undefined,
      towing: towCov ? canopyCentsToLimit(towCov.per_incident_limit_cents) : undefined,
      rental: rentalCov ? canopyCentsToLimit(rentalCov.per_incident_limit_cents) : undefined,
    };
  });

  // Policy info
  const policy = (pull.policies || [])[0];
  const policyInfo: any = {};
  if (policy?.effective_date) policyInfo.effectiveDate = toEzlynxDate(policy.effective_date);
  if (policy?.expiry_date) policyInfo.priorPolicyExpirationDate = toEzlynxDate(policy.expiry_date);
  if (pull.insurance_provider_name) policyInfo.priorCarrier = pull.insurance_provider_name;

  return {
    vehicles,
    drivers,
    generalCoverage,
    vehicleCoverages,
    ...policyInfo,
  };
}

/**
 * Convert a Canopy pull → EZLynx Home Quote data.
 * Maps dwelling info and home coverages.
 */
export function canopyPullToHomeQuote(pull: any): any {
  const dwelling = (pull.dwellings || [])[0] || {};
  const coverages = pull.coverages || dwelling.coverages || [];

  // Dwelling info
  const dwellingInfo: any = {};
  if (dwelling.year_built) dwellingInfo.yearBuilt = String(dwelling.year_built);
  if (dwelling.square_feet) dwellingInfo.squareFootage = String(dwelling.square_feet);
  if (dwelling.construction_type) dwellingInfo.exteriorWall = mapCanopyConstruction(dwelling.construction_type);
  if (dwelling.roof_type) dwellingInfo.roofType = mapCanopyRoofType(dwelling.roof_type);
  if (dwelling.roof_year) dwellingInfo.roofingUpdateYear = String(dwelling.roof_year);
  if (dwelling.heating_type) dwellingInfo.heatingFuelType = dwelling.heating_type;
  if (dwelling.dwelling_type) dwellingInfo.residenceType = dwelling.dwelling_type;

  // Property address
  const propAddr = dwelling.address || pull.address;
  const propertyAddress: any = {};
  if (propAddr) {
    propertyAddress.propertyAddress = propAddr.street_one || propAddr.street;
    propertyAddress.propertyCity = propAddr.city;
    propertyAddress.propertyState = propAddr.state;
    propertyAddress.propertyZip = propAddr.zip;
  }

  // Home coverages
  const dwellingCov = findCanopyCoverage(coverages, ['dwelling', 'dwelling_coverage']);
  const otherStructCov = findCanopyCoverage(coverages, ['other_structures', 'other_structure']);
  const personalPropCov = findCanopyCoverage(coverages, ['personal_property', 'contents']);
  const liabCov = findCanopyCoverage(coverages, ['personal_liability', 'liability', 'family_liability_protection']);
  const medCov = findCanopyCoverage(coverages, ['medical_payments', 'med_pay']);
  const deductCov = findCanopyCoverage(coverages, ['all_peril', 'all_perils', 'all_other_perils', 'deductible']);
  const aleCov = findCanopyCoverage(coverages, ['additional_living_expense', 'loss_of_use']);
  const windHailCov = findCanopyCoverage(coverages, ['windstorm_or_hail', 'wind_hail', 'windstorm']);
  const hurricaneCov = findCanopyCoverage(coverages, ['hurricane']);

  const homeCoverage: any = {};
  if (dwellingCov?.per_incident_limit_cents) homeCoverage.dwellingLimit = Math.round(dwellingCov.per_incident_limit_cents / 100);
  if (otherStructCov?.per_incident_limit_cents) homeCoverage.otherStructuresLimit = Math.round(otherStructCov.per_incident_limit_cents / 100);
  if (personalPropCov?.per_incident_limit_cents) homeCoverage.personalPropertyLimit = Math.round(personalPropCov.per_incident_limit_cents / 100);
  if (liabCov?.per_incident_limit_cents) homeCoverage.personalLiabilityLimit = Math.round(liabCov.per_incident_limit_cents / 100);
  if (medCov?.per_incident_limit_cents || medCov?.per_person_limit_cents) {
    homeCoverage.medicalPaymentsLimit = Math.round((medCov.per_incident_limit_cents || medCov.per_person_limit_cents) / 100);
  }
  if (deductCov?.deductible_cents) homeCoverage.allPerilDeductible = Math.round(deductCov.deductible_cents / 100);
  if (aleCov?.per_incident_limit_cents) homeCoverage.lossOfUseLimit = Math.round(aleCov.per_incident_limit_cents / 100);
  if (windHailCov?.deductible_cents) homeCoverage.windHailDeductible = Math.round(windHailCov.deductible_cents / 100);
  if (hurricaneCov?.deductible_cents) homeCoverage.hurricaneDeductible = Math.round(hurricaneCov.deductible_cents / 100);

  // Policy info
  const policy = (pull.policies || []).find((p: any) => (p.type || '').toLowerCase().includes('home')) || (pull.policies || [])[0];
  const policyInfo: any = {};
  if (policy?.effective_date) policyInfo.effectiveDate = toEzlynxDate(policy.effective_date);
  if (policy?.expiry_date) policyInfo.priorPolicyExpirationDate = toEzlynxDate(policy.expiry_date);
  if (pull.insurance_provider_name) policyInfo.priorCarrier = pull.insurance_provider_name;

  return {
    ...dwellingInfo,
    ...propertyAddress,
    ...homeCoverage,
    ...policyInfo,
  };
}

// =============================================================================
// CANOPY HELPER FUNCTIONS
// =============================================================================

// EZLynx coverage enum objects: { value, name, description }
// Each coverage field has its own enum list. The `value` (int) is authoritative;
// `name` must be non-null for the API to accept the object.

type EzEnum = { value: number; name: string; description: string };

// BI split-limit enum (value → name/description)
const BI_ENUMS: EzEnum[] = [
  { value: 0, name: 'NoCoverage', description: 'No Coverage' },
  { value: 1, name: 'StateMinimum', description: 'State Minimum' },
  { value: 2, name: 'Item1020', description: '10/20' },
  { value: 3, name: 'Item1225', description: '12/25' },
  { value: 4, name: 'Item12525', description: '12.5/25' },
  { value: 5, name: 'Item1530', description: '15/30' },
  { value: 6, name: 'Item2040', description: '20/40' },
  { value: 7, name: 'Item2050', description: '20/50' },
  { value: 8, name: 'Item2525', description: '25/25' },
  { value: 9, name: 'Item2550', description: '25/50' },
  { value: 10, name: 'Item2565', description: '25/65' },
  { value: 11, name: 'Item3060', description: '30/60' },
  { value: 12, name: 'Item3065', description: '30/65' },
  { value: 13, name: 'Item3570', description: '35/70' },
  { value: 14, name: 'Item5050', description: '50/50' },
  { value: 15, name: 'Item50100', description: '50/100' },
  { value: 16, name: 'Item60120', description: '60/120' },
  { value: 17, name: 'Item100100', description: '100/100' },
  { value: 18, name: 'Item100200', description: '100/200' },
  { value: 19, name: 'Item100300', description: '100/300' },
  { value: 20, name: 'Item200600', description: '200/600' },
  { value: 21, name: 'Item250500', description: '250/500' },
  { value: 22, name: 'Item300300', description: '300/300' },
  { value: 23, name: 'Item500500', description: '500/500' },
  { value: 24, name: 'Item5001000', description: '500/1000' },
  { value: 25, name: 'Item10001000', description: '1000/1000' },
];

// UM enum (different value→name mapping than BI)
const UM_ENUMS: EzEnum[] = [
  { value: 0, name: 'Reject', description: 'Reject' },
  { value: 1, name: 'StateMinimum', description: 'State Minimum' },
  { value: 2, name: 'Item1020', description: '10/20' },
  { value: 3, name: 'Item1225', description: '12/25' },
  { value: 4, name: 'Item12525', description: '12.5/25' },
  { value: 5, name: 'Item1530', description: '15/30' },
  { value: 6, name: 'Item2040', description: '20/40' },
  { value: 7, name: 'Item2050', description: '20/50' },
  { value: 8, name: 'Item2525', description: '25/25' },
  { value: 9, name: 'Item2550', description: '25/50' },
  { value: 10, name: 'Item2560', description: '25/60' },
  { value: 11, name: 'Item2565', description: '25/65' },
  { value: 12, name: 'Item3060', description: '30/60' },
  { value: 13, name: 'Item3065', description: '30/65' },
  { value: 14, name: 'Item3570', description: '35/70' },
  { value: 15, name: 'Item3580', description: '35/80' },
  { value: 16, name: 'Item4090', description: '40/90' },
  { value: 17, name: 'Item5050', description: '50/50' },
  { value: 18, name: 'Item50100', description: '50/100' },
  { value: 19, name: 'Item60120', description: '60/120' },
  { value: 20, name: 'Item100100', description: '100/100' },
  { value: 21, name: 'Item100200', description: '100/200' },
  { value: 22, name: 'Item100300', description: '100/300' },
  { value: 23, name: 'Item200400', description: '200/400' },
  { value: 24, name: 'Item200600', description: '200/600' },
  { value: 25, name: 'Item250500', description: '250/500' },
  { value: 26, name: 'Item2501000', description: '250/1000' },
  { value: 27, name: 'Item300300', description: '300/300' },
  { value: 28, name: 'Item300500', description: '300/500' },
  { value: 29, name: 'Item500500', description: '500/500' },
  { value: 30, name: 'Item5001000', description: '500/1000' },
  { value: 31, name: 'Item10001000', description: '1000/1000' },
];

// PD single-limit enum
const PD_ENUMS: EzEnum[] = [
  { value: 0, name: 'NoCoverage', description: 'No Coverage' },
  { value: 1, name: 'StateMinimum', description: 'State Minimum' },
  { value: 2, name: 'Item5000', description: '5000' },
  { value: 3, name: 'Item7500', description: '7500' },
  { value: 4, name: 'Item10000', description: '10000' },
  { value: 5, name: 'Item15000', description: '15000' },
  { value: 6, name: 'Item20000', description: '20000' },
  { value: 7, name: 'Item25000', description: '25000' },
  { value: 8, name: 'Item30000', description: '30000' },
  { value: 9, name: 'Item35000', description: '35000' },
  { value: 10, name: 'Item40000', description: '40000' },
  { value: 11, name: 'Item50000', description: '50000' },
  { value: 12, name: 'Item100000', description: '100000' },
  { value: 13, name: 'Item250000', description: '250000' },
  { value: 14, name: 'Item300000', description: '300000' },
  { value: 15, name: 'Item500000', description: '500000' },
];

// MedPay enum
const MEDPAY_ENUMS: EzEnum[] = [
  { value: 0, name: 'None', description: 'None' },
  { value: 1, name: 'Item500', description: '500' },
  { value: 2, name: 'Item1000', description: '1000' },
  { value: 3, name: 'Item2000', description: '2000' },
  { value: 4, name: 'Item2500', description: '2500' },
  { value: 5, name: 'Item5000', description: '5000' },
  { value: 6, name: 'Item10000', description: '10000' },
  { value: 7, name: 'Item15000', description: '15000' },
  { value: 8, name: 'Item25000', description: '25000' },
  { value: 9, name: 'Item50000', description: '50000' },
  { value: 10, name: 'Item100000', description: '100000' },
];

// Comp/Coll deductible enum (shared)
const DEDUCTIBLE_ENUMS: EzEnum[] = [
  { value: 0, name: 'NoCoverage', description: 'No Coverage' },
  { value: 1, name: 'Item0', description: '0' },
  { value: 2, name: 'Item50', description: '50' },
  { value: 3, name: 'Item100', description: '100' },
  { value: 4, name: 'Item200', description: '200' },
  { value: 5, name: 'Item250', description: '250' },
  { value: 6, name: 'Item300', description: '300' },
  { value: 7, name: 'Item500', description: '500' },
  { value: 8, name: 'Item750', description: '750' },
  { value: 9, name: 'Item1000', description: '1000' },
  { value: 10, name: 'Item1500', description: '1500' },
  { value: 11, name: 'Item2000', description: '2000' },
  { value: 12, name: 'Item2500', description: '2500' },
];

/** Look up an EZLynx enum by its Item name */
function findEnum(enums: EzEnum[], itemName: string): EzEnum | undefined {
  return enums.find(e => e.name === itemName);
}

/** Convert cents to EZLynx single-limit enum object for PD/MedPay */
export function canopyCentsToLimit(cents?: number | null, enumList?: EzEnum[]): EzEnum | undefined {
  if (!cents) return undefined;
  const dollars = Math.round(cents / 100);
  const name = `Item${dollars}`;
  return findEnum(enumList || PD_ENUMS, name);
}

/** Convert BI per-person/per-accident cents to EZLynx split-limit enum object */
function canopyCentsToBILimit(perPersonCents?: number | null, perAccidentCents?: number | null, enumList?: EzEnum[]): EzEnum | undefined {
  if (!perPersonCents || !perAccidentCents) return undefined;
  const pp = Math.round(perPersonCents / 100000); // in thousands
  const pa = Math.round(perAccidentCents / 100000);
  const name = `Item${pp}${pa}`;
  return findEnum(enumList || BI_ENUMS, name);
}

/** Convert deductible cents to EZLynx deductible enum object */
export function canopyCentsToDeductible(cents?: number | null): EzEnum | undefined {
  if (!cents) return undefined;
  const dollars = Math.round(cents / 100);
  const name = `Item${dollars}`;
  return findEnum(DEDUCTIBLE_ENUMS, name);
}

/** Map Canopy roof type to EZLynx enum */
export function mapCanopyRoofType(type?: string | null): string | undefined {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t.includes('shingle') || t.includes('asphalt')) return 'COMPOSITESHINGLES';
  if (t.includes('architectural')) return 'ARCHITECTURALSHINGLES';
  if (t.includes('metal')) return 'METAL';
  if (t.includes('tile')) return 'TILE';
  if (t.includes('slate')) return 'SLATE';
  if (t.includes('wood') || t.includes('shake')) return 'WOODSHAKES';
  return type;
}

/** Map Canopy construction type to EZLynx enum */
export function mapCanopyConstruction(type?: string | null): string | undefined {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t.includes('wood') || t.includes('frame')) return 'Frame';
  if (t.includes('brick')) return 'BrickonBlock';
  if (t.includes('masonry')) return 'Masonry';
  if (t.includes('stucco')) return 'Stucco';
  return type;
}

/** Map Canopy vehicle usage to EZLynx enum */
export function mapCanopyVehicleUsage(usage?: string | null): string | undefined {
  if (!usage) return undefined;
  const u = usage.toLowerCase();
  if (u.includes('commute') || u.includes('work')) return 'CommuteWork';
  if (u.includes('pleasure')) return 'Pleasure';
  if (u.includes('business')) return 'Business';
  if (u.includes('farm')) return 'Farm';
  return usage;
}

/** Map Canopy ownership to EZLynx enum */
export function mapCanopyOwnership(ownership?: string | null): string | undefined {
  if (!ownership) return undefined;
  const o = ownership.toLowerCase();
  if (o === 'owned') return 'Owned';
  if (o === 'leased') return 'Leased';
  if (o === 'financed') return 'Financed';
  return ownership;
}

/** Map Canopy relationship to auto driver enum value */
export function mapCanopyRelationshipToDriver(rel?: string | null): number | undefined {
  if (!rel) return undefined;
  const r = rel.toLowerCase();
  if (r === 'primary' || r === 'insured' || r === 'self') return 3; // Insured
  if (r === 'spouse' || r === 'wife' || r === 'husband') return 7; // Spouse
  if (r === 'child' || r === 'son' || r === 'daughter') return 4; // Child
  if (r === 'parent' || r === 'mother' || r === 'father') return 6; // Parent
  return 8; // Other
}

/** Map Canopy relationship to co-applicant relationship string */
function mapCanopyRelationshipToCoApplicant(rel?: string | null): string {
  if (!rel) return 'Relative';
  const r = rel.toLowerCase();
  if (r === 'spouse' || r === 'wife' || r === 'husband') return 'Spouse';
  if (r === 'child' || r === 'son' || r === 'daughter') return 'Child';
  if (r === 'parent' || r === 'mother' || r === 'father') return 'Parent';
  if (r.includes('domestic') || r.includes('partner')) return 'Domestic Partner';
  return 'Relative';
}

/** Map gender for AUTO driver (different enum from applicant!) */
function mapCanopyAutoDriverGender(gender?: string | null): number | undefined {
  if (!gender) return undefined;
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 0;
  if (g === 'female' || g === 'f') return 1;
  return undefined;
}

/** Map marital status for AUTO driver (different enum from applicant!) */
function mapCanopyAutoDriverMarital(status?: string | null): number | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s.includes('single') || s === 's') return 0;
  if (s.includes('married') || s === 'm') return 1;
  if (s.includes('divorced') || s === 'd') return 2;
  if (s.includes('widowed') || s === 'w') return 3;
  return undefined;
}

/** Map license status */
function mapCanopyLicenseStatus(status?: string | null): string | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s === 'valid' || s === 'active') return 'Valid';
  if (s === 'suspended') return 'Suspended';
  if (s === 'revoked') return 'Revoked';
  if (s === 'expired') return 'Expired';
  if (s === 'permit') return 'Permit';
  return status;
}

/** Format phone for EZLynx: (XXX) XXX-XXXX */
function formatPhoneEzlynx(phone?: string | null): string | undefined {
  const cleaned = cleanPhone(phone);
  if (!cleaned || cleaned.length < 10) return undefined;
  const digits = cleaned.slice(-10);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Search Canopy coverages array by name variants */
export function findCanopyCoverage(coverages: any[], names: string[]): any | undefined {
  if (!coverages || !Array.isArray(coverages)) return undefined;
  const lowerNames = names.map(n => n.toLowerCase());
  return coverages.find((c: any) => {
    const name = (c.name || c.type || c.code || c.coverage_name || '').toLowerCase().replace(/\s+/g, '_');
    return lowerNames.some(n => name.includes(n) || name === n);
  });
}

// =============================================================================
// APPLICATION MAPPERS (for new Application Save API)
// =============================================================================

/**
 * Map Canopy pull data into an EZLynx AutoRiskApplication structure.
 * Merges onto an existing application template from the API.
 *
 * Uses identity-based matching:
 * - Drivers matched by DL# or first name (not by array index)
 * - Vehicles matched by VIN (not by array index)
 * - Null Canopy fields never overwrite existing good EZLynx data
 *
 * Returns { app, syncReport } where syncReport details what was matched/unmatched.
 */
export function canopyPullToAutoApplication(pull: any, appTemplate: any): { app: any; syncReport: AutoSyncReport } {
  const app = JSON.parse(JSON.stringify(appTemplate)); // deep clone
  const originalDriverCount = (appTemplate.drivers || []).length;
  const originalVehicleCount = (appTemplate.vehicles?.vehicleCollection || []).length;
  const quoteData = canopyPullToAutoQuote(pull);

  const syncReport: AutoSyncReport = {
    drivers: { matched: [], unmatched: [], added: [] },
    vehicles: { matched: [], unmatched: [], added: [] },
    coverages: { updated: [] },
    policyInfo: {},
  };

  // =========================================================================
  // DRIVER MATCHING — by DL# or firstName, NOT by index
  // =========================================================================
  const existingDrivers: any[] = app.drivers || [];
  const canopyDrivers: any[] = quoteData.drivers || [];
  const usedExistingIndices = new Set<number>();

  for (const cd of canopyDrivers) {
    let matchIdx = -1;
    let matchMethod = '';

    // 1. Try match by DL#
    if (cd.licenseNumber) {
      matchIdx = existingDrivers.findIndex((ed, i) =>
        !usedExistingIndices.has(i)
        && ed.driversLicenseNumber
        && ed.driversLicenseNumber.replace(/\D/g, '') === cd.licenseNumber.replace(/\D/g, '')
      );
      if (matchIdx >= 0) matchMethod = 'dl_number';
    }

    // 2. If no DL match, try by firstName (case-insensitive)
    if (matchIdx < 0 && cd.firstName) {
      matchIdx = existingDrivers.findIndex((ed, i) =>
        !usedExistingIndices.has(i)
        && (ed.firstName || '').toUpperCase() === cd.firstName.toUpperCase()
      );
      if (matchIdx >= 0) matchMethod = 'first_name';
    }

    if (matchIdx >= 0) {
      // MATCHED — update only non-null Canopy fields
      usedExistingIndices.add(matchIdx);
      const existing = existingDrivers[matchIdx];

      if (cd.firstName) existing.firstName = cd.firstName;
      if (cd.lastName) existing.lastName = cd.lastName;
      if (cd.dateOfBirth) existing.dateOfBirth = cd.dateOfBirth;
      if (cd.licenseNumber) existing.driversLicenseNumber = cd.licenseNumber;
      if (cd.licenseState) {
        existing.driversLicenseState = cd.licenseState;
      }
      // Only update gender/maritalStatus if Canopy has a real value (not null)
      if (cd.gender != null && existing.gender) {
        existing.gender = { ...existing.gender, value: cd.gender };
      }
      if (cd.maritalStatus != null && existing.maritalStatus) {
        existing.maritalStatus = { ...existing.maritalStatus, value: cd.maritalStatus };
      }

      syncReport.drivers.matched.push({
        canopyName: `${cd.firstName} ${cd.lastName}`,
        ezlynxName: `${existing.firstName} ${existing.lastName}`,
        matchMethod,
        ezlynxIndex: matchIdx,
      });
    } else {
      // UNMATCHED — add as a new driver
      const newDriver: any = {};
      if (cd.firstName) newDriver.firstName = cd.firstName;
      if (cd.lastName) newDriver.lastName = cd.lastName;
      if (cd.dateOfBirth) newDriver.dateOfBirth = cd.dateOfBirth;
      if (cd.licenseNumber) newDriver.driversLicenseNumber = cd.licenseNumber;
      if (cd.licenseState) newDriver.driversLicenseState = cd.licenseState;
      if (cd.gender != null) newDriver.gender = { value: cd.gender };
      if (cd.maritalStatus != null) newDriver.maritalStatus = { value: cd.maritalStatus };
      if (cd.relationship != null) newDriver.relationship = { value: cd.relationship };

      existingDrivers.push(newDriver);
      syncReport.drivers.added.push({
        canopyName: `${cd.firstName} ${cd.lastName}`,
        licenseNumber: cd.licenseNumber || 'N/A',
      });
    }
  }
  app.drivers = existingDrivers;

  // Detect EZLynx-only drivers (in EZLynx but not in Canopy) — flag for user review
  for (let i = 0; i < originalDriverCount; i++) {
    if (!usedExistingIndices.has(i)) {
      const ed = existingDrivers[i];
      syncReport.drivers.ezlynxOnly = syncReport.drivers.ezlynxOnly || [];
      syncReport.drivers.ezlynxOnly.push({
        ezlynxName: `${ed.firstName || ''} ${ed.lastName || ''}`.trim(),
        ezlynxIndex: i,
        licenseNumber: ed.driversLicenseNumber || 'N/A',
      });
    }
  }

  // =========================================================================
  // VEHICLE MATCHING — by VIN, NOT by index
  // =========================================================================
  const vehicleCollection: any[] = app.vehicles?.vehicleCollection || [];
  const canopyVehicles: any[] = quoteData.vehicles || [];
  const usedVehicleIndices = new Set<number>();

  // Build a map of Canopy vehicle index → EZLynx vehicle index for coverage mapping
  const canopyToEzlynxVehicleIdx = new Map<number, number>();

  canopyVehicles.forEach((cv, canopyIdx) => {
    let matchIdx = -1;

    // Match by VIN
    if (cv.vin) {
      matchIdx = vehicleCollection.findIndex((ev, i) =>
        !usedVehicleIndices.has(i)
        && ev.vin
        && ev.vin.toUpperCase() === cv.vin.toUpperCase()
      );
    }

    if (matchIdx >= 0) {
      usedVehicleIndices.add(matchIdx);
      canopyToEzlynxVehicleIdx.set(canopyIdx, matchIdx);
      const existing = vehicleCollection[matchIdx];

      // Update non-null fields only
      if (cv.vin) existing.vin = cv.vin;
      if (cv.make) existing.make = cv.make;
      if (cv.model) existing.model = cv.model;
      if (cv.year != null) {
        if (existing.year && typeof existing.year === 'object') {
          existing.year = { ...existing.year, description: String(cv.year) };
        } else {
          existing.year = cv.year;
        }
      }
      if (cv.annualMiles != null) existing.annualMiles = cv.annualMiles;

      syncReport.vehicles.matched.push({
        vin: cv.vin,
        canopyDesc: `${cv.year || ''} ${cv.make || ''} ${cv.model || ''}`.trim(),
        ezlynxDesc: `${existing.year?.description || existing.year || ''} ${existing.make || ''} ${existing.model || ''}`.trim(),
        ezlynxIndex: matchIdx,
      });
    } else {
      // UNMATCHED — add as a new vehicle
      const newVehicle: any = {};
      if (cv.vin) newVehicle.vin = cv.vin;
      if (cv.make) newVehicle.make = cv.make;
      if (cv.model) newVehicle.model = cv.model;
      if (cv.year != null) newVehicle.year = cv.year;
      if (cv.annualMiles != null) newVehicle.annualMiles = cv.annualMiles;
      if (cv.use) newVehicle.usage = cv.use;
      if (cv.ownership) newVehicle.ownership = cv.ownership;
      newVehicle.coverage = {}; // empty coverage object for per-vehicle coverages

      const newIdx = vehicleCollection.length;
      vehicleCollection.push(newVehicle);
      canopyToEzlynxVehicleIdx.set(canopyIdx, newIdx);

      syncReport.vehicles.added = syncReport.vehicles.added || [];
      syncReport.vehicles.added.push({
        vin: cv.vin || 'N/A',
        canopyDesc: `${cv.year || ''} ${cv.make || ''} ${cv.model || ''}`.trim(),
        ezlynxIndex: newIdx,
      });
    }
  });

  // Detect EZLynx-only vehicles (in EZLynx but not in Canopy) — flag for user review
  for (let i = 0; i < originalVehicleCount; i++) {
    if (!usedVehicleIndices.has(i)) {
      const ev = vehicleCollection[i];
      syncReport.vehicles.ezlynxOnly = syncReport.vehicles.ezlynxOnly || [];
      syncReport.vehicles.ezlynxOnly.push({
        vin: ev.vin || 'N/A',
        ezlynxDesc: `${ev.year?.description || ev.year || ''} ${ev.make || ''} ${ev.model || ''}`.trim(),
        ezlynxIndex: i,
      });
    }
  }

  // Ensure the vehicleCollection is written back
  if (app.vehicles) {
    app.vehicles.vehicleCollection = vehicleCollection;
  }

  // Map per-vehicle coverages — using VIN-matched and newly-added indices
  if (quoteData.vehicleCoverages) {
    for (const vc of quoteData.vehicleCoverages) {
      const ezlynxIdx = canopyToEzlynxVehicleIdx.get(vc.vehicleIndex);
      if (ezlynxIdx == null) continue;
      const existing = vehicleCollection[ezlynxIdx];
      if (!existing?.coverage) continue;
      if (vc.compDeductible != null) {
        existing.coverage.comprehensive = vc.compDeductible;
        syncReport.coverages.updated.push(`Vehicle ${ezlynxIdx}: Comp deductible → ${vc.compDeductible.description}`);
      }
      if (vc.collDeductible != null) {
        existing.coverage.collision = vc.collDeductible;
        syncReport.coverages.updated.push(`Vehicle ${ezlynxIdx}: Coll deductible → ${vc.collDeductible.description}`);
      }
      if (vc.towing != null) existing.coverage.towing = vc.towing;
      if (vc.rental != null) existing.coverage.rental = vc.rental;
    }
  }

  // =========================================================================
  // GENERAL COVERAGE
  // =========================================================================
  if (quoteData.generalCoverage && app.coverage?.generalCoverage) {
    const gc = app.coverage.generalCoverage;
    if (quoteData.generalCoverage.bodilyInjury != null) {
      gc.bodilyInjury = quoteData.generalCoverage.bodilyInjury;
      syncReport.coverages.updated.push(`BI → ${quoteData.generalCoverage.bodilyInjury.description}`);
    }
    if (quoteData.generalCoverage.propertyDamage != null) {
      gc.propertyDamage = quoteData.generalCoverage.propertyDamage;
      syncReport.coverages.updated.push(`PD → ${quoteData.generalCoverage.propertyDamage.description}`);
    }
    if (quoteData.generalCoverage.uninsuredMotorist != null) {
      gc.uninsuredMotorist = quoteData.generalCoverage.uninsuredMotorist;
      syncReport.coverages.updated.push(`UM → ${quoteData.generalCoverage.uninsuredMotorist.description}`);
    }
    if (quoteData.generalCoverage.underinsuredMotorist != null) {
      gc.underinsuredMotorist = quoteData.generalCoverage.underinsuredMotorist;
      syncReport.coverages.updated.push(`UIM → ${quoteData.generalCoverage.underinsuredMotorist.description}`);
    }
    if (quoteData.generalCoverage.medicalPayments != null) {
      gc.medicalPayments = quoteData.generalCoverage.medicalPayments;
      syncReport.coverages.updated.push(`MedPay → ${quoteData.generalCoverage.medicalPayments.description}`);
    }
  }

  // =========================================================================
  // POLICY INFO
  // =========================================================================
  if (app.policyInformation) {
    if (quoteData.effectiveDate) {
      app.policyInformation.effectiveDate = quoteData.effectiveDate;
      syncReport.policyInfo.effectiveDate = quoteData.effectiveDate;
    }
    if (quoteData.priorPolicyExpirationDate) {
      app.policyInformation.priorPolicyExpirationDate = quoteData.priorPolicyExpirationDate;
      syncReport.policyInfo.priorPolicyExpirationDate = quoteData.priorPolicyExpirationDate;
    }
    if (quoteData.priorCarrier) {
      syncReport.policyInfo.priorCarrier = quoteData.priorCarrier;
      // Don't overwrite a good enum with a raw string — log for awareness only
    }
  }

  return { app, syncReport };
}

/** Sync report type for auto application mapping */
export interface AutoSyncReport {
  drivers: {
    matched: Array<{ canopyName: string; ezlynxName: string; matchMethod: string; ezlynxIndex: number }>;
    unmatched: Array<{ canopyName: string; licenseNumber: string; reason?: string }>;
    added: Array<{ canopyName: string; licenseNumber: string }>;
    ezlynxOnly?: Array<{ ezlynxName: string; ezlynxIndex: number; licenseNumber: string }>;
  };
  vehicles: {
    matched: Array<{ vin: string; canopyDesc: string; ezlynxDesc: string; ezlynxIndex: number }>;
    unmatched: Array<{ vin: string; canopyDesc: string; reason: string }>;
    added: Array<{ vin: string; canopyDesc: string; ezlynxIndex: number }>;
    ezlynxOnly?: Array<{ vin: string; ezlynxDesc: string; ezlynxIndex: number }>;
  };
  coverages: {
    updated: string[];
  };
  policyInfo: {
    effectiveDate?: string;
    priorPolicyExpirationDate?: string;
    priorCarrier?: string;
  };
}

/**
 * Map Canopy pull data into an EZLynx HomeRiskApplication structure.
 * Merges onto an existing application template from the API.
 * Deep clones to avoid mutating the original template.
 *
 * Maps dwelling coverages from Canopy (cents) to EZLynx dollar values:
 * - DWELLING → dwelling limit
 * - OTHER_STRUCTURES → other structures limit
 * - PERSONAL_PROPERTY → personal property limit
 * - FAMILY_LIABILITY_PROTECTION / PERSONAL_LIABILITY → personal liability
 * - MEDICAL_PAYMENTS → medical payments
 * - ALL_OTHER_PERILS deductible → all peril deductible
 */
export function canopyPullToHomeApplication(pull: any, appTemplate: any): { app: any; syncReport: HomeSyncReport } {
  const app = JSON.parse(JSON.stringify(appTemplate)); // deep clone
  const quoteData = canopyPullToHomeQuote(pull);

  const syncReport: HomeSyncReport = {
    coverages: { updated: [] },
    dwelling: { updated: [] },
    policyInfo: {},
  };

  // Map dwelling info
  if (app.dwellingInfo) {
    if (quoteData.yearBuilt) { app.dwellingInfo.yearBuilt = quoteData.yearBuilt; syncReport.dwelling.updated.push(`yearBuilt → ${quoteData.yearBuilt}`); }
    if (quoteData.squareFootage) { app.dwellingInfo.squareFootage = quoteData.squareFootage; syncReport.dwelling.updated.push(`sqft → ${quoteData.squareFootage}`); }
    if (quoteData.exteriorWall) { app.dwellingInfo.exteriorWall = quoteData.exteriorWall; syncReport.dwelling.updated.push(`exteriorWall → ${quoteData.exteriorWall}`); }
    if (quoteData.roofType) { app.dwellingInfo.roofType = quoteData.roofType; syncReport.dwelling.updated.push(`roofType → ${quoteData.roofType}`); }
    if (quoteData.roofingUpdateYear) { app.dwellingInfo.roofingUpdateYear = quoteData.roofingUpdateYear; syncReport.dwelling.updated.push(`roofYear → ${quoteData.roofingUpdateYear}`); }
    if (quoteData.residenceType) { app.dwellingInfo.residenceType = quoteData.residenceType; syncReport.dwelling.updated.push(`residenceType → ${quoteData.residenceType}`); }
  }

  // Map coverages — also map additional coverage types from Canopy
  if (app.coverage) {
    if (quoteData.dwellingLimit) { app.coverage.dwellingLimit = quoteData.dwellingLimit; syncReport.coverages.updated.push(`Dwelling → $${quoteData.dwellingLimit}`); }
    if (quoteData.personalLiabilityLimit) { app.coverage.personalLiabilityLimit = quoteData.personalLiabilityLimit; syncReport.coverages.updated.push(`Liability → $${quoteData.personalLiabilityLimit}`); }
    if (quoteData.medicalPaymentsLimit) { app.coverage.medicalPaymentsLimit = quoteData.medicalPaymentsLimit; syncReport.coverages.updated.push(`MedPay → $${quoteData.medicalPaymentsLimit}`); }
    if (quoteData.allPerilDeductible) { app.coverage.allPerilDeductible = quoteData.allPerilDeductible; syncReport.coverages.updated.push(`All Peril Ded → $${quoteData.allPerilDeductible}`); }
    if (quoteData.otherStructuresLimit) { app.coverage.otherStructuresLimit = quoteData.otherStructuresLimit; syncReport.coverages.updated.push(`Other Structures → $${quoteData.otherStructuresLimit}`); }
    if (quoteData.personalPropertyLimit) { app.coverage.personalPropertyLimit = quoteData.personalPropertyLimit; syncReport.coverages.updated.push(`Personal Property → $${quoteData.personalPropertyLimit}`); }
    if (quoteData.lossOfUseLimit) { app.coverage.lossOfUseLimit = quoteData.lossOfUseLimit; syncReport.coverages.updated.push(`Loss of Use → $${quoteData.lossOfUseLimit}`); }
    if (quoteData.windHailDeductible) { app.coverage.windHailDeductible = quoteData.windHailDeductible; syncReport.coverages.updated.push(`Wind/Hail Ded → $${quoteData.windHailDeductible}`); }
    if (quoteData.hurricaneDeductible) { app.coverage.hurricaneDeductible = quoteData.hurricaneDeductible; syncReport.coverages.updated.push(`Hurricane Ded → $${quoteData.hurricaneDeductible}`); }
  }

  // Map property address
  if (app.propertyAddress || app.property) {
    const target = app.propertyAddress || app.property || {};
    if (quoteData.propertyAddress) target.propertyAddress = quoteData.propertyAddress;
    if (quoteData.propertyCity) target.propertyCity = quoteData.propertyCity;
    if (quoteData.propertyState) target.propertyState = quoteData.propertyState;
    if (quoteData.propertyZip) target.propertyZip = quoteData.propertyZip;
  }

  // Map policy info
  if (app.policyInformation) {
    if (quoteData.effectiveDate) {
      app.policyInformation.effectiveDate = quoteData.effectiveDate;
      syncReport.policyInfo.effectiveDate = quoteData.effectiveDate;
    }
    if (quoteData.priorCarrier) {
      syncReport.policyInfo.priorCarrier = quoteData.priorCarrier;
    }
  }

  return { app, syncReport };
}

/** Sync report type for home application mapping */
export interface HomeSyncReport {
  coverages: { updated: string[] };
  dwelling: { updated: string[] };
  policyInfo: {
    effectiveDate?: string;
    priorCarrier?: string;
  };
}

// =============================================================================
// HELPERS (internal)
// =============================================================================

function findCoverageLimit(coverages: any[], codes: string[]): string | undefined {
  const upperCodes = codes.map(c => c.toUpperCase());
  const cov = coverages.find((c: any) => {
    const code = (c.type || c.code || '').toUpperCase();
    return upperCodes.includes(code);
  });
  return cov?.limit || cov?.limits;
}

function findCoverageDeductible(coverages: any[], codes: string[]): string | undefined {
  const upperCodes = codes.map(c => c.toUpperCase());
  const cov = coverages.find((c: any) => {
    const code = (c.type || c.code || '').toUpperCase();
    return upperCodes.includes(code);
  });
  return cov?.deductible || cov?.deductibles;
}
