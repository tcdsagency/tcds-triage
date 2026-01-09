'use client';

/**
 * Umbrella Coverage Step Component
 * =================================
 * Select umbrella liability limits.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Shield, Umbrella, Check } from 'lucide-react';

const UMBRELLA_LIMITS = [
  { value: '1000000', label: '$1,000,000', description: 'Basic coverage for most households' },
  { value: '2000000', label: '$2,000,000', description: 'Recommended for higher net worth' },
  { value: '3000000', label: '$3,000,000', description: 'Additional protection' },
  { value: '5000000', label: '$5,000,000', description: 'Premium protection level' },
];

export function UmbrellaCoverageStep() {
  const { formData, updateNestedField, errors } = useQuoteWizard();

  const updateCoverage = (field: string, value: string) => {
    updateNestedField('coverage', field, value);
  };

  return (
    <div className="space-y-8">
      {/* Umbrella Limit Selection */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Umbrella className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Select Your Umbrella Limit
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {UMBRELLA_LIMITS.map((limit) => (
            <button
              key={limit.value}
              type="button"
              onClick={() => updateCoverage('umbrellaLimit', limit.value)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-left relative',
                formData.coverage.umbrellaLimit === limit.value
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              {formData.coverage.umbrellaLimit === limit.value && (
                <div className="absolute top-3 right-3">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              <div className={cn(
                'text-xl font-semibold mb-1',
                formData.coverage.umbrellaLimit === limit.value
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-900 dark:text-gray-100'
              )}>
                {limit.label}
              </div>
              <p className={cn(
                'text-sm',
                formData.coverage.umbrellaLimit === limit.value
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              )}>
                {limit.description}
              </p>
            </button>
          ))}
        </div>
        {errors['coverage.umbrellaLimit'] && (
          <p className="mt-2 text-sm text-red-600">{errors['coverage.umbrellaLimit']}</p>
        )}
      </section>

      {/* What's Covered */}
      <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            What Umbrella Insurance Covers
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Liability Protection</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Bodily injury to others</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Property damage you cause</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Personal liability claims</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Legal defense costs</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Coverage Extends To</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Auto accidents above policy limits</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Home liability above policy limits</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Libel and slander claims</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Landlord liability (rental properties)</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Selected Summary */}
      {formData.coverage.umbrellaLimit && (
        <section className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/30">
          <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">
            Selected Coverage
          </h3>
          <p className="text-emerald-700 dark:text-emerald-400">
            <span className="text-lg font-semibold">
              ${Number(formData.coverage.umbrellaLimit).toLocaleString()}
            </span>
            {' '}umbrella liability limit
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
            This coverage kicks in after your underlying auto and home policy limits are exhausted.
          </p>
        </section>
      )}
    </div>
  );
}

export default UmbrellaCoverageStep;
