/**
 * Quote Wizard Type Definitions
 * =============================
 * Core types for the wizard-based quote form system.
 */

import { LucideIcon } from 'lucide-react';
import { EligibilityResult } from '@/lib/eligibility/types';

// =============================================================================
// QUOTE TYPES
// =============================================================================

export type QuoteType =
  | 'personal_auto'
  | 'homeowners'
  | 'renters'
  | 'mobile_home'
  | 'umbrella'
  | 'bop'
  | 'general_liability'
  | 'workers_comp'
  | 'recreational';

export interface QuoteTypeConfig {
  id: QuoteType;
  label: string;
  description: string;
  icon: LucideIcon;
  steps: StepConfig[];
}

// =============================================================================
// STEP CONFIGURATION
// =============================================================================

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  validate: (data: QuoteFormData) => Record<string, string>;
  requiredFields: string[];
}

export interface StepProps {
  formData: QuoteFormData;
  updateField: (field: string, value: any) => void;
  updateNestedField: (section: string, field: string, value: any) => void;
  errors: Record<string, string>;
}

// =============================================================================
// FORM DATA STRUCTURES
// =============================================================================

export interface QuoteFormData {
  // Contact Info (shared across all types)
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  maritalStatus: string;

  // Spouse/Co-Insured
  hasSpouse: boolean;
  spouseFirstName: string;
  spouseLastName: string;
  spouseDob: string;

  // Address
  address: string;
  city: string;
  state: string;
  zip: string;

  // Property Address (for home quotes)
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;

  // Property Details
  propertyType: string;
  occupancy: string;
  yearBuilt: string;
  squareFootage: string;
  stories: string;
  constructionType: string;
  foundationType: string;
  garageType: string;

  // Roof
  roofMaterial: string;
  roofAge: string;

  // Systems
  heatingType: string;
  electricalUpdate: string;
  plumbingUpdate: string;

  // Safety
  hasSecuritySystem: boolean;
  securityMonitored: boolean;
  hasFireAlarm: boolean;
  hasSprinklers: boolean;
  hasDeadbolts: boolean;
  distanceToFireStation: string;
  distanceToHydrant: string;

  // Liability
  hasPool: boolean;
  poolType: string;
  poolFenced: boolean;
  hasTrampoline: boolean;
  hasDog: boolean;
  dogBreed: string;

  // Mortgage
  hasMortgage: boolean;
  mortgageCompany: string;
  loanNumber: string;

  // Vehicles (auto)
  vehicles: Vehicle[];

  // Drivers (auto)
  drivers: Driver[];

  // Coverage Options
  coverage: CoverageOptions;

  // Current Insurance
  hasCurrentInsurance: boolean;
  currentCarrier: string;
  currentPremium: string;
  yearsWithCarrier: string;
  reasonForShopping: string;

  // Claims History
  hasClaims: boolean;
  claimsDescription: string;

  // Discounts
  discounts: DiscountOptions;

  // Submission
  effectiveDate: string;
  agentNotes: string;

  // Business fields (commercial)
  businessName: string;
  businessType: string;
  businessDescription: string;
  yearsInBusiness: string;
  annualRevenue: string;
  employeeCount: string;
  fein: string;
}

export interface Vehicle {
  id: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  ownership: string;
  primaryUse: string;
  annualMileage: string;
  garageLocation: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  relationship: string;
  licenseNumber: string;
  licenseState: string;
  yearsLicensed: string;
  hasAccidents: boolean;
  hasViolations: boolean;
}

export interface CoverageOptions {
  // Auto
  bodilyInjury: string;
  propertyDamage: string;
  umUim: string;
  medPay: string;
  comprehensive: string;
  collision: string;
  rental: boolean;
  roadside: boolean;

  // Home
  dwelling: string;
  otherStructures: string;
  personalProperty: string;
  liability: string;
  medicalPayments: string;
  deductible: string;
  hurricaneDeductible: string;
  waterBackup: boolean;
  identityTheft: boolean;
  equipmentBreakdown: boolean;

  // Umbrella
  umbrellaLimit: string;
}

export interface DiscountOptions {
  multiPolicy: boolean;
  homeowner: boolean;
  goodDriver: boolean;
  goodStudent: boolean;
  defensive: boolean;
  lowMileage: boolean;
  paperless: boolean;
  autoPay: boolean;
  claimFree: boolean;
  newPurchase: boolean;
  loyalty: boolean;
}

// =============================================================================
// WIZARD CONTEXT
// =============================================================================

export interface QuoteWizardContextType {
  // Quote type
  quoteType: QuoteType;

  // Step navigation
  currentStep: number;
  totalSteps: number;
  steps: StepConfig[];
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;

  // Form data
  formData: QuoteFormData;
  updateField: (field: string, value: any) => void;
  updateNestedField: (section: string, field: string, value: any) => void;

  // Arrays
  addVehicle: () => void;
  removeVehicle: (id: string) => void;
  updateVehicle: (id: string, field: string, value: any) => void;
  addDriver: () => void;
  removeDriver: (id: string) => void;
  updateDriver: (id: string, field: string, value: any) => void;

  // Validation
  errors: Record<string, string>;
  validateCurrentStep: () => boolean;
  isStepComplete: (step: number) => boolean;
  getStepProgress: () => number;

  // Eligibility
  eligibility: EligibilityResult | null;

  // Save/Submit
  saveAsDraft: () => Promise<void>;
  submitQuote: () => Promise<void>;
  isSaving: boolean;
  isSubmitting: boolean;
  lastSaved: Date | null;
}

// =============================================================================
// INITIAL STATES
// =============================================================================

export const createEmptyVehicle = (): Vehicle => ({
  id: crypto.randomUUID(),
  vin: '',
  year: '',
  make: '',
  model: '',
  ownership: 'owned',
  primaryUse: 'commute',
  annualMileage: '',
  garageLocation: 'same',
});

export const createEmptyDriver = (): Driver => ({
  id: crypto.randomUUID(),
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
});

export const initialFormData: QuoteFormData = {
  // Contact
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  dob: '',
  gender: '',
  maritalStatus: '',

  // Spouse
  hasSpouse: false,
  spouseFirstName: '',
  spouseLastName: '',
  spouseDob: '',

  // Address
  address: '',
  city: '',
  state: '',
  zip: '',

  // Property Address
  propertyAddress: '',
  propertyCity: '',
  propertyState: '',
  propertyZip: '',

  // Property Details
  propertyType: '',
  occupancy: '',
  yearBuilt: '',
  squareFootage: '',
  stories: '',
  constructionType: '',
  foundationType: '',
  garageType: '',

  // Roof
  roofMaterial: '',
  roofAge: '',

  // Systems
  heatingType: '',
  electricalUpdate: '',
  plumbingUpdate: '',

  // Safety
  hasSecuritySystem: false,
  securityMonitored: false,
  hasFireAlarm: false,
  hasSprinklers: false,
  hasDeadbolts: false,
  distanceToFireStation: '',
  distanceToHydrant: '',

  // Liability
  hasPool: false,
  poolType: '',
  poolFenced: false,
  hasTrampoline: false,
  hasDog: false,
  dogBreed: '',

  // Mortgage
  hasMortgage: false,
  mortgageCompany: '',
  loanNumber: '',

  // Vehicles & Drivers
  vehicles: [createEmptyVehicle()],
  drivers: [createEmptyDriver()],

  // Coverage
  coverage: {
    bodilyInjury: '100/300',
    propertyDamage: '100000',
    umUim: '100/300',
    medPay: '5000',
    comprehensive: '500',
    collision: '500',
    rental: false,
    roadside: false,
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
    umbrellaLimit: '1000000',
  },

  // Current Insurance
  hasCurrentInsurance: false,
  currentCarrier: '',
  currentPremium: '',
  yearsWithCarrier: '',
  reasonForShopping: '',

  // Claims
  hasClaims: false,
  claimsDescription: '',

  // Discounts
  discounts: {
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
  },

  // Submission
  effectiveDate: '',
  agentNotes: '',

  // Business
  businessName: '',
  businessType: '',
  businessDescription: '',
  yearsInBusiness: '',
  annualRevenue: '',
  employeeCount: '',
  fein: '',
};
