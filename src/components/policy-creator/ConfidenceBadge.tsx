'use client';

import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  confidence: number | undefined;
  className?: string;
}

/**
 * Shows extraction confidence as a colored indicator.
 * - Green (≥0.9): High confidence
 * - Yellow (0.7-0.9): Review recommended
 * - Red (<0.7): Manual entry needed
 */
export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  if (confidence === undefined) return null;

  const level =
    confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';

  const colors = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-red-100 text-red-700 border-red-200',
  };

  const labels = {
    high: 'High',
    medium: 'Review',
    low: 'Low',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border',
        colors[level],
        className
      )}
      title={`Confidence: ${Math.round(confidence * 100)}%`}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          level === 'high' && 'bg-green-500',
          level === 'medium' && 'bg-amber-500',
          level === 'low' && 'bg-red-500'
        )}
      />
      {labels[level]} ({Math.round(confidence * 100)}%)
    </span>
  );
}
