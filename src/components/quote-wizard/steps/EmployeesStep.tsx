'use client';

/**
 * Employees Step Component
 * ========================
 * Collects employee and payroll information for Workers Comp quotes.
 */

import { useQuoteWizard } from '../QuoteWizardProvider';
import { cn } from '@/lib/utils';
import { Users, DollarSign, Briefcase } from 'lucide-react';

export function EmployeesStep() {
  const { formData, updateField, errors } = useQuoteWizard();

  return (
    <div className="space-y-8">
      {/* Employee Count */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Employee Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Employee Count <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.employeeCount}
              onChange={(e) => updateField('employeeCount', e.target.value)}
              placeholder="10"
              min="1"
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
              Full-Time Employees
            </label>
            <input
              type="number"
              placeholder="8"
              min="0"
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
              Part-Time Employees
            </label>
            <input
              type="number"
              placeholder="2"
              min="0"
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
              Owners Included in Coverage
            </label>
            <input
              type="number"
              placeholder="1"
              min="0"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
          </div>
        </div>
      </section>

      {/* Payroll Information */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Payroll Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Annual Payroll <span className="text-red-500">*</span>
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
              Owner Payroll (if included)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="text"
                placeholder="75,000"
                className={cn(
                  'w-full pl-7 pr-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                  'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                )}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Class Codes */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Job Classifications
          </h3>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Common class codes will be added based on business type. Additional codes can be specified below.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Class Code
                </label>
                <input
                  type="text"
                  placeholder="8810"
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
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Clerical Office"
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
                  Payroll for Class
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    placeholder="100,000"
                    className={cn(
                      'w-full pl-7 pr-3 py-2 rounded-lg border transition-colors',
                      'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                      'border-gray-300 dark:border-gray-600',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-500'
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Experience Mod */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Experience Modification
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Experience Mod Rate (if known)
            </label>
            <input
              type="text"
              placeholder="1.00"
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave blank if new to workers comp or unknown
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Claims in Past 3 Years
            </label>
            <select
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500'
              )}
            >
              <option value="0">None</option>
              <option value="1">1 claim</option>
              <option value="2">2 claims</option>
              <option value="3">3+ claims</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}

export default EmployeesStep;
