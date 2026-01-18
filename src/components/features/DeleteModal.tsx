'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes?: string) => void;
  isLoading?: boolean;
  itemInfo?: { phone: string; summary: string };
}

// =============================================================================
// DELETE REASONS
// =============================================================================

const DELETE_REASONS = [
  { value: 'spam', label: 'Spam/Robocall', icon: '🤖' },
  { value: 'wrong_number', label: 'Wrong Number', icon: '📞' },
  { value: 'duplicate', label: 'Duplicate Entry', icon: '📋' },
  { value: 'test_call', label: 'Test Call', icon: '🧪' },
  { value: 'accidental', label: 'Accidental Dial', icon: '👆' },
  { value: 'other', label: 'Other', icon: '📝' },
] as const;

type DeleteReason = typeof DELETE_REASONS[number]['value'];

// =============================================================================
// COMPONENT
// =============================================================================

export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  itemInfo,
}: DeleteModalProps) {
  const [selectedReason, setSelectedReason] = useState<DeleteReason | null>(null);
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!selectedReason) return;
    onConfirm(selectedReason, notes || undefined);
  };

  const handleClose = () => {
    if (isLoading) return;
    setSelectedReason(null);
    setNotes('');
    onClose();
  };

  // Require notes for "other" reason
  const isConfirmDisabled = !selectedReason || (selectedReason === 'other' && !notes.trim()) || isLoading;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-red-600">
          <h2 className="text-lg font-bold text-white">Delete Item</h2>
          <p className="text-sm text-red-100">Select a reason for removing this item</p>
        </div>

        {/* Item Info */}
        {itemInfo && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">
              Deleting:
            </div>
            <div className="text-sm text-gray-900 dark:text-white font-mono">
              {itemInfo.phone}
            </div>
            {itemInfo.summary && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {itemInfo.summary}
              </div>
            )}
          </div>
        )}

        {/* Reason Selection */}
        <div className="p-6 space-y-3">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Why are you deleting this item?
          </label>

          <div className="grid grid-cols-2 gap-2">
            {DELETE_REASONS.map((reason) => (
              <button
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                disabled={isLoading}
                className={cn(
                  'px-3 py-3 rounded-lg border-2 text-left transition-all flex items-center gap-2',
                  selectedReason === reason.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="text-lg">{reason.icon}</span>
                <span className="text-sm font-medium">{reason.label}</span>
              </button>
            ))}
          </div>

          {/* Notes field (always visible, required for "other") */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes {selectedReason === 'other' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={selectedReason === 'other' ? 'Please explain why...' : 'Optional additional details...'}
              disabled={isLoading}
              className={cn(
                'w-full px-3 py-2 rounded-lg border text-sm',
                'border-gray-300 dark:border-gray-600',
                'bg-white dark:bg-gray-700',
                'text-gray-900 dark:text-white',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'focus:ring-2 focus:ring-red-500 focus:border-red-500',
                'resize-none',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
              'text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700',
              'hover:bg-gray-300 dark:hover:bg-gray-600',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-semibold transition-colors',
              'bg-red-600 text-white',
              isConfirmDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-red-700',
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                Deleting...
              </span>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
