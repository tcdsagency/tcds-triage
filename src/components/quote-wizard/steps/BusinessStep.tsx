'use client';

/**
 * Business Step Component
 * =======================
 * Collects business information for commercial quotes (BOP, GL, WC).
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Briefcase, Building, DollarSign } from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'contractor', label: 'Contractor/Construction' },
  { value: 'retail', label: 'Retail Store' },
  { value: 'restaurant', label: 'Restaurant/Food Service' },
  { value: 'office', label: 'Office/Professional' },
  { value: 'medical', label: 'Medical/Healthcare' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'wholesale', label: 'Wholesale/Distribution' },
  { value: 'service', label: 'Service Business' },
  { value: 'technology', label: 'Technology/IT' },
  { value: 'other', label: 'Other' },
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function BusinessStep() {
  const { formData, updateField, errors } = useQuoteWizard();

  return (
    <div className="space-y-8">
      {/* Business Info */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Business Information
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.businessName}
              onChange={(e) => updateField('businessName', e.target.value)}
              placeholder="Company Name, LLC"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors.businessName
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors.businessName && (
              <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => updateField('businessType', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  errors.businessType
                    ? 'border-red-300 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              >
                <option value="">Select business type</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {errors.businessType && (
                <p className="mt-1 text-sm text-red-600">{errors.businessType}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Years in Business <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.yearsInBusiness}
                onChange={(e) => updateField('yearsInBusiness', e.target.value)}
                placeholder="5"
                min="0"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  errors.yearsInBusiness
                    ? 'border-red-300 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
              {errors.yearsInBusiness && (
                <p className="mt-1 text-sm text-red-600">{errors.yearsInBusiness}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Business Description
            </label>
            <textarea
              value={formData.businessDescription}
              onChange={(e) => updateField('businessDescription', e.target.value)}
              rows={3}
              placeholder="Describe the primary operations of the business..."
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors.businessDescription
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors.businessDescription && (
              <p className="mt-1 text-sm text-red-600">{errors.businessDescription}</p>
            )}
          </div>
        </div>
      </section>

      {/* Business Location */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Building className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Business Location
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Business Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.propertyAddress}
              onChange={(e) => updateField('propertyAddress', e.target.value)}
              placeholder="123 Business Ave, Suite 100"
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
              {errors.propertyCity && (
                <p className="mt-1 text-sm text-red-600">{errors.propertyCity}</p>
              )}
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
              {errors.propertyState && (
                <p className="mt-1 text-sm text-red-600">{errors.propertyState}</p>
              )}
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
              {errors.propertyZip && (
                <p className="mt-1 text-sm text-red-600">{errors.propertyZip}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Financials */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Financial Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Annual Revenue <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="text"
                value={formData.annualRevenue}
                onChange={(e) => updateField('annualRevenue', e.target.value)}
                placeholder="500,000"
                className={cn(
                  'w-full pl-7 pr-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  errors.annualRevenue
                    ? 'border-red-300 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
            </div>
            {errors.annualRevenue && (
              <p className="mt-1 text-sm text-red-600">{errors.annualRevenue}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Employee Count
            </label>
            <input
              type="number"
              value={formData.employeeCount}
              onChange={(e) => updateField('employeeCount', e.target.value)}
              placeholder="10"
              min="0"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors.employeeCount
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors.employeeCount && (
              <p className="mt-1 text-sm text-red-600">{errors.employeeCount}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              FEIN (Tax ID)
            </label>
            <input
              type="text"
              value={formData.fein}
              onChange={(e) => updateField('fein', e.target.value)}
              placeholder="XX-XXXXXXX"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                errors.fein
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            {errors.fein && (
              <p className="mt-1 text-sm text-red-600">{errors.fein}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default BusinessStep;
