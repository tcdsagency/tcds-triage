'use client';

/**
 * PropertyStep
 * ============
 * Property address, type, and basic details for homeowners / property quotes.
 */

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuoteWizard } from '../../QuoteWizardProvider';
import { AddressFields } from '../shared';
import {
  FormInput,
  FormSelect,
  FormCheckbox,
  FormSection,
  FormFieldGrid,
} from '../../fields';
import {
  YEARS_AT_ADDRESS_OPTIONS,
  PROPERTY_TYPES,
  OCCUPANCY_TYPES,
} from '../../config/options';
import { cn } from '@/lib/utils';
import {
  Home,
  MapPin,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

const STORIES_OPTIONS = [
  { value: '1', label: '1' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2' },
  { value: '2.5', label: '2.5' },
  { value: '3+', label: '3+' },
];

export function PropertyStep() {
  const { watch, setValue, formState: { errors } } = useFormContext();
  useQuoteWizard();

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  const propertySameAsMailing = watch('propertySameAsMailing');
  const yearsAtPropertyAddress = watch('yearsAtPropertyAddress');
  const propertyType = watch('propertyType');
  const occupancyType = watch('occupancyType');

  // Mailing address fields
  const address = watch('address');
  const city = watch('city');
  const state = watch('state');
  const zip = watch('zip');

  // ---------------------------------------------------------------------------
  // Sync property address from mailing address when checkbox is checked
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (propertySameAsMailing) {
      setValue('propertyAddress', address || '');
      setValue('propertyCity', city || '');
      setValue('propertyState', state || '');
      setValue('propertyZip', zip || '');
    }
  }, [propertySameAsMailing, address, city, state, zip, setValue]);

  // ---------------------------------------------------------------------------
  // RPR property auto-fill lookup
  // ---------------------------------------------------------------------------
  const handlePropertyLookup = async () => {
    const propertyAddress = watch('propertyAddress');
    const propertyCity = watch('propertyCity');
    const propertyState = watch('propertyState');
    const propertyZip = watch('propertyZip');

    const fullAddress = [propertyAddress, propertyCity, propertyState, propertyZip]
      .filter(Boolean)
      .join(', ');

    if (!fullAddress.trim()) return;

    setIsLookingUp(true);
    setLookupError(null);
    setLookupSuccess(false);

    try {
      const response = await fetch('/api/properties/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: fullAddress }),
      });

      if (!response.ok) {
        throw new Error('Property lookup failed');
      }

      const data = await response.json();

      // Populate property detail fields from lookup response
      if (data.yearBuilt) setValue('yearBuilt', data.yearBuilt);
      if (data.squareFootage) setValue('squareFootage', data.squareFootage);
      if (data.stories) setValue('stories', String(data.stories));
      if (data.constructionType) setValue('constructionType', data.constructionType);
      if (data.foundationType) setValue('foundationType', data.foundationType);
      if (data.roofMaterial) setValue('roofMaterial', data.roofMaterial);
      if (data.heatingType) setValue('heatingType', data.heatingType);
      if (data.garageType) setValue('garageType', data.garageType);
      if (data.hasPool !== undefined) setValue('hasPool', data.hasPool);
      if (data.poolType) setValue('poolType', data.poolType);

      // Store full RPR data for reference
      setValue('rprData', data);

      setLookupSuccess(true);
      setTimeout(() => setLookupSuccess(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lookup failed';
      setLookupError(message);
      setTimeout(() => setLookupError(null), 5000);
    } finally {
      setIsLookingUp(false);
    }
  };

  // Show prior address when years at property is less than 1 or 1
  const showPriorAddress =
    yearsAtPropertyAddress === 'less_than_1' || yearsAtPropertyAddress === '1';

  return (
    <div className="space-y-8">
      {/* ================================================================= */}
      {/* PROPERTY ADDRESS                                                   */}
      {/* ================================================================= */}
      <FormSection title="Property Address" icon={MapPin}>
        {/* Same as mailing checkbox */}
        <FormCheckbox
          name="propertySameAsMailing"
          label="Same as mailing address"
          description="Use the mailing address entered in the contact step"
        />

        {/* Address fields */}
        <AddressFields
          prefix="property"
          disabled={propertySameAsMailing}
        />

        {/* RPR Lookup button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePropertyLookup}
            disabled={isLookingUp}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-emerald-600 text-white hover:bg-emerald-700',
              'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed',
              'dark:disabled:bg-gray-700 dark:disabled:text-gray-500'
            )}
          >
            {isLookingUp ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Looking up property...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Auto-fill from Property Records
              </>
            )}
          </button>

          {lookupSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Property data loaded
            </span>
          )}

          {lookupError && (
            <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              {lookupError}
            </span>
          )}
        </div>
      </FormSection>

      {/* ================================================================= */}
      {/* YEARS AT ADDRESS                                                   */}
      {/* ================================================================= */}
      <FormSection title="Time at Property" icon={Clock}>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            How long have you lived at this address?
          </label>
          <div className="flex flex-wrap gap-2">
            {YEARS_AT_ADDRESS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue('yearsAtPropertyAddress', option.value)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                  yearsAtPropertyAddress === option.value
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {errors.yearsAtPropertyAddress && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {String((errors.yearsAtPropertyAddress as any)?.message || '')}
            </p>
          )}
        </div>

        {/* Prior address */}
        {showPriorAddress && (
          <div className="mt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Prior Address
            </h4>
            <AddressFields prefix="prior" />
          </div>
        )}
      </FormSection>

      {/* ================================================================= */}
      {/* PROPERTY TYPE                                                      */}
      {/* ================================================================= */}
      <FormSection title="Property Type" icon={Home}>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What type of property is this?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PROPERTY_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue('propertyType', option.value)}
                className={cn(
                  'flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-colors text-center',
                  propertyType === option.value
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-emerald-600'
                )}
              >
                <Home className={cn(
                  'w-6 h-6 mb-2',
                  propertyType === option.value
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-gray-500'
                )} />
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
          {errors.propertyType && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {String((errors.propertyType as any)?.message || '')}
            </p>
          )}
        </div>

        {/* Occupancy type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            How is this property used?
          </label>
          <div className="flex flex-wrap gap-3">
            {OCCUPANCY_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue('occupancyType', option.value)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                  occupancyType === option.value
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {errors.occupancyType && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {String((errors.occupancyType as any)?.message || '')}
            </p>
          )}
        </div>
      </FormSection>

      {/* ================================================================= */}
      {/* BASIC DETAILS                                                      */}
      {/* ================================================================= */}
      <FormSection title="Basic Details">
        <FormFieldGrid cols={3}>
          <FormInput
            name="yearBuilt"
            label="Year Built"
            type="number"
            required
          />
          <FormInput
            name="squareFootage"
            label="Square Footage"
            type="number"
            required
          />
          <FormSelect
            name="stories"
            label="Stories"
            options={STORIES_OPTIONS}
            required
            placeholder="Select..."
          />
        </FormFieldGrid>
      </FormSection>
    </div>
  );
}

export default PropertyStep;
