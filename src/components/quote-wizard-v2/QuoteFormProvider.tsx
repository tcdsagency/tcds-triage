'use client';

/**
 * QuoteFormProvider
 * =================
 * Wraps children in React Hook Form's FormProvider.
 * Resolves the Zod schema for the given quote type.
 */

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSchemaForType, QuoteType } from './schemas';

interface QuoteFormProviderProps {
  children: React.ReactNode;
  quoteType: QuoteType;
  defaultValues: Record<string, any>;
}

export function QuoteFormProvider({
  children,
  quoteType,
  defaultValues,
}: QuoteFormProviderProps) {
  const schema = getSchemaForType(quoteType);

  const methods = useForm({
    resolver: zodResolver(schema as any),
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
}

export default QuoteFormProvider;
