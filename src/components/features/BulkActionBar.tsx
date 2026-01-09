'use client';

import { cn } from '@/lib/utils';
import type { PendingItem } from './PendingItemCard';

// =============================================================================
// TYPES
// =============================================================================

interface BulkActionBarProps {
  selectedItems: PendingItem[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkAction: (action: 'note' | 'ticket' | 'acknowledge' | 'skip' | 'delete') => void;
  totalItems: number;
  isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function BulkActionBar({
  selectedItems,
  onSelectAll,
  onClearSelection,
  onBulkAction,
  totalItems,
  isLoading = false,
}: BulkActionBarProps) {
  const selectedCount = selectedItems.length;
  const hasMatchedItems = selectedItems.some(item =>
    item.matchStatus === 'matched' || item.agencyzoomCustomerId
  );
  const hasMessages = selectedItems.some(item => item.type === 'message');
  const allSelected = selectedCount === totalItems && totalItems > 0;

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl border border-gray-700">
        {/* Selection Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={allSelected ? onClearSelection : onSelectAll}
              className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-700"
            />
            <span className="text-sm font-medium">
              {selectedCount} selected
            </span>
          </div>

          <button
            onClick={onClearSelection}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Post as Note - only if some items have customer match */}
          {hasMatchedItems && (
            <button
              onClick={() => onBulkAction('note')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isLoading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              <span>📝</span>
              <span>Post Notes</span>
            </button>
          )}

          {/* Create Tickets - only if some items have customer match */}
          {hasMatchedItems && (
            <button
              onClick={() => onBulkAction('ticket')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isLoading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              )}
            >
              <span>🎫</span>
              <span>Create Tickets</span>
            </button>
          )}

          {/* Acknowledge - only if some items are messages */}
          {hasMessages && (
            <button
              onClick={() => onBulkAction('acknowledge')}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isLoading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              )}
            >
              <span>✓</span>
              <span>Acknowledge</span>
            </button>
          )}

          {/* Skip/Complete */}
          <button
            onClick={() => onBulkAction('skip')}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isLoading
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            )}
          >
            <span>↷</span>
            <span>Skip All</span>
          </button>

          {/* Delete */}
          <button
            onClick={() => onBulkAction('delete')}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isLoading
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            )}
          >
            <span>🗑</span>
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
