import {
  User,
  Car,
  Users,
  Shield,
  ClipboardCheck,
  Home,
  Wrench,
  Droplets,
  FileText,
  Briefcase,
  Building,
  Bike,
  Umbrella,
} from 'lucide-react';
import type { StepConfig } from './types';
import type { QuoteType } from '../schemas';

const contactStep: StepConfig = {
  id: 'contact',
  title: 'Contact Information',
  description: 'Basic contact and personal details',
  icon: User,
  fields: ['firstName', 'lastName', 'phone', 'dob'],
};

const contactWithAddressStep: StepConfig = {
  id: 'contact',
  title: 'Contact Information',
  description: 'Contact details and mailing address',
  icon: User,
  fields: ['firstName', 'lastName', 'phone', 'dob', 'address', 'city', 'state', 'zip'],
};

const vehiclesStep: StepConfig = {
  id: 'vehicles',
  title: 'Vehicles',
  description: 'Add vehicles to be insured',
  icon: Car,
  fields: ['vehicles'],
};

const driversStep: StepConfig = {
  id: 'drivers',
  title: 'Drivers',
  description: 'List all drivers in the household',
  icon: Users,
  fields: ['drivers'],
};

const autoCoverageStep: StepConfig = {
  id: 'coverage',
  title: 'Coverage Options',
  description: 'Select liability limits and deductibles',
  icon: Shield,
  fields: [
    'coverage.bodilyInjury',
    'coverage.propertyDamage',
    'coverage.umUim',
    'coverage.medPay',
    'coverage.comprehensive',
    'coverage.collision',
  ],
};

const reviewStep: StepConfig = {
  id: 'review',
  title: 'Review & Submit',
  description: 'Verify information and submit quote request',
  icon: ClipboardCheck,
  fields: ['effectiveDate'],
};

const propertyStep: StepConfig = {
  id: 'property',
  title: 'Property Information',
  description: 'Property address and type details',
  icon: Home,
  fields: [
    'propertyAddress',
    'propertyCity',
    'propertyState',
    'propertyZip',
    'propertyType',
    'yearBuilt',
  ],
};

const propertyStepRenters: StepConfig = {
  id: 'property',
  title: 'Property Information',
  description: 'Rental property address',
  icon: Home,
  fields: ['propertyAddress', 'propertyCity', 'propertyState', 'propertyZip'],
};

const propertyStepFlood: StepConfig = {
  id: 'property',
  title: 'Property Information',
  description: 'Property location and type',
  icon: Home,
  fields: [
    'propertyAddress',
    'propertyCity',
    'propertyState',
    'propertyZip',
    'propertyType',
    'yearBuilt',
  ],
};

const detailsStep: StepConfig = {
  id: 'details',
  title: 'Property Details',
  description: 'Construction and structural information',
  icon: Wrench,
  fields: ['constructionType', 'roofMaterial'],
};

const homeCoverageStep: StepConfig = {
  id: 'homeCoverage',
  title: 'Coverage Options',
  description: 'Dwelling limits and optional endorsements',
  icon: Shield,
  fields: [
    'coverage.dwelling',
    'coverage.otherStructures',
    'coverage.personalProperty',
    'coverage.liability',
    'coverage.medicalPayments',
    'coverage.deductible',
  ],
};

const rentersCoverageStep: StepConfig = {
  id: 'homeCoverage',
  title: 'Coverage Options',
  description: 'Personal property and liability limits',
  icon: Shield,
  fields: [
    'coverage.personalProperty',
    'coverage.liability',
    'coverage.medicalPayments',
    'coverage.deductible',
  ],
};

const floodCoverageStep: StepConfig = {
  id: 'homeCoverage',
  title: 'Flood Coverage',
  description: 'Building and contents coverage limits',
  icon: Shield,
  fields: ['coverage.dwelling', 'coverage.personalProperty', 'coverage.deductible'],
};

const floodDetailsStep: StepConfig = {
  id: 'floodDetails',
  title: 'Flood Details',
  description: 'Elevation and flood zone information',
  icon: Droplets,
  fields: ['foundationType'],
};

const underlyingStep: StepConfig = {
  id: 'underlying',
  title: 'Underlying Policies',
  description: 'Current insurance and liability exposures',
  icon: FileText,
  fields: ['hasCurrentInsurance'],
};

const umbrellaCoverageStep: StepConfig = {
  id: 'umbrellaCoverage',
  title: 'Umbrella Coverage',
  description: 'Select umbrella liability limit',
  icon: Umbrella,
  fields: ['coverage.umbrellaLimit'],
};

const businessStep: StepConfig = {
  id: 'business',
  title: 'Business Information',
  description: 'Business details and operations',
  icon: Briefcase,
  fields: ['businessName', 'businessType', 'yearsInBusiness', 'annualRevenue'],
};

const businessStepWC: StepConfig = {
  id: 'business',
  title: 'Business Information',
  description: 'Business details and payroll',
  icon: Briefcase,
  fields: ['businessName', 'businessType', 'yearsInBusiness', 'annualRevenue', 'fein'],
};

const bopCoverageStep: StepConfig = {
  id: 'coverage',
  title: 'Coverage Options',
  description: 'Liability and property coverage limits',
  icon: Shield,
  fields: [
    'coverage.liability',
    'coverage.propertyDamage',
    'coverage.medicalPayments',
    'coverage.deductible',
  ],
};

const glCoverageStep: StepConfig = {
  id: 'coverage',
  title: 'Coverage Options',
  description: 'General liability limits and deductibles',
  icon: Shield,
  fields: [
    'coverage.liability',
    'coverage.aggregate',
    'coverage.medicalPayments',
    'coverage.deductible',
  ],
};

const employeesStep: StepConfig = {
  id: 'employees',
  title: 'Employee Details',
  description: 'Workforce and payroll information',
  icon: Building,
  fields: ['employeeCount', 'annualRevenue'],
};

const recreationalVehiclesStep: StepConfig = {
  id: 'vehicles',
  title: 'Recreational Vehicles',
  description: 'Add recreational vehicles to be insured',
  icon: Bike,
  fields: ['vehicles'],
};

export const personalAutoSteps: StepConfig[] = [
  contactWithAddressStep,
  vehiclesStep,
  driversStep,
  autoCoverageStep,
  reviewStep,
];

export const homeownersSteps: StepConfig[] = [
  contactStep,
  propertyStep,
  detailsStep,
  homeCoverageStep,
  reviewStep,
];

export const rentersSteps: StepConfig[] = [
  contactStep,
  propertyStepRenters,
  rentersCoverageStep,
  reviewStep,
];

export const mobileHomeSteps: StepConfig[] = [
  contactStep,
  propertyStep,
  detailsStep,
  homeCoverageStep,
  reviewStep,
];

export const floodSteps: StepConfig[] = [
  contactStep,
  propertyStepFlood,
  floodDetailsStep,
  floodCoverageStep,
  reviewStep,
];

export const umbrellaSteps: StepConfig[] = [
  contactWithAddressStep,
  underlyingStep,
  umbrellaCoverageStep,
  reviewStep,
];

export const bopSteps: StepConfig[] = [
  contactStep,
  businessStep,
  bopCoverageStep,
  reviewStep,
];

export const generalLiabilitySteps: StepConfig[] = [
  contactStep,
  businessStep,
  glCoverageStep,
  reviewStep,
];

export const workersCompSteps: StepConfig[] = [
  contactStep,
  businessStepWC,
  employeesStep,
  reviewStep,
];

export const recreationalSteps: StepConfig[] = [
  contactWithAddressStep,
  recreationalVehiclesStep,
  autoCoverageStep,
  reviewStep,
];

const stepsMap: Record<QuoteType, StepConfig[]> = {
  personal_auto: personalAutoSteps,
  homeowners: homeownersSteps,
  renters: rentersSteps,
  mobile_home: mobileHomeSteps,
  flood: floodSteps,
  umbrella: umbrellaSteps,
  bop: bopSteps,
  general_liability: generalLiabilitySteps,
  workers_comp: workersCompSteps,
  recreational: recreationalSteps,
};

export function getStepsForType(type: QuoteType): StepConfig[] {
  return stepsMap[type];
}
