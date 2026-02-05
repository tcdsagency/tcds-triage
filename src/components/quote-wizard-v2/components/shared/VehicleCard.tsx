'use client';

import React, { useState } from 'react';
import { useFormContext, useWatch, Controller } from 'react-hook-form';
import { Car, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FormInput,
  FormSelect,
  FormFieldGrid,
} from '../../fields';
import {
  OWNERSHIP_OPTIONS,
  VEHICLE_USE_OPTIONS,
  GARAGE_OPTIONS,
  VEHICLE_YEARS,
} from '../../config/options';

const yearOptions = VEHICLE_YEARS.map((y) => ({
  value: String(y),
  label: String(y),
}));

interface VehicleCardProps {
  index: number;
  onRemove: () => void;
  canRemove: boolean;
}

export function VehicleCard({ index, onRemove, canRemove }: VehicleCardProps) {
  const { setValue, control } = useFormContext();
  const [decodingVin, setDecodingVin] = useState(false);
  const prefix = `vehicles.${index}`;

  const vin = useWatch({ control, name: `${prefix}.vin` }) ?? '';

  const decodeVin = async () => {
    if (!vin || vin.length < 11) return;
    setDecodingVin(true);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
      );
      const data = await res.json();
      const results = data.Results as Array<{
        Variable: string;
        Value: string | null;
      }>;

      const getValue = (variable: string) =>
        results.find((r) => r.Variable === variable)?.Value || '';

      const year = getValue('Model Year');
      const make = getValue('Make');
      const model = getValue('Model');

      if (year) setValue(`${prefix}.year`, year);
      if (make) setValue(`${prefix}.make`, make);
      if (model) setValue(`${prefix}.model`, model);
    } catch (error) {
      console.error('VIN decode failed:', error);
    } finally {
      setDecodingVin(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            Vehicle {index + 1}
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
            aria-label={`Remove vehicle ${index + 1}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* VIN */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Controller
            name={`${prefix}.vin`}
            control={control}
            render={({ field }) => (
              <div>
                <label
                  htmlFor={`${prefix}.vin`}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  VIN
                </label>
                <input
                  {...field}
                  id={`${prefix}.vin`}
                  type="text"
                  placeholder="Enter VIN to auto-fill"
                  className={cn(
                    'w-full px-3 py-2 rounded-md border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 shadow-sm',
                    'border-gray-300 dark:border-gray-600 uppercase'
                  )}
                  onChange={(e) =>
                    field.onChange(e.target.value.toUpperCase())
                  }
                />
              </div>
            )}
          />
        </div>
        <button
          type="button"
          onClick={decodeVin}
          disabled={decodingVin || vin.length < 11}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed',
            'dark:disabled:bg-gray-700 dark:disabled:text-gray-500'
          )}
        >
          {decodingVin ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Decode'
          )}
        </button>
      </div>

      {/* Year / Make / Model */}
      <FormFieldGrid cols={3}>
        <FormSelect
          name={`${prefix}.year`}
          label="Year"
          options={yearOptions}
          placeholder="Select year..."
        />
        <FormInput name={`${prefix}.make`} label="Make" />
        <FormInput name={`${prefix}.model`} label="Model" />
      </FormFieldGrid>

      {/* Usage */}
      <FormFieldGrid cols={2}>
        <FormSelect
          name={`${prefix}.ownership`}
          label="Ownership"
          options={OWNERSHIP_OPTIONS}
        />
        <FormSelect
          name={`${prefix}.primaryUse`}
          label="Primary Use"
          options={VEHICLE_USE_OPTIONS}
        />
      </FormFieldGrid>

      {/* Details */}
      <FormFieldGrid cols={2}>
        <FormInput
          name={`${prefix}.annualMileage`}
          label="Annual Mileage"
          type="number"
        />
        <FormSelect
          name={`${prefix}.garageLocation`}
          label="Garage Location"
          options={GARAGE_OPTIONS}
        />
      </FormFieldGrid>
    </div>
  );
}

export default VehicleCard;
