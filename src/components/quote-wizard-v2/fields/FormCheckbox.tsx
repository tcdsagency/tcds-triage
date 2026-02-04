'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface FormCheckboxProps {
  name: string;
  label: string;
  description?: string;
  className?: string;
}

export function FormCheckbox({
  name,
  label,
  description,
  className,
}: FormCheckboxProps) {
  const { control, formState: { errors } } = useFormContext();

  const error = name.split('.').reduce<any>((acc, part) => acc?.[part], errors);
  const errorId = `${name}-error`;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            id={name}
            type="checkbox"
            checked={field.value ?? false}
            onChange={(e) => field.onChange(e.target.checked)}
            onBlur={field.onBlur}
            ref={field.ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600',
              'text-emerald-600 focus:ring-emerald-500',
              'dark:bg-gray-800'
            )}
          />
        )}
      />
      <div className="flex-1">
        <label
          htmlFor={name}
          className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default FormCheckbox;
