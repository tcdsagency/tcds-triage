'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface FormFieldGridProps {
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

const colClasses: Record<number, string> = {
  1: 'grid grid-cols-1 gap-4',
  2: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
  3: 'grid grid-cols-1 sm:grid-cols-3 gap-4',
  4: 'grid grid-cols-1 sm:grid-cols-4 gap-4',
};

export function FormFieldGrid({
  cols = 2,
  children,
  className,
}: FormFieldGridProps) {
  return (
    <div className={cn(colClasses[cols], className)}>
      {children}
    </div>
  );
}

export default FormFieldGrid;
