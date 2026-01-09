'use client';

/**
 * Drivers Step Component
 * ======================
 * Add and manage drivers for auto insurance quote.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Plus, Trash2, User } from 'lucide-react';
import { Driver } from '../config/types';
import { CanopyConnectSMS } from '@/components/CanopyConnectSMS';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other Household Member' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export function DriversStep() {
  const { formData, addDriver, removeDriver, updateDriver, errors } = useQuoteWizard();

  return (
    <div className="space-y-6">
      {/* Header with Canopy Connect */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-gray-600 dark:text-gray-400">
          Add all licensed drivers in your household, including those who don&apos;t drive regularly.
        </p>
        <CanopyConnectSMS
          customerPhone={formData.phone}
          customerName={formData.firstName}
          variant="outline"
          size="sm"
        />
      </div>

      {/* Driver list */}
      <div className="space-y-6">
        {formData.drivers.map((driver, index) => (
          <DriverCard
            key={driver.id}
            driver={driver}
            index={index}
            canRemove={formData.drivers.length > 1}
            onUpdate={(field, value) => updateDriver(driver.id, field, value)}
            onRemove={() => removeDriver(driver.id)}
            errors={errors}
          />
        ))}
      </div>

      {/* Add driver button */}
      <button
        onClick={addDriver}
        className={cn(
          'w-full py-3 px-4 rounded-lg border-2 border-dashed transition-colors',
          'border-gray-300 dark:border-gray-600',
          'text-gray-600 dark:text-gray-400',
          'hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400',
          'flex items-center justify-center gap-2'
        )}
      >
        <Plus className="w-5 h-5" />
        Add Another Driver
      </button>

      {/* Global driver error */}
      {errors.drivers && (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.drivers}</p>
      )}
    </div>
  );
}

// =============================================================================
// DRIVER CARD
// =============================================================================

interface DriverCardProps {
  driver: Driver;
  index: number;
  canRemove: boolean;
  onUpdate: (field: string, value: string | boolean) => void;
  onRemove: () => void;
  errors: Record<string, string>;
}

function DriverCard({
  driver,
  index,
  canRemove,
  onUpdate,
  onRemove,
  errors,
}: DriverCardProps) {
  const prefix = `drivers.${index}`;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Driver {index + 1}
          </span>
          {driver.firstName && driver.lastName && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              — {driver.firstName} {driver.lastName}
            </span>
          )}
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            title="Remove driver"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={driver.firstName}
              onChange={(e) => onUpdate('firstName', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.firstName`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors[`${prefix}.firstName`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.firstName`]}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={driver.lastName}
              onChange={(e) => onUpdate('lastName', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.lastName`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors[`${prefix}.lastName`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.lastName`]}</p>
            )}
          </div>
        </div>

        {/* DOB & Gender & Relationship */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={driver.dob}
              onChange={(e) => onUpdate('dob', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.dob`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors[`${prefix}.dob`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.dob`]}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender
            </label>
            <select
              value={driver.gender}
              onChange={(e) => onUpdate('gender', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Relationship
            </label>
            <select
              value={driver.relationship}
              onChange={(e) => onUpdate('relationship', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* License Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              License Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={driver.licenseNumber}
              onChange={(e) => onUpdate('licenseNumber', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.licenseNumber`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors[`${prefix}.licenseNumber`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.licenseNumber`]}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              License State <span className="text-red-500">*</span>
            </label>
            <select
              value={driver.licenseState}
              onChange={(e) => onUpdate('licenseState', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.licenseState`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select State</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors[`${prefix}.licenseState`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.licenseState`]}</p>
            )}
          </div>
        </div>

        {/* Driving History */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={driver.hasAccidents}
              onChange={(e) => onUpdate('hasAccidents', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Accidents in last 5 years
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={driver.hasViolations}
              onChange={(e) => onUpdate('hasViolations', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Violations in last 3 years
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default DriversStep;
