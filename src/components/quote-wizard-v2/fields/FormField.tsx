'use client';

import React from 'react';
import { useFormContext, FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Retrieve a nested error from formState.errors using dot-notation.
 * e.g. 'coverage.bodilyInjury' -> errors.coverage.bodilyInjury
 */
function getNestedError(
  errors: Record<string, any>,
  name: string
): FieldError | undefined {
  const parts = name.split('.');
  let current: any = errors;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current as FieldError | undefined;
}

export function FormField({
  name,
  label,
  required,
  children,
  className,
}: FormFieldProps) {
  const {
    formState: { errors },
  } = useFormContext();

  const error = getNestedError(errors, name);
  const errorId = `${name}-error`;

  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? errorId : undefined,
          });
        }
        return child;
      })}

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

export default FormField;
