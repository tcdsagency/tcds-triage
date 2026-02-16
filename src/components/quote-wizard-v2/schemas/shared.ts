/**
 * Shared Zod Schema Fragments
 * ============================
 * Reusable schema pieces composed into per-type schemas.
 */

import { z } from 'zod';

// =============================================================================
// PRIMITIVE VALIDATORS
// =============================================================================

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine(
    (val) => val.replace(/\D/g, '').length >= 10,
    'Please enter a valid phone number'
  );

export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .or(z.literal(''));

export const zipSchema = z
  .string()
  .min(1, 'ZIP code is required')
  .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code');

export const dateSchema = z
  .string()
  .min(1, 'Date is required')
  .refine(
    (val) => !isNaN(new Date(val).getTime()),
    'Please enter a valid date'
  );

export const optionalDateSchema = z
  .string()
  .refine(
    (val) => !val || !isNaN(new Date(val).getTime()),
    'Please enter a valid date'
  )
  .optional()
  .default('');

// =============================================================================
// CONTACT SCHEMA
// =============================================================================

export const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: phoneSchema,
  email: emailSchema.optional().default(''),
  dob: dateSchema,
  gender: z.string().optional().default(''),
  maritalStatus: z.string().optional().default(''),
});

export const contactSchemaMinimal = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: phoneSchema,
  email: emailSchema.optional().default(''),
  dob: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  maritalStatus: z.string().optional().default(''),
});

// =============================================================================
// ADDRESS SCHEMA
// =============================================================================

export const addressSchema = z.object({
  address: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: zipSchema,
});

export const optionalAddressSchema = z.object({
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  zip: z.string().optional().default(''),
});

export const propertyAddressSchema = z.object({
  propertySameAsMailing: z.boolean().optional().default(true),
  propertyAddress: z.string().min(1, 'Property address is required'),
  propertyCity: z.string().min(1, 'City is required'),
  propertyState: z.string().min(1, 'State is required'),
  propertyZip: zipSchema,
  yearsAtPropertyAddress: z.string().optional().default(''),
  priorAddress: z.string().optional().default(''),
  priorCity: z.string().optional().default(''),
  priorState: z.string().optional().default(''),
  priorZip: z.string().optional().default(''),
});

// =============================================================================
// SPOUSE SCHEMA
// =============================================================================

export const spouseSchema = z.object({
  hasSpouse: z.boolean().optional().default(false),
  spouseFirstName: z.string().optional().default(''),
  spouseLastName: z.string().optional().default(''),
  spouseDob: z.string().optional().default(''),
  spouseLicenseNumber: z.string().optional().default(''),
  spouseLicenseState: z.string().optional().default(''),
});

// =============================================================================
// LICENSE SCHEMA
// =============================================================================

export const licenseSchema = z.object({
  licenseNumber: z.string().optional().default(''),
  licenseState: z.string().optional().default(''),
});

// =============================================================================
// VEHICLE SCHEMA
// =============================================================================

export const vehicleSchema = z.object({
  id: z.string(),
  vin: z.string().optional().default(''),
  year: z.string().min(1, 'Year is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  ownership: z.string().optional().default('owned'),
  primaryUse: z.string().optional().default('commute'),
  annualMileage: z.string().optional().default(''),
  garageLocation: z.string().optional().default('same'),
  compDeductible: z.string().optional().default('500'),
  collDeductible: z.string().optional().default('500'),
});

export type Vehicle = z.infer<typeof vehicleSchema>;

// =============================================================================
// DRIVER SCHEMA
// =============================================================================

export const driverSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.string().optional().default(''),
  relationship: z.string().optional().default('self'),
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseState: z.string().min(1, 'License state is required'),
  yearsLicensed: z.string().optional().default(''),
  hasAccidents: z.boolean().optional().default(false),
  hasViolations: z.boolean().optional().default(false),
});

export type Driver = z.infer<typeof driverSchema>;

// =============================================================================
// AUTO COVERAGE SCHEMA
// =============================================================================

export const autoCoverageSchema = z.object({
  bodilyInjury: z.string().min(1, 'Bodily injury limit is required'),
  propertyDamage: z.string().min(1, 'Property damage limit is required'),
  umUim: z.string().optional().default('100/300'),
  medPay: z.string().optional().default('5000'),
  comprehensive: z.string().optional().default('500'),
  collision: z.string().optional().default('500'),
  rental: z.boolean().optional().default(false),
  roadside: z.boolean().optional().default(false),
});

// =============================================================================
// HOME COVERAGE SCHEMA
// =============================================================================

export const homeCoverageSchema = z.object({
  dwelling: z.string().min(1, 'Dwelling coverage is required'),
  otherStructures: z.string().optional().default(''),
  personalProperty: z.string().optional().default(''),
  liability: z.string().min(1, 'Liability coverage is required'),
  medicalPayments: z.string().optional().default('5000'),
  deductible: z.string().optional().default('1000'),
  hurricaneDeductible: z.string().optional().default('2%'),
  waterBackup: z.boolean().optional().default(false),
  identityTheft: z.boolean().optional().default(false),
  equipmentBreakdown: z.boolean().optional().default(false),
});

// =============================================================================
// PROPERTY DETAILS SCHEMA
// =============================================================================

export const propertyDetailsSchema = z.object({
  propertyType: z.string().optional().default(''),
  occupancy: z.string().optional().default(''),
  yearBuilt: z.string().min(1, 'Year built is required'),
  squareFootage: z.string().optional().default(''),
  purchaseDate: z.string().optional().default(''),
  stories: z.string().optional().default(''),
  numberOfOccupants: z.string().optional().default(''),
  fullBathrooms: z.string().optional().default(''),
  halfBathrooms: z.string().optional().default(''),
  constructionType: z.string().min(1, 'Construction type is required'),
  foundationType: z.string().optional().default(''),
  garageType: z.string().optional().default(''),
  roofMaterial: z.string().min(1, 'Roof material is required'),
  roofAge: z.string().optional().default(''),
  rprData: z.any().optional().default(null),
});

// =============================================================================
// SYSTEMS SCHEMA
// =============================================================================

export const systemsSchema = z.object({
  heatingType: z.string().optional().default(''),
  electricalUpdate: z.string().optional().default(''),
  plumbingUpdate: z.string().optional().default(''),
});

// =============================================================================
// SAFETY SCHEMA
// =============================================================================

export const safetySchema = z.object({
  hasSecuritySystem: z.boolean().optional().default(false),
  securityMonitored: z.boolean().optional().default(false),
  hasFireAlarm: z.boolean().optional().default(false),
  hasSprinklers: z.boolean().optional().default(false),
  hasDeadbolts: z.boolean().optional().default(false),
  distanceToFireStation: z.string().optional().default(''),
  distanceToHydrant: z.string().optional().default(''),
});

// =============================================================================
// LIABILITY EXPOSURES SCHEMA
// =============================================================================

export const liabilityExposuresSchema = z.object({
  hasPool: z.boolean().optional().default(false),
  poolType: z.string().optional().default(''),
  poolFenced: z.boolean().optional().default(false),
  hasTrampoline: z.boolean().optional().default(false),
  hasDog: z.boolean().optional().default(false),
  dogBreed: z.string().optional().default(''),
});

// =============================================================================
// MORTGAGE SCHEMA
// =============================================================================

export const mortgageSchema = z.object({
  hasMortgage: z.boolean().optional().default(false),
  mortgageCompany: z.string().optional().default(''),
  loanNumber: z.string().optional().default(''),
});

// =============================================================================
// CURRENT INSURANCE SCHEMA
// =============================================================================

export const currentInsuranceSchema = z.object({
  hasCurrentInsurance: z.boolean().optional().default(false),
  currentCarrier: z.string().optional().default(''),
  currentPremium: z.string().optional().default(''),
  yearsWithCarrier: z.string().optional().default(''),
  reasonForShopping: z.string().optional().default(''),
});

// =============================================================================
// CLAIMS SCHEMA
// =============================================================================

export const claimsSchema = z.object({
  hasClaims: z.boolean().optional().default(false),
  claimsDescription: z.string().optional().default(''),
});

// =============================================================================
// DISCOUNT OPTIONS SCHEMA
// =============================================================================

export const discountSchema = z.object({
  multiPolicy: z.boolean().optional().default(false),
  homeowner: z.boolean().optional().default(false),
  goodDriver: z.boolean().optional().default(false),
  goodStudent: z.boolean().optional().default(false),
  defensive: z.boolean().optional().default(false),
  lowMileage: z.boolean().optional().default(false),
  paperless: z.boolean().optional().default(false),
  autoPay: z.boolean().optional().default(false),
  claimFree: z.boolean().optional().default(false),
  newPurchase: z.boolean().optional().default(false),
  loyalty: z.boolean().optional().default(false),
});

// =============================================================================
// SUBMISSION SCHEMA
// =============================================================================

export const submissionSchema = z.object({
  effectiveDate: z.string().min(1, 'Effective date is required'),
  agentNotes: z.string().optional().default(''),
});

// =============================================================================
// BUSINESS SCHEMA
// =============================================================================

export const businessSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  businessType: z.string().min(1, 'Business type is required'),
  businessDescription: z.string().optional().default(''),
  yearsInBusiness: z.string().min(1, 'Years in business is required'),
  annualRevenue: z.string().min(1, 'Annual revenue is required'),
  employeeCount: z.string().optional().default(''),
  fein: z.string().optional().default(''),
});
