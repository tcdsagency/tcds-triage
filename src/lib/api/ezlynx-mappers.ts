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
