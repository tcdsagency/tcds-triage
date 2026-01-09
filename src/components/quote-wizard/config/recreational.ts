/**
 * Recreational Vehicle Quote Configuration
 * =========================================
 * Step definitions and validation for recreational vehicle quotes
 * (boats, motorcycles, ATVs, RVs, etc.)
 */

import { User, Bike, Shield, ClipboardCheck } from 'lucide-react';
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
  if (!data.address?.trim()) {
    errors.address = 'Address is required';
  }
  if (!data.city?.trim()) {
    errors.city = 'City is required';
  }
  if (!data.state?.trim()) {
    errors.state = 'State is required';
  }
  if (!data.zip?.trim()) {
    errors.zip = 'ZIP code is required';
  }

  return errors;
};

const validateVehicles = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.vehicles || data.vehicles.length === 0) {
    errors.vehicles = 'At least one recreational vehicle is required';
    return errors;
  }

  data.vehicles.forEach((vehicle, index) => {
    if (!vehicle.year) {
      errors[`vehicles.${index}.year`] = 'Year is required';
    }
    if (!vehicle.make?.trim()) {
      errors[`vehicles.${index}.make`] = 'Make is required';
    }
    if (!vehicle.model?.trim()) {
      errors[`vehicles.${index}.model`] = 'Model is required';
    }
  });

  return errors;
};

const validateCoverage = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.coverage.bodilyInjury) {
    errors['coverage.bodilyInjury'] = 'Liability coverage is required';
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

export const recreationalSteps: StepConfig[] = [
  {
    id: 'contact',
    title: 'Contact Info',
    description: 'Owner information and address',
    icon: User,
    validate: validateContact,
    requiredFields: ['firstName', 'lastName', 'phone', 'dob', 'address', 'city', 'state', 'zip'],
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    description: 'Recreational vehicle details',
    icon: Bike,
    validate: validateVehicles,
    requiredFields: ['vehicles'],
  },
  {
    id: 'coverage',
    title: 'Coverage',
    description: 'Select your coverage options',
    icon: Shield,
    validate: validateCoverage,
    requiredFields: ['coverage.bodilyInjury'],
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

export default recreationalSteps;
