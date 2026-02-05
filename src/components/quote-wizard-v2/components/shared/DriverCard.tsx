'use client';

import React from 'react';
import { Users, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FormInput,
  FormSelect,
  FormDateInput,
  FormCheckbox,
  FormFieldGrid,
} from '../../fields';
import {
  US_STATES,
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from '../../config/options';

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

interface DriverCardProps {
  index: number;
  onRemove: () => void;
  canRemove: boolean;
}

export function DriverCard({ index, onRemove, canRemove }: DriverCardProps) {
  const prefix = `drivers.${index}`;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            Driver {index + 1}
          </h4>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              'p-1.5 rounded-lg text-gray-400 hover:text-red-500',
              'hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
            )}
            aria-label={`Remove driver ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Name */}
      <FormFieldGrid cols={2}>
        <FormInput name={`${prefix}.firstName`} label="First Name" />
        <FormInput name={`${prefix}.lastName`} label="Last Name" />
      </FormFieldGrid>

      {/* Details */}
      <FormFieldGrid cols={3}>
        <FormDateInput name={`${prefix}.dob`} label="Date of Birth" />
        <FormSelect
          name={`${prefix}.gender`}
          label="Gender"
          options={GENDER_OPTIONS}
        />
        <FormSelect
          name={`${prefix}.relationship`}
          label="Relationship"
          options={RELATIONSHIP_OPTIONS}
        />
      </FormFieldGrid>

      {/* License */}
      <FormFieldGrid cols={3}>
        <FormInput name={`${prefix}.licenseNumber`} label="License Number" />
        <FormSelect
          name={`${prefix}.licenseState`}
          label="License State"
          options={stateOptions}
          placeholder="Select state..."
        />
        <FormInput
          name={`${prefix}.yearsLicensed`}
          label="Years Licensed"
          type="number"
        />
      </FormFieldGrid>

      {/* Accidents / Violations */}
      <FormFieldGrid cols={2}>
        <FormCheckbox
          name={`${prefix}.hasAccidents`}
          label="Has accidents in the past 5 years"
        />
        <FormCheckbox
          name={`${prefix}.hasViolations`}
          label="Has violations in the past 5 years"
        />
      </FormFieldGrid>
    </div>
  );
}

export default DriverCard;
