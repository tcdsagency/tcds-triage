'use client';

import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  Coverages: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Coverage: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Premium/Rate': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Property: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Deductibles: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Deductible: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Vehicles: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  Vehicle: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  Drivers: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  Driver: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  Identity: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  Endorsements: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Endorsement: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const DEFAULT_COLOR = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export default function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const color = CATEGORY_COLORS[category] || DEFAULT_COLOR;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap',
        color,
        className,
      )}
    >
      {category}
    </span>
  );
}
