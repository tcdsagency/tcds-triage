'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Umbrella } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormSection } from '../../fields';
import { UMBRELLA_LIMITS } from '../../config/options';

export function UmbrellaCoverageStep() {
  const { watch, setValue } = useFormContext();
  const selectedLimit = watch('coverage.umbrellaLimit');

  return (
    <div className="space-y-8">
      <FormSection title="Umbrella Coverage Limit" icon={Umbrella}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          An umbrella policy provides an extra layer of liability protection
          above and beyond your existing auto and homeowners policies. Choose the
          coverage limit that best fits your net worth and risk exposure. Higher
          limits offer greater protection against costly lawsuits and judgments.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {UMBRELLA_LIMITS.map((limit) => {
            const isSelected = selectedLimit === limit.value;

            return (
              <button
                key={limit.value}
                type="button"
                onClick={() => setValue('coverage.umbrellaLimit', limit.value)}
                className={cn(
                  'rounded-lg border-2 p-5 text-left transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  'dark:focus:ring-offset-gray-900',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'text-lg font-bold',
                      isSelected
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-100'
                    )}
                  >
                    {limit.label}
                  </span>
                  {isSelected && (
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {limit.description}
                </p>
              </button>
            );
          })}
        </div>
      </FormSection>
    </div>
  );
}

export default UmbrellaCoverageStep;
