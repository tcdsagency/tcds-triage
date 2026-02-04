import type { QuoteType } from '../schemas';

const contactDefaults = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  dob: '',
  gender: '',
  maritalStatus: '',
};

const addressDefaults = {
  address: '',
  city: '',
  state: '',
  zip: '',
};

const spouseDefaults = {
  hasSpouse: false,
  spouseFirstName: '',
  spouseLastName: '',
  spouseDob: '',
  spouseLicenseNumber: '',
  spouseLicenseState: '',
};

const licenseDefaults = {
  licenseNumber: '',
  licenseState: '',
};

const propertyAddressDefaults = {
  propertySameAsMailing: true,
  propertyAddress: '',
  propertyCity: '',
  propertyState: '',
  propertyZip: '',
  yearsAtPropertyAddress: '',
  priorAddress: '',
  priorCity: '',
  priorState: '',
  priorZip: '',
};

const submissionDefaults = {
  effectiveDate: '',
  agentNotes: '',
};

const currentInsuranceDefaults = {
  hasCurrentInsurance: false,
  currentCarrier: '',
  currentPremium: '',
  yearsWithCarrier: '',
  reasonForShopping: '',
};

const claimsDefaults = {
  hasClaims: false,
  claimsDescription: '',
};

const discountDefaults = {
  multiPolicy: false,
  homeowner: false,
  goodDriver: false,
  goodStudent: false,
  defensive: false,
  lowMileage: false,
  paperless: false,
  autoPay: false,
  claimFree: false,
  newPurchase: false,
  loyalty: false,
};

const defaultVehicle = {
  id: 'v1',
  vin: '',
  year: '',
  make: '',
  model: '',
  ownership: 'owned',
  primaryUse: 'commute',
  annualMileage: '',
  garageLocation: 'same',
  compDeductible: '500',
  collDeductible: '500',
};

const defaultDriver = {
  id: 'd1',
  firstName: '',
  lastName: '',
  dob: '',
  gender: '',
  relationship: 'self',
  licenseNumber: '',
  licenseState: '',
  yearsLicensed: '',
  hasAccidents: false,
  hasViolations: false,
};

const autoCoverageDefaults = {
  bodilyInjury: '100/300',
  propertyDamage: '100000',
  umUim: '100/300',
  medPay: '5000',
  comprehensive: '500',
  collision: '500',
  rental: false,
  roadside: false,
};

const homeCoverageDefaults = {
  dwelling: '',
  otherStructures: '',
  personalProperty: '',
  liability: '300000',
  medicalPayments: '5000',
  deductible: '1000',
  hurricaneDeductible: '2%',
  waterBackup: false,
  identityTheft: false,
  equipmentBreakdown: false,
};

const rentersCoverageDefaults = {
  personalProperty: '',
  liability: '300000',
  medicalPayments: '5000',
  deductible: '1000',
  waterBackup: false,
  identityTheft: false,
};

const floodCoverageDefaults = {
  dwelling: '',
  personalProperty: '',
  deductible: '1000',
};

const umbrellaCoverageDefaults = {
  umbrellaLimit: '',
  bodilyInjury: '',
  liability: '',
};

const bopCoverageDefaults = {
  liability: '',
  propertyDamage: '',
  medicalPayments: '',
  deductible: '1000',
};

const glCoverageDefaults = {
  liability: '',
  aggregate: '',
  medicalPayments: '',
  deductible: '',
};

const wcCoverageDefaults = {
  liability: '',
};

const propertyDetailsDefaults = {
  propertyType: '',
  occupancy: '',
  yearBuilt: '',
  squareFootage: '',
  stories: '',
  constructionType: '',
  foundationType: '',
  garageType: '',
  roofMaterial: '',
  roofAge: '',
  rprData: null,
};

const systemsDefaults = {
  heatingType: '',
  electricalUpdate: '',
  plumbingUpdate: '',
};

const safetyDefaults = {
  hasSecuritySystem: false,
  securityMonitored: false,
  hasFireAlarm: false,
  hasSprinklers: false,
  hasDeadbolts: false,
  distanceToFireStation: '',
  distanceToHydrant: '',
};

const liabilityExposuresDefaults = {
  hasPool: false,
  poolType: '',
  poolFenced: false,
  hasTrampoline: false,
  hasDog: false,
  dogBreed: '',
};

const mortgageDefaults = {
  hasMortgage: false,
  mortgageCompany: '',
  loanNumber: '',
};

const floodDetailsDefaults = {
  propertyType: '',
  yearBuilt: '',
  squareFootage: '',
  foundationType: '',
  stories: '',
  constructionType: '',
  elevationCertificate: false,
  baseFloodElevation: '',
  lowestFloorElevation: '',
  occupancy: '',
  rprData: null,
};

const businessDefaults = {
  businessName: '',
  businessType: '',
  businessDescription: '',
  yearsInBusiness: '',
  annualRevenue: '',
  employeeCount: '',
  fein: '',
};

const glBusinessDefaults = {
  businessName: '',
  businessType: '',
  businessDescription: '',
  yearsInBusiness: '',
  annualRevenue: '',
  employeeCount: '',
  fein: '',
  classCode: '',
  hasSubcontractors: false,
  needsCOI: false,
};

const wcBusinessDefaults = {
  businessName: '',
  businessType: '',
  businessDescription: '',
  yearsInBusiness: '',
  annualRevenue: '',
  employeeCount: '',
  fein: '',
  governingClassCode: '',
  experienceMod: '',
  claimsInPast3Years: '0',
};

export const personalAutoDefaults = {
  ...contactDefaults,
  ...addressDefaults,
  ...spouseDefaults,
  ...licenseDefaults,
  ...currentInsuranceDefaults,
  ...claimsDefaults,
  ...submissionDefaults,
  vehicles: [{ ...defaultVehicle }],
  drivers: [{ ...defaultDriver }],
  coverage: { ...autoCoverageDefaults },
  discounts: { ...discountDefaults },
};

export const homeownersDefaults = {
  ...contactDefaults,
  ...propertyAddressDefaults,
  ...propertyDetailsDefaults,
  ...systemsDefaults,
  ...safetyDefaults,
  ...liabilityExposuresDefaults,
  ...mortgageDefaults,
  ...currentInsuranceDefaults,
  ...claimsDefaults,
  ...submissionDefaults,
  coverage: { ...homeCoverageDefaults },
  discounts: { ...discountDefaults },
};

export const rentersDefaults = {
  ...contactDefaults,
  ...propertyAddressDefaults,
  ...currentInsuranceDefaults,
  ...claimsDefaults,
  ...submissionDefaults,
  unitType: '',
  moveInDate: '',
  coverage: { ...rentersCoverageDefaults },
  discounts: { ...discountDefaults },
};

export const mobileHomeDefaults = {
  ...contactDefaults,
  ...propertyAddressDefaults,
  ...systemsDefaults,
  ...safetyDefaults,
  ...liabilityExposuresDefaults,
  ...mortgageDefaults,
  ...currentInsuranceDefaults,
  ...claimsDefaults,
  ...submissionDefaults,
  propertyType: 'mobile_home',
  occupancy: '',
  yearBuilt: '',
  squareFootage: '',
  stories: '1',
  constructionType: '',
  foundationType: '',
  garageType: '',
  roofMaterial: '',
  roofAge: '',
  rprData: null,
  coverage: { ...homeCoverageDefaults },
  discounts: { ...discountDefaults },
};

export const floodDefaults = {
  ...contactDefaults,
  ...propertyAddressDefaults,
  ...floodDetailsDefaults,
  ...currentInsuranceDefaults,
  ...claimsDefaults,
  ...submissionDefaults,
  coverage: { ...floodCoverageDefaults },
};

export const umbrellaDefaults = {
  ...contactDefaults,
  ...addressDefaults,
  ...liabilityExposuresDefaults,
  ...currentInsuranceDefaults,
  ...submissionDefaults,
  coverage: { ...umbrellaCoverageDefaults },
  currentCarrier: '',
};

export const bopDefaults = {
  ...contactDefaults,
  ...businessDefaults,
  ...propertyAddressDefaults,
  ...currentInsuranceDefaults,
  ...submissionDefaults,
  coverage: { ...bopCoverageDefaults },
};

export const generalLiabilityDefaults = {
  ...contactDefaults,
  ...glBusinessDefaults,
  ...propertyAddressDefaults,
  ...currentInsuranceDefaults,
  ...submissionDefaults,
  coverage: { ...glCoverageDefaults },
};

export const workersCompDefaults = {
  ...contactDefaults,
  ...wcBusinessDefaults,
  ...propertyAddressDefaults,
  ...currentInsuranceDefaults,
  ...submissionDefaults,
  coverage: { ...wcCoverageDefaults },
};

export const recreationalDefaults = {
  ...contactDefaults,
  ...addressDefaults,
  ...currentInsuranceDefaults,
  ...claimsDefaults,
  ...submissionDefaults,
  vehicles: [{ ...defaultVehicle }],
  coverage: { ...autoCoverageDefaults },
  discounts: { ...discountDefaults },
};

const defaultsMap: Record<QuoteType, Record<string, any>> = {
  personal_auto: personalAutoDefaults,
  homeowners: homeownersDefaults,
  renters: rentersDefaults,
  mobile_home: mobileHomeDefaults,
  flood: floodDefaults,
  umbrella: umbrellaDefaults,
  bop: bopDefaults,
  general_liability: generalLiabilityDefaults,
  workers_comp: workersCompDefaults,
  recreational: recreationalDefaults,
};

export function getDefaultsForType(type: QuoteType): Record<string, any> {
  return defaultsMap[type];
}
