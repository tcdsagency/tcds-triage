'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { FormField } from './FormField';

interface FormTextareaProps {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function FormTextarea({
  name,
  label,
  required,
  placeholder,
  rows = 3,
  className,
}: FormTextareaProps) {
  const { control, formState: { errors } } = useFormContext();

  const error = name.split('.').reduce<any>((acc, part) => acc?.[part], errors);
  const errorId = `${name}-error`;

  return (
    <FormField name={name} label={label} required={required} className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <textarea
            {...field}
            id={name}
            rows={rows}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'w-full px-3 py-2 rounded-lg border transition-colors',
              'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
              error
                ? 'border-red-300 dark:border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            )}
          />
        )}
      />
    </FormField>
  );
}

export default FormTextarea;
