'use client';

/**
 * Property Step Component
 * =======================
 * Collects property location and basic details for home quotes.
 * - Same as mailing address checkbox
 * - Years at address with prior address if < 2 years
 * - RPR auto-fill for property data
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Home, Building, MapPin, Search, Loader2, CheckCircle } from 'lucide-react';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family', icon: Home },
  { value: 'condo', label: 'Condo/Townhome', icon: Building },
  { value: 'multi_family', label: 'Multi-Family (2-4)', icon: Building },
  { value: 'mobile_home', label: 'Mobile/Manufactured', icon: Home },
];

const OCCUPANCY_TYPES = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'secondary', label: 'Secondary/Vacation' },
  { value: 'rental', label: 'Rental/Investment' },
];

const YEARS_AT_ADDRESS_OPTIONS = [
  { value: 'less_than_1', label: 'Less than 1 year' },
  { value: '1', label: '1 year' },
  { value: '2', label: '2 years' },
  { value: '3_to_5', label: '3-5 years' },
  { value: '5_to_10', label: '5-10 years' },
  { value: 'more_than_10', label: 'More than 10 years' },
];

export function PropertyStep() {
  const { formData, updateField, errors } = useQuoteWizard();
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  // Sync property address with mailing address when checkbox is checked
  useEffect(() => {
    if (formData.propertySameAsMailing) {
      updateField('propertyAddress', formData.address);
      updateField('propertyCity', formData.city);
      updateField('propertyState', formData.state);
      updateField('propertyZip', formData.zip);
    }
  }, [
    formData.propertySameAsMailing,
    formData.address,
    formData.city,
    formData.state,
    formData.zip,
    updateField,
  ]);

  // Check if prior address is required (less than 2 years at current address)
  const needsPriorAddress = ['less_than_1', '1'].includes(formData.yearsAtPropertyAddress);

  // RPR Lookup function
  const lookupProperty = useCallback(async () => {
    const fullAddress = `${formData.propertyAddress}, ${formData.propertyCity}, ${formData.propertyState} ${formData.propertyZip}`;

    if (!formData.propertyAddress || !formData.propertyCity || !formData.propertyState) {
      setLookupError('Please enter a complete address first');
      return;
    }

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

      if (data.property) {
        // Auto-fill property details from RPR
        const prop = data.property;

        if (prop.yearBuilt) updateField('yearBuilt', String(prop.yearBuilt));
        if (prop.sqft) updateField('squareFootage', String(prop.sqft));
        if (prop.stories) updateField('stories', String(prop.stories));
        if (prop.constructionType) updateField('constructionType', prop.constructionType.toLowerCase());
        if (prop.foundation || prop.foundationType) updateField('foundationType', (prop.foundation || prop.foundationType).toLowerCase());
        if (prop.roofMaterial) updateField('roofMaterial', prop.roofMaterial.toLowerCase().replace(/\s+/g, '_'));
        if (prop.heatingType) updateField('heatingType', prop.heatingType.toLowerCase());
        if (prop.garageType) updateField('garageType', prop.garageType?.toLowerCase() || '');
        if (prop.hasPool !== undefined) updateField('hasPool', prop.hasPool);
        if (prop.poolType) updateField('poolType', prop.poolType);

        // Store full RPR data for reference
        updateField('rprData', prop);

        setLookupSuccess(true);
        setTimeout(() => setLookupSuccess(false), 3000);
      } else {
        setLookupError('No property data found for this address');
      }
    } catch (error) {
      console.error('Property lookup error:', error);
      setLookupError('Failed to lookup property. Please enter details manually.');
    } finally {
      setIsLookingUp(false);
    }
  }, [formData.propertyAddress, formData.propertyCity, formData.propertyState, formData.propertyZip, updateField]);

  return (
    <div className="space-y-8">
      {/* Same as Mailing Address Checkbox */}
      <section>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.propertySameAsMailing}
            onChange={(e) => updateField('propertySameAsMailing', e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Property address is the same as mailing address
          </span>
        </label>
      </section>

      {/* Property Address */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Property Location
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.propertyAddress}
              onChange={(e) => updateField('propertyAddress', e.target.value)}
              disabled={formData.propertySameAsMailing}
              placeholder="123 Main St"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                formData.propertySameAsMailing && 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed',
                errors.propertyAddress
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors.propertyAddress && (
              <p className="mt-1 text-sm text-red-600">{errors.propertyAddress}</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.propertyCity}
                onChange={(e) => updateField('propertyCity', e.target.value)}
                disabled={formData.propertySameAsMailing}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  formData.propertySameAsMailing && 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed',
                  errors.propertyCity
                    ? 'border-red-300 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.propertyState}
                onChange={(e) => updateField('propertyState', e.target.value)}
                disabled={formData.propertySameAsMailing}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  formData.propertySameAsMailing && 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed',
                  errors.propertyState
                    ? 'border-red-300 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              >
                <option value="">State</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ZIP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.propertyZip}
                onChange={(e) => updateField('propertyZip', e.target.value)}
                disabled={formData.propertySameAsMailing}
                placeholder="12345"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  formData.propertySameAsMailing && 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed',
                  errors.propertyZip
                    ? 'border-red-300 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
            </div>
          </div>

          {/* RPR Lookup Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={lookupProperty}
              disabled={isLookingUp || !formData.propertyAddress}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                'bg-blue-600 hover:bg-blue-700 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLookingUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Auto-Fill Property Data
                </>
              )}
            </button>
            {lookupSuccess && (
              <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                Property data filled!
              </span>
            )}
            {lookupError && (
              <span className="text-sm text-red-600">{lookupError}</span>
            )}
          </div>
        </div>
      </section>

      {/* Years at Property Address */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          How long have you lived at this property?
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {YEARS_AT_ADDRESS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField('yearsAtPropertyAddress', option.value)}
              className={cn(
                'p-3 rounded-xl border-2 transition-all text-center text-sm',
                formData.yearsAtPropertyAddress === option.value
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Prior Address (if less than 2 years) */}
      {needsPriorAddress && (
        <section className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Prior Address
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            Since you&apos;ve lived at the property less than 2 years, please provide your prior address.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={formData.priorAddress}
                onChange={(e) => updateField('priorAddress', e.target.value)}
                placeholder="Previous street address"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.priorCity}
                  onChange={(e) => updateField('priorCity', e.target.value)}
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
                  State
                </label>
                <select
                  value={formData.priorState}
                  onChange={(e) => updateField('priorState', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                  )}
                >
                  <option value="">State</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ZIP
                </label>
                <input
                  type="text"
                  value={formData.priorZip}
                  onChange={(e) => updateField('priorZip', e.target.value)}
                  placeholder="12345"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                  )}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Property Type */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Property Type
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PROPERTY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateField('propertyType', type.value)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-center',
                formData.propertyType === type.value
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <type.icon className={cn(
                'w-6 h-6 mx-auto mb-2',
                formData.propertyType === type.value
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-400'
              )} />
              <span className={cn(
                'text-sm font-medium',
                formData.propertyType === type.value
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-700 dark:text-gray-300'
              )}>
                {type.label}
              </span>
            </button>
          ))}
        </div>
        {errors.propertyType && (
          <p className="mt-2 text-sm text-red-600">{errors.propertyType}</p>
        )}
      </section>

      {/* Occupancy */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Occupancy
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {OCCUPANCY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateField('occupancy', type.value)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-center',
                formData.occupancy === type.value
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              )}
            >
              <span className={cn(
                'text-sm font-medium',
                formData.occupancy === type.value
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-700 dark:text-gray-300'
              )}>
                {type.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Basic Details */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Property Details
          </h3>
          {formData.rprData && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
              Auto-filled from RPR
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Year Built <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.yearBuilt}
              onChange={(e) => updateField('yearBuilt', e.target.value)}
              placeholder="1990"
              min="1800"
              max={new Date().getFullYear()}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors.yearBuilt
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Square Footage
            </label>
            <input
              type="number"
              value={formData.squareFootage}
              onChange={(e) => updateField('squareFootage', e.target.value)}
              placeholder="2000"
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
              Stories
            </label>
            <select
              value={formData.stories}
              onChange={(e) => updateField('stories', e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="">Select</option>
              <option value="1">1 Story</option>
              <option value="1.5">1.5 Stories</option>
              <option value="2">2 Stories</option>
              <option value="2.5">2.5 Stories</option>
              <option value="3">3+ Stories</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PropertyStep;
