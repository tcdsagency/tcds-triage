/**
 * Workers Compensation Quote Configuration
 * =========================================
 * Step definitions and validation for WC quotes.
 */

import { User, Briefcase, Users, Shield, ClipboardCheck } from 'lucide-react';
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
  if (!data.yearsInBusiness) {
    errors.yearsInBusiness = 'Years in business is required';
  }
  if (!data.fein?.trim()) {
    errors.fein = 'FEIN is required';
  }
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

const validateEmployees = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.employeeCount) {
    errors.employeeCount = 'Employee count is required';
  }
  if (!data.annualRevenue) {
    errors.annualRevenue = 'Annual payroll/revenue is required';
  }

  return errors;
};

const validateCoverage = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  // WC coverage is typically statutory, so minimal validation
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

export const workersCompSteps: StepConfig[] = [
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
    description: 'Business details and location',
    icon: Briefcase,
    validate: validateBusiness,
    requiredFields: ['businessName', 'businessType', 'yearsInBusiness', 'fein', 'propertyAddress', 'propertyCity', 'propertyState', 'propertyZip'],
  },
  {
    id: 'employees',
    title: 'Employees',
    description: 'Employee count and payroll',
    icon: Users,
    validate: validateEmployees,
    requiredFields: ['employeeCount', 'annualRevenue'],
  },
  {
    id: 'coverage',
    title: 'Coverage',
    description: 'Workers comp coverage options',
    icon: Shield,
    validate: validateCoverage,
    requiredFields: [],
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

export default workersCompSteps;
