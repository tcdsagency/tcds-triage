'use client';

/**
 * Underlying Policies Step Component
 * ===================================
 * Collects information about underlying auto/home policies for umbrella quotes.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { FileText, Car, Home, AlertCircle } from 'lucide-react';

export function UnderlyingPoliciesStep() {
  const { formData, updateField, errors } = useQuoteWizard();

  return (
    <div className="space-y-8">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-300">
              Umbrella policies require underlying coverage
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              Personal umbrella policies typically require minimum underlying limits on auto and home policies.
              Most carriers require at least 250/500 auto liability and 300K home liability.
            </p>
          </div>
        </div>
      </div>

      {/* Current Insurance */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Current Coverage
          </h3>
        </div>

        <label className="flex items-center gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={formData.hasCurrentInsurance}
            onChange={(e) => updateField('hasCurrentInsurance', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I have current auto and/or home insurance policies
          </span>
        </label>
        {errors.hasCurrentInsurance && (
          <p className="mt-1 text-sm text-red-600">{errors.hasCurrentInsurance}</p>
        )}

        {formData.hasCurrentInsurance && (
          <div className="space-y-6">
            {/* Auto Policy */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Car className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Auto Policy</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Carrier
                  </label>
                  <input
                    type="text"
                    value={formData.currentCarrier}
                    onChange={(e) => updateField('currentCarrier', e.target.value)}
                    placeholder="e.g., Progressive"
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
                    Liability Limits
                  </label>
                  <select
                    value={formData.coverage.bodilyInjury}
                    onChange={(e) => updateField('coverage', { ...formData.coverage, bodilyInjury: e.target.value })}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border transition-colors',
                      'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                      'border-gray-300 dark:border-gray-600',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                    )}
                  >
                    <option value="">Select limits</option>
                    <option value="100/300">100/300</option>
                    <option value="250/500">250/500 (Required for most umbrella)</option>
                    <option value="500/500">500/500</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    # of Vehicles
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    placeholder="2"
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

            {/* Home Policy */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Home className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Home Policy</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Carrier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., State Farm"
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
                    Liability Limit
                  </label>
                  <select
                    value={formData.coverage.liability}
                    onChange={(e) => updateField('coverage', { ...formData.coverage, liability: e.target.value })}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border transition-colors',
                      'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                      'border-gray-300 dark:border-gray-600',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                    )}
                  >
                    <option value="">Select limit</option>
                    <option value="100000">$100,000</option>
                    <option value="300000">$300,000 (Required for most umbrella)</option>
                    <option value="500000">$500,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Policy Type
                  </label>
                  <select
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border transition-colors',
                      'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                      'border-gray-300 dark:border-gray-600',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                    )}
                  >
                    <option value="">Select type</option>
                    <option value="homeowners">Homeowners (HO3)</option>
                    <option value="renters">Renters (HO4)</option>
                    <option value="condo">Condo (HO6)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Exposures */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Additional Exposures</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasPool}
                    onChange={(e) => updateField('hasPool', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Swimming Pool</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasTrampoline}
                    onChange={(e) => updateField('hasTrampoline', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Trampoline</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasDog}
                    onChange={(e) => updateField('hasDog', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Dog (any breed)</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default UnderlyingPoliciesStep;
