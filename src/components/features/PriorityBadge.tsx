'use client';

import { cn } from '@/lib/utils';
import { getPriorityStyle, type Priority } from '@/lib/priority-calculator';

interface PriorityBadgeProps {
  priority: Priority;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Priority badge component showing high/medium/low priority status
 */
export function PriorityBadge({
  priority,
  showLabel = true,
  size = 'sm',
  className = '',
}: PriorityBadgeProps) {
  const style = getPriorityStyle(priority);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-semibold border',
        style.bgColor,
        style.textColor,
        style.borderColor,
        sizeClasses[size],
        className
      )}
      title={`${style.label} Priority`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', style.dotColor)} />
      {showLabel && <span>{style.label}</span>}
    </span>
  );
}

/**
 * Compact priority indicator (just the dot)
 */
export function PriorityDot({
  priority,
  className = '',
}: {
  priority: Priority;
  className?: string;
}) {
  const style = getPriorityStyle(priority);

  return (
    <span
      className={cn('w-2 h-2 rounded-full', style.dotColor, className)}
      title={`${style.label} Priority`}
    />
  );
}
