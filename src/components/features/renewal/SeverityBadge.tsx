'use client';

import { cn } from '@/lib/utils';
import type { CheckSeverity } from '@/types/check-rules.types';

interface SeverityBadgeProps {
  severity: CheckSeverity;
  compact?: boolean;
}

const severityConfig: Record<CheckSeverity, { bg: string; text: string; label: string }> = {
  critical: {
    bg: 'bg-rose-600',
    text: 'text-white',
    label: 'Critical',
  },
  warning: {
    bg: 'bg-amber-400',
    text: 'text-black',
    label: 'Warning',
  },
  info: {
    bg: 'bg-blue-500',
    text: 'text-white',
    label: 'Info',
  },
  unchanged: {
    bg: 'bg-gray-200 dark:bg-gray-700',
    text: 'text-gray-500 dark:text-gray-400',
    label: 'Unchanged',
  },
  added: {
    bg: 'bg-violet-500',
    text: 'text-white',
    label: 'Added',
  },
  removed: {
    bg: 'bg-transparent border border-rose-400',
    text: 'text-rose-500',
    label: 'Removed',
  },
};

export default function SeverityBadge({ severity, compact }: SeverityBadgeProps) {
  const config = severityConfig[severity];

  if (compact && severity === 'unchanged') {
    return (
      <span className="inline-block h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        config.bg,
        config.text,
      )}
    >
      {config.label}
    </span>
  );
}
