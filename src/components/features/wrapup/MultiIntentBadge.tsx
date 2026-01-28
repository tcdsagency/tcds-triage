'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MultiIntentBadgeProps {
  intentCount: number;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * MultiIntentBadge
 * ================
 * Displays a warning badge when multiple service requests are detected in a call.
 * V1: Warning only with acknowledgment
 * V2: Clickable to expand intent details
 */
export default function MultiIntentBadge({
  intentCount,
  acknowledged = false,
  onAcknowledge,
  onClick,
  className,
}: MultiIntentBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (intentCount <= 1) {
    return null;
  }

  const badgeColor = acknowledged
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';

  const borderColor = acknowledged
    ? 'border-gray-300 dark:border-gray-600'
    : 'border-yellow-300 dark:border-yellow-700';

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={onClick || onAcknowledge}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
          badgeColor,
          borderColor,
          onClick && 'cursor-pointer hover:scale-105',
          !onClick && !onAcknowledge && 'cursor-default'
        )}
      >
        {/* Warning icon */}
        {!acknowledged && (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        )}

        {/* Check icon when acknowledged */}
        {acknowledged && (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        )}

        <span>
          {intentCount} Service Requests
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
            <p className="font-medium mb-1">Multiple Requests Detected</p>
            <p className="text-gray-300">
              This call contains {intentCount} distinct service requests.
              {!acknowledged && ' Click to view details or acknowledge.'}
              {acknowledged && ' Acknowledged.'}
            </p>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}
