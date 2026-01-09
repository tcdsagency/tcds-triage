/**
 * Renters Quote Configuration
 * ===========================
 * Step definitions and validation for renters quotes.
 */

import { User, Home, Shield, ClipboardCheck } from 'lucide-react';
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
    errors.propertyAddress = 'Rental address is required';
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

  return errors;
};

const validateCoverage = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.coverage.personalProperty) {
    errors['coverage.personalProperty'] = 'Personal property coverage is required';
  }
  if (!data.coverage.liability) {
    errors['coverage.liability'] = 'Liability coverage is required';
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

export const rentersSteps: StepConfig[] = [
  {
    id: 'contact',
    title: 'Contact Info',
    description: 'Your personal information',
    icon: User,
    validate: validateContact,
    requiredFields: ['firstName', 'lastName', 'phone', 'dob'],
  },
  {
    id: 'property',
    title: 'Rental',
    description: 'Rental property location',
    icon: Home,
    validate: validateProperty,
    requiredFields: ['propertyAddress', 'propertyCity', 'propertyState', 'propertyZip'],
  },
  {
    id: 'homeCoverage',
    title: 'Coverage',
    description: 'Select your coverage options',
    icon: Shield,
    validate: validateCoverage,
    requiredFields: ['coverage.personalProperty', 'coverage.liability'],
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

export default rentersSteps;
