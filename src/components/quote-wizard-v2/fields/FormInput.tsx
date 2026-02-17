'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { FormField } from './FormField';

interface FormInputProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number';
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
}

export function FormInput({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  autoFocus,
  disabled,
  className,
  onBlur: onBlurProp,
}: FormInputProps) {
  const { control, formState: { errors } } = useFormContext();

  // Resolve nested error via dot notation
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
            onBlur={(e) => {
              field.onBlur();
              onBlurProp?.();
            }}
            id={name}
            type={type}
            placeholder={placeholder}
            autoFocus={autoFocus}
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
            onChange={(e) => {
              const value =
                type === 'number'
                  ? e.target.value === '' ? '' : Number(e.target.value)
                  : e.target.value;
              field.onChange(value);
            }}
          />
        )}
      />
    </FormField>
  );
}

export default FormInput;
