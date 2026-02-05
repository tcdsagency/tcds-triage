'use client';

/**
 * DriversStep
 * ===========
 * Add and manage drivers using react-hook-form useFieldArray.
 */

import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { useQuoteWizard } from '../../QuoteWizardProvider';
import { DriverCard } from '../shared';
import { CanopyConnectSMS } from '@/components/CanopyConnectSMS';
import { Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const NEW_DRIVER = {
  id: '',
  firstName: '',
  lastName: '',
  dob: '',
  gender: '',
  relationship: 'self',
  licenseNumber: '',
  licenseState: '',
  yearsLicensed: '',
  hasAccidents: false,
  hasViolations: false,
};

export function DriversStep() {
  const { watch, formState: { errors } } = useFormContext();
  useQuoteWizard();

  const { fields, append, remove } = useFieldArray({ name: 'drivers' });

  const handleAddDriver = () => {
    append({ ...NEW_DRIVER, id: crypto.randomUUID() });
  };

  // Global drivers error (e.g. "At least one driver is required")
  const driversError = errors.drivers?.message || errors.drivers?.root?.message;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-gray-600 dark:text-gray-400">
          Add all licensed drivers in your household, including those who
          don&apos;t drive regularly.
        </p>
        <CanopyConnectSMS
          customerPhone={watch('phone')}
          customerName={watch('firstName')}
          variant="outline"
          size="sm"
        />
      </div>

      {/* Driver list */}
      <div className="space-y-6">
        {fields.map((field, index) => (
          <DriverCard
            key={field.id}
            index={index}
            onRemove={() => remove(index)}
            canRemove={fields.length > 1}
          />
        ))}
      </div>

      {/* Add driver button */}
      <button
        type="button"
        onClick={handleAddDriver}
        className={cn(
          'w-full py-3 px-4 rounded-lg border-2 border-dashed transition-colors',
          'border-gray-300 dark:border-gray-600',
          'text-gray-600 dark:text-gray-400',
          'hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400',
          'flex items-center justify-center gap-2'
        )}
      >
        <Plus className="w-5 h-5" />
        Add Another Driver
      </button>

      {/* Global drivers error */}
      {driversError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{String(driversError)}</p>
        </div>
      )}
    </div>
  );
}

export default DriversStep;
