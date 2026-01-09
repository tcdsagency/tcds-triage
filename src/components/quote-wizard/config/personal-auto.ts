/**
 * Personal Auto Quote Configuration
 * ==================================
 * Step definitions and validation for personal auto quotes.
 */

import { User, Car, Users, Shield, ClipboardCheck } from 'lucide-react';
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
    errors.vehicles = 'At least one vehicle is required';
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

const validateDrivers = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.drivers || data.drivers.length === 0) {
    errors.drivers = 'At least one driver is required';
    return errors;
  }

  data.drivers.forEach((driver, index) => {
    if (!driver.firstName?.trim()) {
      errors[`drivers.${index}.firstName`] = 'First name is required';
    }
    if (!driver.lastName?.trim()) {
      errors[`drivers.${index}.lastName`] = 'Last name is required';
    }
    if (!driver.dob) {
      errors[`drivers.${index}.dob`] = 'Date of birth is required';
    }
    if (!driver.licenseNumber?.trim()) {
      errors[`drivers.${index}.licenseNumber`] = 'License number is required';
    }
    if (!driver.licenseState?.trim()) {
      errors[`drivers.${index}.licenseState`] = 'License state is required';
    }
  });

  return errors;
};

const validateCoverage = (data: QuoteFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.coverage.bodilyInjury) {
    errors['coverage.bodilyInjury'] = 'Bodily injury limit is required';
  }
  if (!data.coverage.propertyDamage) {
    errors['coverage.propertyDamage'] = 'Property damage limit is required';
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

export const personalAutoSteps: StepConfig[] = [
  {
    id: 'contact',
    title: 'Contact Info',
    description: 'Primary insured information and address',
    icon: User,
    validate: validateContact,
    requiredFields: ['firstName', 'lastName', 'phone', 'dob', 'address', 'city', 'state', 'zip'],
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    description: 'Add all vehicles to be insured',
    icon: Car,
    validate: validateVehicles,
    requiredFields: ['vehicles'],
  },
  {
    id: 'drivers',
    title: 'Drivers',
    description: 'Add all household drivers',
    icon: Users,
    validate: validateDrivers,
    requiredFields: ['drivers'],
  },
  {
    id: 'coverage',
    title: 'Coverage',
    description: 'Select your coverage options',
    icon: Shield,
    validate: validateCoverage,
    requiredFields: ['coverage.bodilyInjury', 'coverage.propertyDamage'],
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

export default personalAutoSteps;
