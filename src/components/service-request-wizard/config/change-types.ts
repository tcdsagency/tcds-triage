/**
 * Service Request Change Type Definitions
 * ========================================
 * Available change types and their configurations.
 */

import {
  Plus,
  Minus,
  RefreshCw,
  MapPin,
  Home,
  Shield,
  XCircle,
  User,
} from 'lucide-react';
import { ChangeTypeOption, ChangeCategory } from './types';

export const CHANGE_TYPES: ChangeTypeOption[] = [
  {
    id: 'add_vehicle',
    name: 'Add Vehicle',
    icon: Plus,
    description: 'Add a new vehicle to the policy',
    category: 'vehicle',
    color: 'amber',
  },
  {
    id: 'remove_vehicle',
    name: 'Remove Vehicle',
    icon: Minus,
    description: 'Remove a vehicle from the policy',
    category: 'vehicle',
    color: 'amber',
  },
  {
    id: 'replace_vehicle',
    name: 'Replace Vehicle',
    icon: RefreshCw,
    description: 'Replace one vehicle with another',
    category: 'vehicle',
    color: 'amber',
  },
  {
    id: 'add_driver',
    name: 'Add Driver',
    icon: Plus,
    description: 'Add a new driver to the policy',
    category: 'driver',
    color: 'blue',
  },
  {
    id: 'remove_driver',
    name: 'Remove Driver',
    icon: Minus,
    description: 'Remove a driver from the policy',
    category: 'driver',
    color: 'blue',
  },
  {
    id: 'address_change',
    name: 'Address Change',
    icon: MapPin,
    description: 'Update the insured address',
    category: 'property',
    color: 'emerald',
  },
  {
    id: 'add_mortgagee',
    name: 'Add Mortgagee/Lienholder',
    icon: Home,
    description: 'Add a lienholder to the policy',
    category: 'property',
    color: 'emerald',
  },
  {
    id: 'remove_mortgagee',
    name: 'Remove Mortgagee',
    icon: Home,
    description: 'Remove a lienholder',
    category: 'property',
    color: 'emerald',
  },
  {
    id: 'coverage_change',
    name: 'Coverage Change',
    icon: Shield,
    description: 'Increase or decrease coverage limits',
    category: 'coverage',
    color: 'purple',
  },
  {
    id: 'cancel_policy',
    name: 'Cancel Policy',
    icon: XCircle,
    description: 'Cancel the policy',
    category: 'admin',
    color: 'red',
  },
];

export const CATEGORY_LABELS: Record<ChangeCategory, { label: string; icon: any }> = {
  vehicle: { label: 'Vehicle Changes', icon: RefreshCw },
  driver: { label: 'Driver Changes', icon: User },
  property: { label: 'Property & Address', icon: Home },
  coverage: { label: 'Coverage', icon: Shield },
  admin: { label: 'Administrative', icon: XCircle },
};

export const getChangeTypesByCategory = (category: ChangeCategory): ChangeTypeOption[] => {
  return CHANGE_TYPES.filter((ct) => ct.category === category);
};

export const getChangeTypeById = (id: string): ChangeTypeOption | undefined => {
  return CHANGE_TYPES.find((ct) => ct.id === id);
};

// Common options
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export const VEHICLE_REMOVAL_REASONS = [
  { value: 'sold', label: 'Sold/Traded' },
  { value: 'totaled', label: 'Totaled' },
  { value: 'gifted', label: 'Gifted/Transferred' },
  { value: 'repo', label: 'Repossessed' },
  { value: 'other', label: 'Other' },
];

export const DRIVER_REMOVAL_REASONS = [
  { value: 'moved_out', label: 'Moved Out of Household' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'excluded', label: 'Exclude from Policy' },
  { value: 'own_policy', label: 'Got Own Policy' },
  { value: 'other', label: 'Other' },
];

export const CANCELLATION_REASONS = [
  { value: 'sold_property', label: 'Sold Property/Vehicle' },
  { value: 'moving', label: 'Moving Out of State' },
  { value: 'found_cheaper', label: 'Found Cheaper Coverage' },
  { value: 'no_longer_needed', label: 'Coverage No Longer Needed' },
  { value: 'non_payment', label: 'Unable to Pay' },
  { value: 'other', label: 'Other' },
];

export const OWNERSHIP_OPTIONS = [
  { value: 'owned', label: 'Owned' },
  { value: 'financed', label: 'Financed' },
  { value: 'leased', label: 'Leased' },
];

export const VEHICLE_USE_OPTIONS = [
  { value: 'commute', label: 'Commute' },
  { value: 'pleasure', label: 'Pleasure' },
  { value: 'business', label: 'Business' },
];

export const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other Household Member' },
];

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];
