'use client';

import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onPostNotes: () => void;
  onCreateTickets: () => void;
  onSkip: () => void;
  onDelete: () => void;
  loading?: boolean;
  hasMatchedItems?: boolean;
}

/**
 * Floating action bar for bulk operations on selected triage items
 */
export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onPostNotes,
  onCreateTickets,
  onSkip,
  onDelete,
  loading = false,
  hasMatchedItems = true,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-200">
      <div className="bg-blue-600 dark:bg-blue-700 text-white shadow-lg border-t border-blue-500">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Selection info */}
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </span>

              {!allSelected && (
                <button
                  onClick={onSelectAll}
                  disabled={loading}
                  className="text-sm text-blue-100 hover:text-white underline underline-offset-2"
                >
                  Select all {totalCount}
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Post Notes (only for matched items) */}
              {hasMatchedItems && (
                <button
                  onClick={onPostNotes}
                  disabled={loading}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-medium text-sm transition-colors',
                    'bg-white text-blue-600 hover:bg-blue-50',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {loading ? '...' : 'Post Notes'}
                </button>
              )}

              {/* Create Tickets */}
              <button
                onClick={onCreateTickets}
                disabled={loading}
                className={cn(
                  'px-3 py-1.5 rounded-md font-medium text-sm transition-colors',
                  'bg-white text-blue-600 hover:bg-blue-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loading ? '...' : 'Create Tickets'}
              </button>

              {/* Skip */}
              <button
                onClick={onSkip}
                disabled={loading}
                className={cn(
                  'px-3 py-1.5 rounded-md font-medium text-sm transition-colors',
                  'bg-blue-700 hover:bg-blue-800 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loading ? '...' : 'Skip All'}
              </button>

              {/* Delete */}
              <button
                onClick={onDelete}
                disabled={loading}
                className={cn(
                  'px-3 py-1.5 rounded-md font-medium text-sm transition-colors',
                  'bg-red-500 hover:bg-red-600 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loading ? '...' : 'Delete'}
              </button>

              {/* Cancel/Clear */}
              <button
                onClick={onClearSelection}
                disabled={loading}
                className={cn(
                  'px-3 py-1.5 rounded-md font-medium text-sm transition-colors',
                  'bg-blue-700 hover:bg-blue-800 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Selection checkbox for individual items
 */
export function SelectionCheckbox({
  checked,
  onChange,
  disabled = false,
  className = '',
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'w-4 h-4 rounded border-gray-300 dark:border-gray-600',
        'text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400',
        'bg-white dark:bg-gray-800',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    />
  );
}
