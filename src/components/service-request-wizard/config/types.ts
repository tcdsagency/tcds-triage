/**
 * Service Request Wizard Type Definitions
 * ========================================
 * Core types for the service request wizard.
 */

import { LucideIcon } from 'lucide-react';

// =============================================================================
// CHANGE TYPES
// =============================================================================

export type ChangeType =
  | 'add_vehicle'
  | 'remove_vehicle'
  | 'replace_vehicle'
  | 'add_driver'
  | 'remove_driver'
  | 'address_change'
  | 'add_mortgagee'
  | 'remove_mortgagee'
  | 'coverage_change'
  | 'cancel_policy';

export type ChangeCategory = 'vehicle' | 'driver' | 'property' | 'coverage' | 'admin';

export type PolicyTypeFilter = 'auto' | 'home' | 'all';

export interface ChangeTypeOption {
  id: ChangeType;
  name: string;
  icon: LucideIcon;
  description: string;
  category: ChangeCategory;
  color: string;
  policyTypes: PolicyTypeFilter[]; // Which policy types this change applies to
}

// =============================================================================
// POLICY DATA
// =============================================================================

export interface PolicySearchResult {
  id: string;
  policyNumber: string;
  type: string;
  carrier: string;
  insuredName: string;
  effectiveDate: string;
  expirationDate: string;
}

export interface PolicyVehicle {
  id: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  use: string;
  annualMiles: string;
  displayName: string;
}

export interface PolicyDriver {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  licenseNumber: string;
  licenseState: string;
  relationship: string;
  displayName: string;
}

export interface PolicyDetails {
  vehicles: PolicyVehicle[];
  drivers: PolicyDriver[];
}

// =============================================================================
// FORM DATA STRUCTURES
// =============================================================================

export interface VehicleData {
  vin: string;
  year: string;
  make: string;
  model: string;
  ownership: string;
  primaryUse: string;
  annualMileage: string;
  lienholderName: string;
  lienholderAddress: string;
}

export interface DriverData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  licenseNumber: string;
  licenseState: string;
  relationship: string;
  yearsLicensed: string;
  hasViolations: boolean;
  violationDetails: string;
  primaryVehicle: string;
}

export interface AddressData {
  newAddress: string;
  newCity: string;
  newState: string;
  newZip: string;
  moveDate: string;
  garagingLocation: string;
  updateAllPolicies: boolean;
}

export interface MortgageeData {
  action: 'add' | 'remove' | 'update';
  lienholderName: string;
  lienholderAddress: string;
  loanNumber: string;
  vehicleOrProperty: string;
}

export interface CoverageChangeData {
  coverageType: string;
  currentLimit: string;
  newLimit: string;
  reason: string;
}

export interface CancelPolicyData {
  reason: string;
  reasonDetails: string;
  hasNewCoverage: boolean;
  newCarrier: string;
  refundMethod: string;
}

export interface ServiceRequestFormData {
  // Selected policy
  policy: PolicySearchResult | null;

  // Policy details (fetched after policy selection)
  policyDetails: PolicyDetails | null;

  // Change type
  changeType: ChangeType | null;

  // Effective date (shared across all change types)
  effectiveDate: string;

  // Vehicle changes
  vehicle: VehicleData;
  vehicleToRemove: string;
  selectedVehicleId: string; // ID from policy vehicles dropdown
  removalReason: string;
  newOwnerInfo: string;

  // Replacement logic (for add/remove vehicle)
  isReplacing: boolean;
  replacingVehicleId: string; // Which vehicle is being replaced
  stillInPossession: boolean;
  outOfPossessionDate: string;

  // Driver changes
  driver: DriverData;
  driverToRemove: string;
  selectedDriverId: string; // ID from policy drivers dropdown
  driverRemovalReason: string;

  // Address change
  address: AddressData;

  // Mortgagee
  mortgagee: MortgageeData;

  // Coverage change
  coverageChange: CoverageChangeData;

  // Cancellation
  cancellation: CancelPolicyData;

  // Notes
  notes: string;
}

// =============================================================================
// WIZARD CONTEXT
// =============================================================================

export interface ServiceRequestWizardContextType {
  // Current step
  currentStep: number;
  totalSteps: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;

  // Form data
  formData: ServiceRequestFormData;
  updateField: <K extends keyof ServiceRequestFormData>(
    field: K,
    value: ServiceRequestFormData[K]
  ) => void;
  updateNestedField: <
    K extends keyof ServiceRequestFormData,
    F extends keyof NonNullable<ServiceRequestFormData[K]>
  >(
    section: K,
    field: F,
    value: any
  ) => void;

  // Policy selection
  selectPolicy: (policy: PolicySearchResult) => void;
  selectChangeType: (type: ChangeType) => void;

  // Policy details (vehicles, drivers)
  loadingPolicyDetails: boolean;

  // Validation
  errors: Record<string, string>;
  validateCurrentStep: () => boolean;

  // Submit
  submitRequest: () => Promise<void>;
  isSubmitting: boolean;
}

// =============================================================================
// INITIAL STATES
// =============================================================================

export const initialVehicleData: VehicleData = {
  vin: '',
  year: '',
  make: '',
  model: '',
  ownership: 'owned',
  primaryUse: 'commute',
  annualMileage: '12000',
  lienholderName: '',
  lienholderAddress: '',
};

export const initialDriverData: DriverData = {
  firstName: '',
  lastName: '',
  dob: '',
  gender: '',
  licenseNumber: '',
  licenseState: '',
  relationship: '',
  yearsLicensed: '',
  hasViolations: false,
  violationDetails: '',
  primaryVehicle: '',
};

export const initialAddressData: AddressData = {
  newAddress: '',
  newCity: '',
  newState: '',
  newZip: '',
  moveDate: new Date().toISOString().split('T')[0],
  garagingLocation: 'same',
  updateAllPolicies: true,
};

export const initialMortgageeData: MortgageeData = {
  action: 'add',
  lienholderName: '',
  lienholderAddress: '',
  loanNumber: '',
  vehicleOrProperty: '',
};

export const initialCoverageChangeData: CoverageChangeData = {
  coverageType: '',
  currentLimit: '',
  newLimit: '',
  reason: '',
};

export const initialCancelPolicyData: CancelPolicyData = {
  reason: '',
  reasonDetails: '',
  hasNewCoverage: false,
  newCarrier: '',
  refundMethod: 'check',
};

export const initialFormData: ServiceRequestFormData = {
  policy: null,
  policyDetails: null,
  changeType: null,
  effectiveDate: new Date().toISOString().split('T')[0],
  vehicle: initialVehicleData,
  vehicleToRemove: '',
  selectedVehicleId: '',
  removalReason: 'sold',
  newOwnerInfo: '',
  isReplacing: false,
  replacingVehicleId: '',
  stillInPossession: true,
  outOfPossessionDate: '',
  driver: initialDriverData,
  driverToRemove: '',
  selectedDriverId: '',
  driverRemovalReason: 'moved_out',
  address: initialAddressData,
  mortgagee: initialMortgageeData,
  coverageChange: initialCoverageChangeData,
  cancellation: initialCancelPolicyData,
  notes: '',
};
