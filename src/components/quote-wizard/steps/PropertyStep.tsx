'use client';

/**
 * Property Step Component
 * =======================
 * Collects property location and basic details for home quotes.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Home, Building, MapPin } from 'lucide-react';

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

export function PropertyStep() {
  const { formData, updateField, errors } = useQuoteWizard();

  return (
    <div className="space-y-8">
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
              placeholder="123 Main St"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
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
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
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
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
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
                placeholder="12345"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  errors.propertyZip
                    ? 'border-red-300 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
            </div>
          </div>
        </div>
      </section>

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
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Property Details
        </h3>
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
