/**
 * ACORD XML Emitter
 *
 * Generates ACORD XML format for HawkSoft import.
 * Supports both Home (HomePolicyQuoteInqRq) and Auto (PersAutoPolicyQuoteInqRq) policies.
 */

import type { PolicyCreatorDocument } from '@/types/policy-creator.types';

// Generate UUID
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().substring(0, 10);
}

// Format date as MM/DD/YYYY for transaction dates
function formatTransactionDate(dateStr: string | null | undefined): string {
  if (!dateStr) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

// Format phone number as +1-XXX-XXXXXXX
function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1-${digits.substring(0, 3)}-${digits.substring(3)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1-${digits.substring(1, 4)}-${digits.substring(4)}`;
  }
  return phone;
}

// Format currency amount
function formatAmount(amt: number | null | undefined): string {
  if (amt === null || amt === undefined) return '0.00';
  return amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Build XML element
function el(name: string, content: string | number | null | undefined): string {
  const value = content === null || content === undefined ? '' : String(content);
  return `<${name}>${escapeXml(value)}</${name}>`;
}

// Build element with id attribute
function elId(name: string, id: string, content: string): string {
  return `<${name} id="${id}">${content}</${name}>`;
}

/**
 * Generate SignonRq section (common to both Auto and Home)
 */
function generateSignonRq(): string {
  return `<SignonRq>
    <CustLangPref>EN-US</CustLangPref>
    <ClientApp>
      <Org>HawkSoft</Org>
      <Name>HawkSoft CMS</Name>
      <Version>6.00.14.300</Version>
    </ClientApp>
  </SignonRq>`;
}

/**
 * Generate Producer section (agency info)
 */
function generateProducer(): string {
  return `<Producer>
    <GeneralPartyInfo>
      <NameInfo>
        <CommlName>
          <CommercialName>TCDS Insurance Agency</CommercialName>
        </CommlName>
      </NameInfo>
      <Addr>
        <Addr1>1900 Crestwood Blvd Suite 409</Addr1>
        <City>Irondale</City>
        <StateProvCd>AL</StateProvCd>
        <PostalCode>35210</PostalCode>
      </Addr>
      <Communications>
        <PhoneInfo>
          <PhoneNumber>+1-205-9560055</PhoneNumber>
          <PhoneTypeCd>Phone</PhoneTypeCd>
        </PhoneInfo>
      </Communications>
    </GeneralPartyInfo>
  </Producer>`;
}

/**
 * Generate InsuredOrPrincipal section
 */
function generateInsuredOrPrincipal(doc: PolicyCreatorDocument): string {
  const driver = doc.drivers?.[0];

  return `<InsuredOrPrincipal>
    <GeneralPartyInfo>
      <NameInfo>
        <PersonName>
          <Surname>${escapeXml(doc.insuredLastName || '')}</Surname>
          <GivenName>${escapeXml(doc.insuredFirstName || '')}</GivenName>
        </PersonName>
      </NameInfo>
      <Addr>
        <AddrTypeCd>StreetAddress</AddrTypeCd>
        <Addr1>${escapeXml(doc.insuredAddress || '')}</Addr1>
        <City>${escapeXml(doc.insuredCity || '')}</City>
        <StateProvCd>${escapeXml(doc.insuredState || '')}</StateProvCd>
        <PostalCode>${escapeXml(doc.insuredZip || '')}</PostalCode>
      </Addr>
      ${doc.insuredPhone ? `<Communications>
        <PhoneInfo>
          <PhoneTypeCd>Cell</PhoneTypeCd>
          <PhoneNumber>${formatPhone(doc.insuredPhone)}</PhoneNumber>
        </PhoneInfo>
      </Communications>` : ''}
    </GeneralPartyInfo>
    <InsuredOrPrincipalInfo>
      <InsuredOrPrincipalRoleCd>Insured</InsuredOrPrincipalRoleCd>
      <PersonInfo>
        ${driver?.gender ? `<GenderCd>${driver.gender === 'M' ? 'M' : 'F'}</GenderCd>` : ''}
        ${driver?.dateOfBirth ? `<BirthDt>${formatDate(driver.dateOfBirth)}</BirthDt>` : ''}
        <TitleRelationshipCd>Insured</TitleRelationshipCd>
      </PersonInfo>
    </InsuredOrPrincipalInfo>
  </InsuredOrPrincipal>`;
}

/**
 * Generate PersPolicy section
 */
function generatePersPolicy(doc: PolicyCreatorDocument, lobCd: string): string {
  return `<PersPolicy>
    <LOBCd>${lobCd}</LOBCd>
    ${doc.carrierNAIC ? `<NAICCd>${escapeXml(doc.carrierNAIC)}</NAICCd>` : ''}
    <ControllingStateProvCd>${escapeXml(doc.insuredState || 'AL')}</ControllingStateProvCd>
    ${doc.policyNumber ? `<PolicyNumber>${escapeXml(doc.policyNumber)}</PolicyNumber>` : ''}
    <ContractTerm>
      <DurationPeriod>
        <NumUnits>12</NumUnits>
        <UnitMeasurementCd>Month</UnitMeasurementCd>
      </DurationPeriod>
      ${doc.effectiveDate ? `<EffectiveDt>${formatDate(doc.effectiveDate)}</EffectiveDt>` : ''}
      ${doc.expirationDate ? `<ExpirationDt>${formatDate(doc.expirationDate)}</ExpirationDt>` : ''}
    </ContractTerm>
    ${doc.totalPremium ? `<CurrentTermAmt>
      <Amt>${formatAmount(doc.totalPremium)}</Amt>
      <CurCd>USD</CurCd>
    </CurrentTermAmt>` : ''}
  </PersPolicy>`;
}

/**
 * Generate ACORD XML for Auto policies
 */
export function generateAutoXML(doc: PolicyCreatorDocument): string {
  const rqUID1 = uuid();
  const rqUID2 = uuid();
  const transDate = formatTransactionDate(null);

  // Build vehicles XML
  let vehiclesXml = '';
  let driversXml = '';
  let locationsXml = '';
  let driverVehXml = '';

  // Generate drivers
  if (doc.drivers && doc.drivers.length > 0) {
    doc.drivers.forEach((driver, index) => {
      const driverId = `PersDriver${index + 1}`;
      driversXml += `
        <PersDriver id="${driverId}">
          <GeneralPartyInfo>
            <NameInfo>
              <PersonName>
                <Surname>${escapeXml(driver.lastName || '')}</Surname>
                <GivenName>${escapeXml(driver.firstName || '')}</GivenName>
              </PersonName>
            </NameInfo>
          </GeneralPartyInfo>
          <DriverInfo>
            <PersonInfo>
              ${driver.gender ? `<GenderCd>${driver.gender === 'M' ? 'M' : 'F'}</GenderCd>` : ''}
              ${driver.dateOfBirth ? `<BirthDt>${formatDate(driver.dateOfBirth)}</BirthDt>` : ''}
              <TitleRelationshipCd>${index === 0 ? 'Insured' : 'Spouse'}</TitleRelationshipCd>
            </PersonInfo>
            ${driver.licenseNumber ? `<DriversLicense>
              <LicenseStatusCd>Active</LicenseStatusCd>
              <DriversLicenseNumber>${escapeXml(driver.licenseNumber)}</DriversLicenseNumber>
              <StateProvCd>${escapeXml(driver.licenseState || doc.insuredState || '')}</StateProvCd>
            </DriversLicense>` : ''}
          </DriverInfo>
          <PersDriverInfo>
            <DriverRelationshipToApplicantCd>${index === 0 ? 'IN' : 'SP'}</DriverRelationshipToApplicantCd>
          </PersDriverInfo>
        </PersDriver>`;
    });
  }

  // Generate vehicles
  if (doc.vehicles && doc.vehicles.length > 0) {
    doc.vehicles.forEach((vehicle, index) => {
      const vehId = `Veh${index + 1}`;
      const locationId = `Location${index + 3}`; // Start at 3 since 1 and 2 are for addresses
      const driverRef = doc.drivers && doc.drivers.length > 0 ? 'PersDriver1' : '';

      // Driver-vehicle assignment
      if (driverRef) {
        driverVehXml += `
        <DriverVeh DriverRef="${driverRef}" VehRef="${vehId}">
          <UsePct>100</UsePct>
        </DriverVeh>`;
      }

      // Build coverages for this vehicle
      let coveragesXml = '';
      const vehCoverages = vehicle.coverages || [];
      const policyCoverages = doc.coverages || [];
      const allCoverages = [...vehCoverages, ...policyCoverages];

      allCoverages.forEach((cov) => {
        coveragesXml += `
          <Coverage>
            <CoverageCd>${escapeXml(cov.code)}</CoverageCd>
            ${cov.description ? `<CoverageDesc>${escapeXml(cov.description)}</CoverageDesc>` : ''}
            ${cov.limit ? `<Limit><FormatInteger>${cov.limit}</FormatInteger></Limit>` : ''}
            ${cov.deductible ? `<Deductible><FormatInteger>${cov.deductible}</FormatInteger></Deductible>` : ''}
          </Coverage>`;
      });

      vehiclesXml += `
        <PersVeh id="${vehId}"${driverRef ? ` RatedDriverRef="${driverRef}"` : ''} LocationRef="${locationId}">
          <ModelYear>${vehicle.year || ''}</ModelYear>
          ${vehicle.vin ? `<VehIdentificationNumber>${escapeXml(vehicle.vin)}</VehIdentificationNumber>` : ''}
          ${vehicle.make ? `<Manufacturer>${escapeXml(vehicle.make)}</Manufacturer>` : ''}
          ${vehicle.model ? `<Model>${escapeXml(vehicle.model)}</Model>` : ''}
          <VehUseCd>${mapUsageCode(vehicle.usage)}</VehUseCd>
          ${coveragesXml}
        </PersVeh>`;

      // Add garage location
      locationsXml += `
      <Location id="${locationId}">
        <Addr>
          <Addr1>${escapeXml(vehicle.garageAddress || doc.insuredAddress || '')}</Addr1>
          <City>${escapeXml(vehicle.garageCity || doc.insuredCity || '')}</City>
          <StateProvCd>${escapeXml(vehicle.garageState || doc.insuredState || '')}</StateProvCd>
          <PostalCode>${escapeXml(vehicle.garageZip || doc.insuredZip || '')}</PostalCode>
        </Addr>
      </Location>`;
    });
  }

  // Add insured address locations
  const addressLocations = `
    <Location id="Location1">
      <Addr>
        <AddrTypeCd>StreetAddress</AddrTypeCd>
        <Addr1>${escapeXml(doc.insuredAddress || '')}</Addr1>
        <City>${escapeXml(doc.insuredCity || '')}</City>
        <StateProvCd>${escapeXml(doc.insuredState || '')}</StateProvCd>
        <PostalCode>${escapeXml(doc.insuredZip || '')}</PostalCode>
      </Addr>
    </Location>`;

  return `<?xml version="1.0"?>
<ACORD>
  ${generateSignonRq()}
  <InsuranceSvcRq>
    <RqUID>${rqUID1}</RqUID>
    <PersAutoPolicyQuoteInqRq>
      <RqUID>${rqUID2}</RqUID>
      <TransactionRequestDt>${transDate}</TransactionRequestDt>
      <TransactionEffectiveDt>${transDate}</TransactionEffectiveDt>
      ${generateProducer()}
      ${generateInsuredOrPrincipal(doc)}
      ${generatePersPolicy(doc, 'AUTOP')}
      <PersAutoLineBusiness>
        <LOBCd>AUTOP</LOBCd>
        <ContractTerm>
          <DurationPeriod>
            <NumUnits>12</NumUnits>
            <UnitMeasurementCd>Month</UnitMeasurementCd>
          </DurationPeriod>
          ${doc.effectiveDate ? `<EffectiveDt>${formatDate(doc.effectiveDate)}</EffectiveDt>` : ''}
          ${doc.expirationDate ? `<ExpirationDt>${formatDate(doc.expirationDate)}</ExpirationDt>` : ''}
        </ContractTerm>
        ${doc.totalPremium ? `<CurrentTermAmt>
          <Amt>${formatAmount(doc.totalPremium)}</Amt>
          <CurCd>USD</CurCd>
        </CurrentTermAmt>` : ''}
        ${vehiclesXml}
        ${driversXml}
      </PersAutoLineBusiness>
      ${addressLocations}
      ${locationsXml}
    </PersAutoPolicyQuoteInqRq>
  </InsuranceSvcRq>
</ACORD>`;
}

/**
 * Generate ACORD XML for Home policies
 */
export function generateHomeXML(doc: PolicyCreatorDocument): string {
  const rqUID1 = uuid();
  const rqUID2 = uuid();
  const transDate = formatTransactionDate(null);

  // Get property info
  const property = doc.properties?.[0];

  // Build dwelling info
  let dwellXml = '';
  if (property) {
    dwellXml = `
        <Dwell LocationRef="Location1">
          <PrincipalUnitAtRiskInd>1</PrincipalUnitAtRiskInd>
          ${property.constructionType ? `<Construction>
            <ConstructionCd>${mapConstructionCode(property.constructionType)}</ConstructionCd>
          </Construction>` : ''}
          ${property.roofType ? `<Construction>
            <RoofingMaterial>
              <RoofMaterialCd>${mapRoofCode(property.roofType)}</RoofMaterialCd>
            </RoofingMaterial>
          </Construction>` : ''}
          <DwellOccupancy>
            <OccupancyTypeCd>COC</OccupancyTypeCd>
          </DwellOccupancy>
        </Dwell>`;
  }

  // Build coverages
  let coveragesXml = '';
  const allCoverages = [...(doc.coverages || []), ...(property?.coverages || [])];
  allCoverages.forEach((cov) => {
    coveragesXml += `
      <Coverage>
        <CoverageCd>${escapeXml(cov.code)}</CoverageCd>
        ${cov.description ? `<CoverageDesc>${escapeXml(cov.description)}</CoverageDesc>` : ''}
        ${cov.limit ? `<Limit><FormatInteger>${cov.limit}</FormatInteger></Limit>` : ''}
        ${cov.deductible ? `<Deductible><FormatInteger>${cov.deductible}</FormatInteger></Deductible>` : ''}
      </Coverage>`;
  });

  // Build mortgagee/additional interest
  let additionalInterestXml = '';
  if (doc.mortgagees && doc.mortgagees.length > 0) {
    doc.mortgagees.forEach((mort, index) => {
      additionalInterestXml += `
        <AdditionalInterest>
          <GeneralPartyInfo>
            <NameInfo>
              <CommlName>
                <CommercialName>${escapeXml(mort.name)}</CommercialName>
              </CommlName>
            </NameInfo>
            <Addr>
              ${mort.address ? `<Addr1>${escapeXml(mort.address)}</Addr1>` : ''}
              ${mort.city ? `<City>${escapeXml(mort.city)}</City>` : ''}
              ${mort.state ? `<StateProv>${escapeXml(mort.state)}</StateProv>` : ''}
              ${mort.zip ? `<PostalCode>${escapeXml(mort.zip)}</PostalCode>` : ''}
            </Addr>
          </GeneralPartyInfo>
          <AdditionalInterestInfo>
            <InterestRank>${index + 1}</InterestRank>
            <PayorInd>0</PayorInd>
            <NatureInterestCd>${mapInterestCode(mort.interestType)}</NatureInterestCd>
            ${mort.loanNumber ? `<LoanNumber>${escapeXml(mort.loanNumber)}</LoanNumber>` : ''}
          </AdditionalInterestInfo>
        </AdditionalInterest>`;
    });
  }

  return `<?xml version="1.0"?>
<ACORD>
  ${generateSignonRq()}
  <InsuranceSvcRq>
    <RqUID>${rqUID1}</RqUID>
    <SPName>www.hawksoftinc.com</SPName>
    <HomePolicyQuoteInqRq>
      <RqUID>${rqUID2}</RqUID>
      <TransactionRequestDt>${transDate}</TransactionRequestDt>
      <TransactionEffectiveDt>${transDate}</TransactionEffectiveDt>
      ${generateProducer()}
      ${generateInsuredOrPrincipal(doc)}
      ${generatePersPolicy(doc, 'HOME')}
      <HomeLineBusiness>
        <LOBCd>HOME</LOBCd>
        <ContractTerm>
          <DurationPeriod>
            <NumUnits>12</NumUnits>
            <UnitMeasurementCd>Month</UnitMeasurementCd>
          </DurationPeriod>
          ${doc.effectiveDate ? `<EffectiveDt>${formatDate(doc.effectiveDate)}</EffectiveDt>` : ''}
          ${doc.expirationDate ? `<ExpirationDt>${formatDate(doc.expirationDate)}</ExpirationDt>` : ''}
        </ContractTerm>
        ${doc.totalPremium ? `<CurrentTermAmt>
          <Amt>${formatAmount(doc.totalPremium)}</Amt>
          <CurCd>USD</CurCd>
        </CurrentTermAmt>` : ''}
        ${dwellXml}
        ${coveragesXml}
      </HomeLineBusiness>
      <Location id="Location1">
        <Addr>
          <AddrTypeCd>PhysicalRisk</AddrTypeCd>
          <Addr1>${escapeXml(property?.address || doc.insuredAddress || '')}</Addr1>
          <City>${escapeXml(property?.city || doc.insuredCity || '')}</City>
          ${property?.county ? `<County>${escapeXml(property.county)}</County>` : ''}
          <StateProvCd>${escapeXml(property?.state || doc.insuredState || '')}</StateProvCd>
          <PostalCode>${escapeXml(property?.zip || doc.insuredZip || '')}</PostalCode>
        </Addr>
        ${additionalInterestXml}
      </Location>
      <Location id="Location2">
        <Addr>
          <AddrTypeCd>StreetAddress</AddrTypeCd>
          <Addr1>${escapeXml(doc.insuredAddress || '')}</Addr1>
          <City>${escapeXml(doc.insuredCity || '')}</City>
          <StateProvCd>${escapeXml(doc.insuredState || '')}</StateProvCd>
          <PostalCode>${escapeXml(doc.insuredZip || '')}</PostalCode>
        </Addr>
      </Location>
    </HomePolicyQuoteInqRq>
  </InsuranceSvcRq>
</ACORD>`;
}

/**
 * Map vehicle usage to ACORD code
 */
function mapUsageCode(usage: string | null | undefined): string {
  if (!usage) return 'PP'; // Pleasure
  const lower = usage.toLowerCase();
  if (lower.includes('business')) return 'BU';
  if (lower.includes('commute') || lower.includes('work')) return 'DW';
  if (lower.includes('farm')) return 'FM';
  return 'PP'; // Pleasure/Personal
}

/**
 * Map construction type to ACORD code
 */
function mapConstructionCode(construction: string | null | undefined): string {
  if (!construction) return 'F'; // Frame
  const lower = construction.toLowerCase();
  if (lower.includes('brick') || lower.includes('masonry')) return 'M';
  if (lower.includes('steel') || lower.includes('metal')) return 'S';
  if (lower.includes('concrete')) return 'C';
  return 'F'; // Frame
}

/**
 * Map roof type to ACORD code
 */
function mapRoofCode(roof: string | null | undefined): string {
  if (!roof) return 'ARCH';
  const lower = roof.toLowerCase();
  if (lower.includes('metal')) return 'MTL';
  if (lower.includes('tile')) return 'TILE';
  if (lower.includes('slate')) return 'SLAT';
  if (lower.includes('wood') || lower.includes('shake')) return 'WDSH';
  if (lower.includes('flat')) return 'FLAT';
  return 'ARCH'; // Architectural shingles
}

/**
 * Map interest type to ACORD code
 */
function mapInterestCode(interestType: string | null | undefined): string {
  if (!interestType) return 'MO'; // Mortgagee
  switch (interestType) {
    case 'MG':
      return 'MO'; // Mortgagee
    case 'LH':
      return 'LH'; // Lienholder
    case 'LP':
      return 'LP'; // Loss Payee
    case 'AI':
      return 'ADDIN'; // Additional Insured
    default:
      return 'MO';
  }
}

/**
 * Main entry point - determines LOB and generates appropriate XML
 */
export function generateACORDXML(doc: PolicyCreatorDocument): {
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
    return {
      xml,
      format: 'auto',
      filename: 'ACORD-AUTO.xml',
    };
  } else {
    const xml = generateHomeXML(doc);
    return {
      xml,
      format: 'home',
      filename: 'ACORD-HOME.xml',
    };
  }
}
