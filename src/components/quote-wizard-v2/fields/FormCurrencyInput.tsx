'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { FormField } from './FormField';

interface FormCurrencyInputProps {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function FormCurrencyInput({
  name,
  label,
  required,
  placeholder,
  className,
}: FormCurrencyInputProps) {
  const { control, formState: { errors } } = useFormContext();

  const error = name.split('.').reduce<any>((acc, part) => acc?.[part], errors);
  const errorId = `${name}-error`;

  return (
    <FormField name={name} label={label} required={required} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm pointer-events-none">
              $
            </span>
            <input
              {...field}
              id={name}
              type="number"
              step="0.01"
              min="0"
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                'w-full pl-7 pr-3 py-2 rounded-md border transition-colors',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 shadow-sm',
                error
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              )}
              onChange={(e) => {
                const value = e.target.value === '' ? '' : Number(e.target.value);
                field.onChange(value);
              }}
            />
          </div>
        )}
      />
    </FormField>
  );
}

export default FormCurrencyInput;
