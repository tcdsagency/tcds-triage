'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { FormField } from './FormField';

interface FormSelectProps {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FormSelect({
  name,
  label,
  options,
  required,
  placeholder,
  disabled,
  className,
}: FormSelectProps) {
  const { control, formState: { errors } } = useFormContext();

  const error = name.split('.').reduce<any>((acc, part) => acc?.[part], errors);
  const errorId = `${name}-error`;

  return (
    <FormField name={name} label={label} required={required} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <select
            {...field}
            id={name}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'w-full px-3 py-2 rounded-md border transition-colors',
              'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 shadow-sm',
              error
                ? 'border-red-300 dark:border-red-500'
                : 'border-gray-300 dark:border-gray-600',
              disabled && 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
            )}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      />
    </FormField>
  );
}

export default FormSelect;
