/**
 * Flood Insurance Quote Configuration
 * ====================================
 * Step definitions and validation for flood insurance quotes.
 */

import { User, Home, Droplets, Shield, ClipboardCheck } from 'lucide-react';
import { StepConfig, QuoteFormData } from './types';

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidDate = (date: string): boolean => {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
};

const isValidZip = (zip: string): boolean => {
  return /^\d{5}(-\d{4})?$/.test(zip);
};

// =============================================================================
// STEP VALIDATORS
// =============================================================================

const validateContact = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.firstName?.trim()) {
    errors.firstName = 'First name is required';
  }
  if (!data.lastName?.trim()) {
    errors.lastName = 'Last name is required';
  }
  if (!data.phone?.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(data.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }
  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  if (!data.dob) {
    errors.dob = 'Date of birth is required';
  } else if (!isValidDate(data.dob)) {
    errors.dob = 'Please enter a valid date';
  }

  return errors;
};

const validateProperty = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.propertyAddress?.trim()) {
    errors.propertyAddress = 'Property address is required';
  }
  if (!data.propertyCity?.trim()) {
    errors.propertyCity = 'City is required';
  }
  if (!data.propertyState?.trim()) {
    errors.propertyState = 'State is required';
  }
  if (!data.propertyZip?.trim()) {
    errors.propertyZip = 'ZIP code is required';
  } else if (!isValidZip(data.propertyZip)) {
    errors.propertyZip = 'Please enter a valid ZIP code';
  }
  if (!data.propertyType) {
    errors.propertyType = 'Property type is required';
  }
  if (!data.yearBuilt) {
    errors.yearBuilt = 'Year built is required';
  }

  return errors;
};

const validateDetails = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.foundationType) {
    errors.foundationType = 'Foundation type is required for flood insurance';
  }

  return errors;
};

const validateCoverage = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.coverage.dwelling) {
    errors['coverage.dwelling'] = 'Building coverage is required';
  }

  return errors;
};

const validateReview = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.effectiveDate) {
    errors.effectiveDate = 'Effective date is required';
  }

  return errors;
};

// =============================================================================
// STEP CONFIGURATION
// =============================================================================

export const floodSteps: StepConfig[] = [
  {
    id: 'contact',
    title: 'Contact Info',
    description: 'Primary insured information',
    icon: User,
    validate: validateContact,
    requiredFields: ['firstName', 'lastName', 'phone', 'dob'],
  },
  {
    id: 'property',
    title: 'Property',
    description: 'Property location and type',
    icon: Home,
    validate: validateProperty,
    requiredFields: ['propertyAddress', 'propertyCity', 'propertyState', 'propertyZip', 'propertyType', 'yearBuilt'],
  },
  {
    id: 'details',
    title: 'Flood Details',
    description: 'Foundation and elevation info',
    icon: Droplets,
    validate: validateDetails,
    requiredFields: ['foundationType'],
  },
  {
    id: 'homeCoverage',
    title: 'Coverage',
    description: 'Select your coverage options',
    icon: Shield,
    validate: validateCoverage,
    requiredFields: ['coverage.dwelling'],
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Review and submit your quote',
    icon: ClipboardCheck,
    validate: validateReview,
    requiredFields: ['effectiveDate'],
  },
];

export default floodSteps;
