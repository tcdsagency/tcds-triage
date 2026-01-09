'use client';

/**
 * Vehicles Step Component
 * =======================
 * Add and manage vehicles for auto insurance quote.
 */

import { useState } from 'react';
import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Car, Loader2 } from 'lucide-react';
import { Vehicle } from '../config/types';
import { CanopyConnectSMS } from '@/components/CanopyConnectSMS';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR + 1 - i);

const OWNERSHIP_OPTIONS = [
  { value: 'owned', label: 'Owned' },
  { value: 'financed', label: 'Financed' },
  { value: 'leased', label: 'Leased' },
];

const USE_OPTIONS = [
  { value: 'commute', label: 'Commute to Work/School' },
  { value: 'pleasure', label: 'Pleasure Only' },
  { value: 'business', label: 'Business Use' },
  { value: 'rideshare', label: 'Rideshare (Uber/Lyft)' },
];

const GARAGE_OPTIONS = [
  { value: 'same', label: 'Same as Mailing Address' },
  { value: 'different', label: 'Different Address' },
  { value: 'street', label: 'Street Parking' },
  { value: 'carport', label: 'Carport' },
  { value: 'attached', label: 'Attached Garage' },
  { value: 'detached', label: 'Detached Garage' },
];

export function VehiclesStep() {
  const { formData, addVehicle, removeVehicle, updateVehicle, errors } = useQuoteWizard();
  const [decodingVin, setDecodingVin] = useState<string | null>(null);

  // Decode VIN using NHTSA API
  const decodeVin = async (vehicleId: string, vin: string) => {
    if (vin.length !== 17) return;

    setDecodingVin(vehicleId);
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
      );
      const data = await response.json();

      if (data.Results) {
        const getValue = (name: string) =>
          data.Results.find((r: any) => r.Variable === name)?.Value || '';

        const year = getValue('Model Year');
        const make = getValue('Make');
        const model = getValue('Model');

        if (year) updateVehicle(vehicleId, 'year', year);
        if (make) updateVehicle(vehicleId, 'make', make);
        if (model) updateVehicle(vehicleId, 'model', model);
      }
    } catch (error) {
      console.error('VIN decode failed:', error);
    } finally {
      setDecodingVin(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Canopy Connect */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-gray-600 dark:text-gray-400">
          Add all vehicles you want to insure. Enter the VIN for automatic year, make, and model lookup.
        </p>
        <CanopyConnectSMS
          customerPhone={formData.phone}
          customerName={formData.firstName}
          variant="outline"
          size="sm"
        />
      </div>

      {/* Vehicle list */}
      <div className="space-y-6">
        {formData.vehicles.map((vehicle, index) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            index={index}
            canRemove={formData.vehicles.length > 1}
            onUpdate={(field, value) => updateVehicle(vehicle.id, field, value)}
            onRemove={() => removeVehicle(vehicle.id)}
            onDecodeVin={() => decodeVin(vehicle.id, vehicle.vin)}
            isDecoding={decodingVin === vehicle.id}
            errors={errors}
          />
        ))}
      </div>

      {/* Add vehicle button */}
      <button
        onClick={addVehicle}
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

      {/* Global vehicle error */}
      {errors.vehicles && (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.vehicles}</p>
      )}
    </div>
  );
}

// =============================================================================
// VEHICLE CARD
// =============================================================================

interface VehicleCardProps {
  vehicle: Vehicle;
  index: number;
  canRemove: boolean;
  onUpdate: (field: string, value: string) => void;
  onRemove: () => void;
  onDecodeVin: () => void;
  isDecoding: boolean;
  errors: Record<string, string>;
}

function VehicleCard({
  vehicle,
  index,
  canRemove,
  onUpdate,
  onRemove,
  onDecodeVin,
  isDecoding,
  errors,
}: VehicleCardProps) {
  const prefix = `vehicles.${index}`;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Vehicle {index + 1}
          </span>
          {vehicle.year && vehicle.make && vehicle.model && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              — {vehicle.year} {vehicle.make} {vehicle.model}
            </span>
          )}
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            title="Remove vehicle"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* VIN Row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              VIN (optional)
            </label>
            <input
              type="text"
              value={vehicle.vin}
              onChange={(e) => onUpdate('vin', e.target.value.toUpperCase())}
              maxLength={17}
              placeholder="17-character VIN"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
          </div>
          <button
            onClick={onDecodeVin}
            disabled={vehicle.vin.length !== 17 || isDecoding}
            className={cn(
              'self-end px-4 py-2 rounded-lg font-medium transition-colors',
              vehicle.vin.length === 17 && !isDecoding
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
          >
            {isDecoding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Decode'}
          </button>
        </div>

        {/* Year/Make/Model */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year <span className="text-red-500">*</span>
            </label>
            <select
              value={vehicle.year}
              onChange={(e) => onUpdate('year', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.year`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {errors[`${prefix}.year`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.year`]}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Make <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={vehicle.make}
              onChange={(e) => onUpdate('make', e.target.value)}
              placeholder="Toyota"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.make`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors[`${prefix}.make`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.make`]}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={vehicle.model}
              onChange={(e) => onUpdate('model', e.target.value)}
              placeholder="Camry"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors[`${prefix}.model`]
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors[`${prefix}.model`] && (
              <p className="mt-1 text-xs text-red-600">{errors[`${prefix}.model`]}</p>
            )}
          </div>
        </div>

        {/* Usage */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ownership
            </label>
            <select
              value={vehicle.ownership}
              onChange={(e) => onUpdate('ownership', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              {OWNERSHIP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Use
            </label>
            <select
              value={vehicle.primaryUse}
              onChange={(e) => onUpdate('primaryUse', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              {USE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Annual mileage and Garage Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Annual Mileage
            </label>
            <input
              type="number"
              value={vehicle.annualMileage}
              onChange={(e) => onUpdate('annualMileage', e.target.value)}
              placeholder="12000"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Garage Location
            </label>
            <select
              value={vehicle.garageLocation}
              onChange={(e) => onUpdate('garageLocation', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              {GARAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VehiclesStep;
