'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { FormField } from './FormField';

interface FormDateInputProps {
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormDateInput({
  name,
  label,
  required,
  disabled,
  className,
}: FormDateInputProps) {
  const { control, formState: { errors } } = useFormContext();

  const error = name.split('.').reduce<any>((acc, part) => acc?.[part], errors);
  const errorId = `${name}-error`;

  return (
    <FormField name={name} label={label} required={required} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            {...field}
            id={name}
            type="date"
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
          />
        )}
      />
    </FormField>
  );
}

export default FormDateInput;
