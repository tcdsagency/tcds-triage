'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { FormField } from './FormField';

interface FormRadioGroupProps {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  className?: string;
}

export function FormRadioGroup({
  name,
  label,
  options,
  className,
}: FormRadioGroupProps) {
  const { control } = useFormContext();

  return (
    <FormField name={name} label={label} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={label}>
            {options.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-center gap-2 cursor-pointer',
                  'text-sm text-gray-700 dark:text-gray-300'
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={field.value === opt.value}
                  onChange={() => field.onChange(opt.value)}
                  onBlur={field.onBlur}
                  className={cn(
                    'h-4 w-4 border-gray-300 dark:border-gray-600',
                    'text-emerald-600 focus:ring-emerald-500',
                    'dark:bg-gray-800'
                  )}
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}
      />
    </FormField>
  );
}

export default FormRadioGroup;
