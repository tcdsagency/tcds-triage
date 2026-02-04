'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface FormSectionProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  icon: Icon,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export default FormSection;
