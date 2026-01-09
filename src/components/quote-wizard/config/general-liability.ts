/**
 * General Liability Quote Configuration
 * ======================================
 * Step definitions and validation for GL quotes.
 */

import { User, Briefcase, Building, Shield, ClipboardCheck } from 'lucide-react';
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

const isValidZip = (zip: string): boolean => {
  return /^\d{5}(-\d{4})?$/.test(zip);
};

// =============================================================================
// STEP VALIDATORS
// =============================================================================

const validateContact = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.firstName?.trim()) {
    errors.firstName = 'Contact first name is required';
  }
  if (!data.lastName?.trim()) {
    errors.lastName = 'Contact last name is required';
  }
  if (!data.phone?.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(data.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }
  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  return errors;
};

const validateBusiness = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.businessName?.trim()) {
    errors.businessName = 'Business name is required';
  }
  if (!data.businessType?.trim()) {
    errors.businessType = 'Business type/class code is required';
  }
  if (!data.businessDescription?.trim()) {
    errors.businessDescription = 'Business description is required';
  }
  if (!data.yearsInBusiness) {
    errors.yearsInBusiness = 'Years in business is required';
  }
  if (!data.annualRevenue) {
    errors.annualRevenue = 'Annual revenue is required';
  }

  return errors;
};

const validateLocation = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.propertyAddress?.trim()) {
    errors.propertyAddress = 'Business address is required';
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

  if (!data.coverage.liability) {
    errors['coverage.liability'] = 'Liability limit is required';
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

export const generalLiabilitySteps: StepConfig[] = [
  {
    id: 'contact',
    title: 'Contact Info',
    description: 'Business contact information',
    icon: User,
    validate: validateContact,
    requiredFields: ['firstName', 'lastName', 'phone'],
  },
  {
    id: 'business',
    title: 'Business',
    description: 'Business details and operations',
    icon: Briefcase,
    validate: validateBusiness,
    requiredFields: ['businessName', 'businessType', 'businessDescription', 'yearsInBusiness', 'annualRevenue'],
  },
  {
    id: 'location',
    title: 'Location',
    description: 'Business location',
    icon: Building,
    validate: validateLocation,
    requiredFields: ['propertyAddress', 'propertyCity', 'propertyState', 'propertyZip'],
  },
  {
    id: 'coverage',
    title: 'Coverage',
    description: 'Select your coverage options',
    icon: Shield,
    validate: validateCoverage,
    requiredFields: ['coverage.liability'],
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

export default generalLiabilitySteps;
