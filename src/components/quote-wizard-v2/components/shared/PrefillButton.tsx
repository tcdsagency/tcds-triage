'use client';

/**
 * PrefillButton
 * ==============
 * Triggers LexisNexis/MSB prefill for the current quote type.
 * Shows loading state and result summary.
 */

import React from 'react';
import { Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PrefillStatus } from '../../hooks/usePrefill';

interface PrefillButtonProps {
  label: string;
  status: PrefillStatus;
  summary?: string | null;
  error?: string | null;
  onClick: () => void;
  className?: string;
}

export function PrefillButton({
  label,
  status,
  summary,
  error,
  onClick,
  className,
}: PrefillButtonProps) {
  const isLoading = status === 'loading';
  const isLoaded = status === 'loaded';
  const isError = status === 'error';

  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          isLoaded
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-indigo-600 text-white hover:bg-indigo-700',
          'disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed',
          'dark:disabled:bg-gray-700 dark:disabled:text-gray-500'
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Prefilling...
          </>
        ) : isLoaded ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            {label}
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            {label}
          </>
        )}
      </button>

      {isLoaded && summary && (
        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          {summary}
        </span>
      )}

      {isError && error && (
        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </span>
      )}
    </div>
  );
}
