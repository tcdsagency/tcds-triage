'use client';

/**
 * VehiclesStep
 * ============
 * Add and manage vehicles using react-hook-form useFieldArray.
 */

import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { useQuoteWizard } from '../../QuoteWizardProvider';
import { VehicleCard } from '../shared';
import { CanopyConnectSMS } from '@/components/CanopyConnectSMS';
import { Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const NEW_VEHICLE = {
  id: '',
  vin: '',
  year: '',
  make: '',
  model: '',
  ownership: 'owned',
  primaryUse: 'commute',
  annualMileage: '',
  garageLocation: 'same',
  compDeductible: '500',
  collDeductible: '500',
};

export function VehiclesStep() {
  const { watch, formState: { errors } } = useFormContext();
  useQuoteWizard();

  const { fields, append, remove } = useFieldArray({ name: 'vehicles' });

  const handleAddVehicle = () => {
    append({ ...NEW_VEHICLE, id: crypto.randomUUID() });
  };

  // Global vehicles error (e.g. "At least one vehicle is required")
  const vehiclesError = errors.vehicles?.message || errors.vehicles?.root?.message;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-gray-600 dark:text-gray-400">
          Add all vehicles you want to insure. Enter the VIN for automatic year,
          make, and model lookup.
        </p>
        <CanopyConnectSMS
          customerPhone={watch('phone')}
          customerName={watch('firstName')}
          variant="outline"
          size="sm"
        />
      </div>

      {/* Vehicle list */}
      <div className="space-y-6">
        {fields.map((field, index) => (
          <VehicleCard
            key={field.id}
            index={index}
            onRemove={() => remove(index)}
            canRemove={fields.length > 1}
          />
        ))}
      </div>

      {/* Add vehicle button */}
      <button
        type="button"
        onClick={handleAddVehicle}
        className={cn(
          'w-full py-3 px-4 rounded-lg border-2 border-dashed transition-colors',
          'border-gray-300 dark:border-gray-600',
          'text-gray-600 dark:text-gray-400',
          'hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400',
          'flex items-center justify-center gap-2'
        )}
      >
        <Plus className="w-5 h-5" />
        Add Another Vehicle
      </button>

      {/* Global vehicles error */}
      {vehiclesError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{String(vehiclesError)}</p>
        </div>
      )}
    </div>
  );
}

export default VehiclesStep;
