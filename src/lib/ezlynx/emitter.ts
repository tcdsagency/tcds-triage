/**
 * EZLynx XML Emitter
 *
 * Generates EZLynx XML format (.CMSEZLynxXML) for HawkSoft import.
 * Supports both Home (EZHOME) and Auto (EZAUTO) policies.
 */

import type { PolicyCreatorDocument } from '@/types/policy-creator.types';

// XML escaping
function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date as YYYY-MM-DD
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }
  // Try to parse
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().substring(0, 10);
}

// Parse name into first/middle/last
function parseName(fullName: string | null | undefined): { first: string; middle: string; last: string } {
  if (!fullName) return { first: '', middle: '', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], middle: '', last: '' };
  } else if (parts.length === 2) {
    return { first: parts[0], middle: '', last: parts[1] };
  } else {
    return {
      first: parts[0],
      middle: parts.slice(1, -1).join(' '),
      last: parts[parts.length - 1],
    };
  }
}

// Parse address into street number and name
function parseStreetAddress(addr: string | null | undefined): { number: string; name: string } {
  if (!addr) return { number: '', name: '' };
  const match = addr.match(/^(\d+)\s+(.+)$/);
  if (match) {
    return { number: match[1], name: match[2] };
  }
  return { number: '', name: addr };
}

// Format BI/UM limits as "X/Y" format (e.g., "100/300" means 100000/300000)
function formatSplitLimit(limit: number | null | undefined): string {
  if (!limit) return '';
  // If it's already small (like 100 or 300), it's in thousands
  if (limit < 1000) {
    return String(limit);
  }
  // Otherwise convert from dollars to thousands
  return String(Math.round(limit / 1000));
}

// Build XML element with optional content
function el(name: string, content: string | number | null | undefined, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  const value = content === null || content === undefined ? '' : String(content);
  return `${spaces}<${name}>${escapeXml(value)}</${name}>`;
}

// Build self-closing or empty element
function emptyEl(name: string, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  return `${spaces}<${name} />`;
}

/**
 * Generate EZHOME XML for homeowners policies
 */
export function generateHomeXML(doc: PolicyCreatorDocument): string {
  const lines: string[] = [];
  const name = parseName(doc.insuredName);
  const street = parseStreetAddress(doc.insuredAddress);

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push(
    '<EZHOME xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.ezlynx.com/XMLSchema/Home/V200">'
  );

  // Applicant section
  lines.push('  <Applicant>');
  lines.push('    <ApplicantType>Applicant</ApplicantType>');
  lines.push('    <PersonalInfo>');
  lines.push('      <Name>');
  lines.push(el('FirstName', name.first, 4));
  lines.push(emptyEl('MiddleName', 4));
  lines.push(el('LastName', name.last, 4));
  lines.push('      </Name>');
  lines.push(el('Relation', 'Insured', 3));
  lines.push('    </PersonalInfo>');
  lines.push('    <Address>');
  lines.push(el('AddressCode', 'StreetAddress', 3));
  lines.push('      <Addr1>');
  lines.push(el('StreetName', street.name, 4));
  lines.push(el('StreetNumber', street.number, 4));
  lines.push(emptyEl('UnitNumber', 4));
  lines.push('      </Addr1>');
  lines.push(emptyEl('Addr2', 3));
  lines.push(el('City', doc.insuredCity?.toUpperCase(), 3));
  lines.push(el('StateCode', doc.insuredState, 3));
  lines.push(el('Zip5', doc.insuredZip?.substring(0, 5), 3));
  if (doc.insuredZip && doc.insuredZip.length > 5) {
    lines.push(el('Zip4', doc.insuredZip.substring(6), 3));
  }
  if (doc.insuredPhone) {
    lines.push('      <Phone>');
    lines.push(el('PhoneType', 'Mobile', 4));
    lines.push(el('PhoneNumber', doc.insuredPhone.replace(/\D/g, ''), 4));
    lines.push('      </Phone>');
  }
  if (doc.insuredEmail) {
    lines.push(el('Email', doc.insuredEmail, 3));
  }
  lines.push(el('Validation', 'Valid', 3));
  lines.push('    </Address>');
  lines.push('  </Applicant>');

  // PolicyInfo section
  lines.push('  <PolicyInfo>');
  lines.push(el('PolicyTerm', '12 Month', 2));
  lines.push(el('PolicyType', mapPolicyType(doc.lineOfBusiness), 2));
  lines.push(el('Package', 'No', 2));
  lines.push(el('Effective', formatDate(doc.effectiveDate), 2));
  lines.push(el('CreditCheckAuth', 'Yes', 2));
  lines.push('  </PolicyInfo>');

  // RatingInfo section - property details
  const property = doc.properties?.[0];
  lines.push('  <RatingInfo>');
  if (property) {
    if (property.yearBuilt) lines.push(el('YearBuilt', property.yearBuilt, 2));
    lines.push(el('Dwelling', 'One Family', 2));
    lines.push(el('DwellingUse', 'Primary', 2));
    lines.push(el('DwellingOccupancy', 'Owner Occupied', 2));
    if (property.squareFeet) lines.push(el('SquareFootage', property.squareFeet, 2));
    if (property.constructionType) lines.push(el('Construction', property.constructionType, 2));
    if (property.roofType) lines.push(el('Roof', property.roofType.toUpperCase(), 2));
    if (property.stories) lines.push(el('NumberOfStories', property.stories, 2));
  }
  lines.push('  </RatingInfo>');

  // ReplacementCost section - coverages
  lines.push('  <ReplacementCost>');

  // Find key coverages
  const allCoverages = [...(doc.coverages || []), ...(property?.coverages || [])];
  const dwelling = allCoverages.find((c) => c.code === 'DWELL' || c.code === 'COVA' || c.code === 'A');
  const liability = allCoverages.find((c) => c.code === 'LIAB' || c.code === 'COVE' || c.code === 'E');
  const medPay = allCoverages.find((c) => c.code === 'MEDPY' || c.code === 'COVF' || c.code === 'F' || c.code === 'MP');

  if (dwelling?.limit) {
    lines.push(el('ReplacementCost', dwelling.limit, 2));
    lines.push(el('Dwelling', dwelling.limit, 2));
  }
  lines.push(el('LossOfUse', 0, 2));
  if (liability?.limit) {
    lines.push(el('PersonalLiability', liability.limit, 2));
  }
  if (medPay?.limit) {
    lines.push(el('MedicalPayments', medPay.limit, 2));
  }

  // Deductible
  const deductible = dwelling?.deductible;
  if (deductible) {
    lines.push('    <DeductibeInfo>');
    // Check if percentage or flat amount
    if (deductible < 100) {
      lines.push(el('Deductible', `${deductible}%`, 3));
    } else {
      lines.push(el('Deductible', deductible, 3));
    }
    lines.push('    </DeductibeInfo>');
  }

  lines.push('    <RatingCredits>');
  lines.push(el('Multipolicy', 'No', 3));
  lines.push('    </RatingCredits>');
  lines.push('  </ReplacementCost>');

  // Endorsements section
  lines.push('  <Endorsements>');
  lines.push(el('SpecialPersonalProperty', 'No', 2));
  lines.push('  </Endorsements>');

  // GeneralInfo section
  lines.push('  <GeneralInfo>');
  lines.push(el('RatingStateCode', doc.insuredState || 'AL', 2));
  lines.push('  </GeneralInfo>');

  lines.push('</EZHOME>');

  return lines.join('\n');
}

/**
 * Generate EZAUTO XML for auto policies
 */
export function generateAutoXML(doc: PolicyCreatorDocument): string {
  const lines: string[] = [];
  const name = parseName(doc.insuredName);
  const street = parseStreetAddress(doc.insuredAddress);

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push(
    '<EZAUTO xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.ezlynx.com/XMLSchema/Auto/V200">'
  );

  // Applicant section
  lines.push('  <Applicant>');
  lines.push('    <ApplicantType>Applicant</ApplicantType>');
  lines.push('    <PersonalInfo>');
  lines.push('      <Name>');
  lines.push(el('FirstName', name.first, 4));
  lines.push(emptyEl('MiddleName', 4));
  lines.push(el('LastName', name.last, 4));
  lines.push('      </Name>');
  if (doc.drivers?.[0]?.dateOfBirth) {
    lines.push(el('DOB', formatDate(doc.drivers[0].dateOfBirth), 3));
  }
  lines.push(el('Gender', doc.drivers?.[0]?.gender || 'Male', 3));
  lines.push(el('MaritalStatus', 'Single', 3));
  lines.push(el('Relation', 'Insured', 3));
  lines.push('    </PersonalInfo>');
  lines.push('    <Address>');
  lines.push(el('AddressCode', 'StreetAddress', 3));
  lines.push('      <Addr1>');
  lines.push(el('StreetName', street.name?.toUpperCase(), 4));
  lines.push(el('StreetNumber', street.number, 4));
  lines.push(emptyEl('UnitNumber', 4));
  lines.push('      </Addr1>');
  lines.push(emptyEl('Addr2', 3));
  lines.push(el('City', doc.insuredCity?.toUpperCase(), 3));
  lines.push(el('StateCode', doc.insuredState, 3));
  lines.push(el('Zip5', doc.insuredZip?.substring(0, 5), 3));
  if (doc.insuredZip && doc.insuredZip.length > 5) {
    lines.push(el('Zip4', doc.insuredZip.substring(6), 3));
  }
  if (doc.insuredPhone) {
    lines.push('      <Phone>');
    lines.push(el('PhoneType', 'Mobile', 4));
    lines.push(el('PhoneNumber', doc.insuredPhone.replace(/\D/g, ''), 4));
    lines.push('      </Phone>');
  }
  lines.push(el('Validation', 'Valid', 3));
  lines.push('    </Address>');
  lines.push('  </Applicant>');

  // PolicyInfo section
  lines.push('  <PolicyInfo>');
  lines.push(el('PolicyTerm', '6 Month', 2));
  lines.push(el('Package', 'No', 2));
  lines.push(el('Effective', formatDate(doc.effectiveDate), 2));
  lines.push(el('CreditCheckAuth', 'Yes', 2));
  lines.push('  </PolicyInfo>');

  // Drivers section
  if (doc.drivers && doc.drivers.length > 0) {
    lines.push('  <Drivers>');
    doc.drivers.forEach((driver, index) => {
      const driverId = index + 1;
      lines.push(`    <Driver id="${driverId}">`);
      lines.push('      <Name>');
      lines.push(el('FirstName', driver.firstName, 4));
      lines.push(el('LastName', driver.lastName?.toUpperCase(), 4));
      lines.push('      </Name>');
      lines.push(el('Gender', driver.gender || 'Male', 3));
      if (driver.dateOfBirth) {
        lines.push(el('DOB', formatDate(driver.dateOfBirth), 3));
      }
      if (driver.licenseNumber) {
        lines.push(el('DLNumber', driver.licenseNumber, 3));
        lines.push(el('DLState', driver.licenseState || doc.insuredState, 3));
        lines.push(el('DLStatus', 'Valid', 3));
      }
      lines.push(el('MaritalStatus', 'Single', 3));
      lines.push(el('Relation', index === 0 ? 'Insured' : 'Spouse', 3));
      lines.push(el('PrincipalVehicle', Math.min(driverId, doc.vehicles?.length || 1), 3));
      lines.push(el('Rated', 'Rated', 3));
      lines.push(el('SR22', 'No', 3));
      lines.push(el('FR44', 'No', 3));
      lines.push(el('LicenseRevokedSuspended', 'No', 3));
      lines.push('    </Driver>');
    });
    lines.push('  </Drivers>');
  }

  // Vehicles section
  if (doc.vehicles && doc.vehicles.length > 0) {
    lines.push('  <Vehicles>');
    doc.vehicles.forEach((vehicle, index) => {
      const vehicleId = index + 1;
      lines.push(`    <Vehicle id="${vehicleId}">`);
      lines.push(el('UseVinLookup', 'No', 3));
      lines.push(el('Year', vehicle.year, 3));
      if (vehicle.vin) {
        lines.push(el('Vin', vehicle.vin.toUpperCase(), 3));
      }
      lines.push(el('Make', vehicle.make?.toUpperCase(), 3));
      lines.push(el('Model', vehicle.model?.toUpperCase(), 3));
      lines.push(el('AntiLockBrake', 'Yes', 3));
      lines.push(el('DaytimeRunningLights', 'Yes', 3));
      lines.push(el('Telematics', 'No', 3));
      lines.push(el('TransportationNetworkCompany', 'No', 3));
      lines.push('    </Vehicle>');
    });
    lines.push('  </Vehicles>');

    // VehiclesUse section
    lines.push('  <VehiclesUse>');
    doc.vehicles.forEach((vehicle, index) => {
      const vehicleId = index + 1;
      lines.push(`    <VehicleUse id="${vehicleId}">`);
      lines.push(el('Useage', mapUsage(vehicle.usage), 3));
      lines.push(el('OneWayMiles', 0, 3));
      lines.push(el('DaysPerWeek', 5, 3));
      lines.push(el('WeeksPerMonth', 4, 3));
      lines.push(el('AnnualMiles', 10000, 3));
      lines.push(el('Ownership', 'Owned', 3));
      lines.push(el('Odometer', 0, 3));
      lines.push(el('AdditionalModificationValue', 0, 3));
      lines.push(el('PrincipalOperator', Math.min(vehicleId, doc.drivers?.length || 1), 3));
      lines.push(el('UsedForDelivery', 'No', 3));
      lines.push(el('PriorDamagePresent', 'No', 3));
      lines.push('    </VehicleUse>');
    });
    lines.push('  </VehiclesUse>');
  }

  // Coverages section
  lines.push('  <Coverages>');

  // General coverages (policy-level)
  lines.push('    <GeneralCoverage>');
  const allCoverages = doc.coverages || [];

  // Find BI coverage
  const bi = allCoverages.find((c) => c.code === 'BI' || c.code === 'BIPDL');
  if (bi?.limit) {
    // Format as split limit (e.g., "100/300")
    const perPerson = formatSplitLimit(bi.limit);
    const perAccident = formatSplitLimit(bi.limit2 || bi.limit * 2);
    lines.push(el('BI', `${perPerson}/${perAccident}`, 3));
  }

  // Find PD coverage
  const pd = allCoverages.find((c) => c.code === 'PD');
  if (pd?.limit) {
    lines.push(el('PD', pd.limit, 3));
  }

  // Find MP coverage
  const mp = allCoverages.find((c) => c.code === 'MP' || c.code === 'MEDPY');
  if (mp?.limit) {
    lines.push(el('MP', mp.limit, 3));
  }

  // Find UM coverage
  const um = allCoverages.find((c) => c.code === 'UM' || c.code === 'UMBI');
  if (um?.limit) {
    const perPerson = formatSplitLimit(um.limit);
    const perAccident = formatSplitLimit(um.limit2 || um.limit * 2);
    lines.push(el('UM', `${perPerson}/${perAccident}`, 3));
  }

  // Find UIM coverage
  const uim = allCoverages.find((c) => c.code === 'UIM');
  if (uim?.limit) {
    const perPerson = formatSplitLimit(uim.limit);
    const perAccident = formatSplitLimit(uim.limit2 || uim.limit * 2);
    lines.push(el('UIM', `${perPerson}/${perAccident}`, 3));
  }

  lines.push(el('Multipolicy', 'No', 3));
  lines.push(el('Multicar', doc.vehicles && doc.vehicles.length > 1 ? 'Yes' : 'No', 3));
  lines.push('    </GeneralCoverage>');

  // Vehicle-specific coverages
  if (doc.vehicles && doc.vehicles.length > 0) {
    doc.vehicles.forEach((vehicle, index) => {
      const vehicleId = index + 1;
      const vehCoverages = vehicle.coverages || [];

      lines.push(`    <VehicleCoverage id="${vehicleId}">`);

      // Find comp/coll deductibles
      const comp = vehCoverages.find((c) => c.code === 'COMP' || c.code === 'OTC');
      const coll = vehCoverages.find((c) => c.code === 'COLL');
      const towing = vehCoverages.find((c) => c.code === 'ROAD' || c.code === 'TOW');
      const rental = vehCoverages.find((c) => c.code === 'RENT' || c.code === 'RREIM');

      // Also check policy-level coverages for this vehicle
      const policyComp = allCoverages.find((c) => c.code === 'COMP' || c.code === 'OTC');
      const policyColl = allCoverages.find((c) => c.code === 'COLL');

      const compDed = comp?.deductible || policyComp?.deductible;
      const collDed = coll?.deductible || policyColl?.deductible;

      lines.push(el('OtherCollisionDeductible', compDed || 'No Coverage', 3));
      lines.push(el('CollisionDeductible', collDed || 'No Coverage', 3));
      lines.push(el('FullGlass', comp ? 'Yes' : 'No', 3));
      lines.push(el('TowingDeductible', towing ? '100' : 'No Coverage', 3));
      lines.push(el('RentalDeductible', rental ? '50/1500' : 'No Coverage', 3));
      lines.push(el('LiabilityNotRequired', 'No', 3));
      lines.push(el('LoanLeaseCoverage', 'No', 3));
      lines.push('    </VehicleCoverage>');
    });
  }

  lines.push('  </Coverages>');

  // VehicleAssignments section
  if (doc.vehicles && doc.vehicles.length > 0) {
    lines.push('  <VehicleAssignments>');
    doc.vehicles.forEach((_, index) => {
      const vehicleId = index + 1;
      lines.push(`    <VehicleAssignment id="${vehicleId}">`);
      // Assign first driver to all vehicles at 100%
      lines.push('      <DriverAssignment id="1">100</DriverAssignment>');
      lines.push('    </VehicleAssignment>');
    });
    lines.push('  </VehicleAssignments>');
  }

  // GeneralInfo section
  lines.push('  <GeneralInfo>');
  lines.push(el('RatingStateCode', doc.insuredState || 'AL', 2));
  lines.push('  </GeneralInfo>');

  lines.push('</EZAUTO>');

  return lines.join('\n');
}

/**
 * Map policy type to EZLynx format
 */
function mapPolicyType(lob: string | null | undefined): string {
  if (!lob) return 'HO3';
  const lower = lob.toLowerCase();
  if (lower.includes('ho3') || lower.includes('ho-3')) return 'HO3';
  if (lower.includes('ho4') || lower.includes('ho-4') || lower.includes('renter')) return 'HO4';
  if (lower.includes('ho5') || lower.includes('ho-5')) return 'HO5';
  if (lower.includes('ho6') || lower.includes('ho-6') || lower.includes('condo')) return 'HO6';
  if (lower.includes('dp3') || lower.includes('dp-3') || lower.includes('dwelling')) return 'DP3';
  return 'HO3';
}

/**
 * Map vehicle usage to EZLynx format
 */
function mapUsage(usage: string | null | undefined): string {
  if (!usage) return 'Pleasure';
  const lower = usage.toLowerCase();
  if (lower.includes('business')) return 'Business';
  if (lower.includes('commute') || lower.includes('work')) return 'Commute';
  if (lower.includes('farm')) return 'Farm';
  return 'Pleasure';
}

/**
 * Main entry point - determines LOB and generates appropriate XML
 */
export function generateEZLynxXML(doc: PolicyCreatorDocument): {
  xml: string;
  format: 'home' | 'auto';
  filename: string;
} {
  const lob = doc.lineOfBusiness?.toLowerCase() || '';

  // Determine if this is an auto or home policy
  const isAuto =
    lob.includes('auto') ||
    lob.includes('vehicle') ||
    lob.includes('car') ||
    lob.includes('pauto') ||
    (doc.vehicles && doc.vehicles.length > 0 && !doc.properties?.length);

  if (isAuto) {
    const xml = generateAutoXML(doc);
    // Create filename: InsuredName_Auto.CMSEZLynxXML
    const safeName = (doc.insuredName || 'Policy')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
    return {
      xml,
      format: 'auto',
      filename: `${safeName}_Auto.CMSEZLynxXML`,
    };
  } else {
    const xml = generateHomeXML(doc);
    const safeName = (doc.insuredName || 'Policy')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
    return {
      xml,
      format: 'home',
      filename: `${safeName}_Home.CMSEZLynxXML`,
    };
  }
}
