'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { WrapupDeleteReason } from '@/types';

interface DeleteWrapupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: WrapupDeleteReason, notes?: string) => void;
  isLoading?: boolean;
  callerName?: string;
}

const DELETE_REASONS: { value: WrapupDeleteReason; label: string; description: string }[] = [
  { value: 'spam', label: 'Spam/Junk', description: 'Telemarketer, robocall, or unwanted solicitation' },
  { value: 'wrong_number', label: 'Wrong Number', description: 'Caller reached wrong business or person' },
  { value: 'duplicate', label: 'Duplicate', description: 'This call was already processed separately' },
  { value: 'test_call', label: 'Test Call', description: 'Internal test call, not a real customer' },
  { value: 'no_action_needed', label: 'No Action Needed', description: 'Call was handled but no note required' },
  { value: 'other', label: 'Other', description: 'Other reason (specify in notes)' },
];

export default function DeleteWrapupModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  callerName = 'this wrapup',
}: DeleteWrapupModalProps) {
  const [selectedReason, setSelectedReason] = useState<WrapupDeleteReason | null>(null);
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!selectedReason) return;
    onConfirm(selectedReason, notes.trim() || undefined);
  };

  const handleClose = () => {
    setSelectedReason(null);
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-red-600">
          <h2 className="text-lg font-bold text-white">Delete Wrapup</h2>
          <p className="text-sm text-red-100">
            Why are you deleting {callerName}?
          </p>
        </div>

        {/* Reason Selection */}
        <div className="p-4 max-h-80 overflow-y-auto">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select a reason for deleting this call record. This helps us improve our filtering.
          </p>
          <div className="space-y-2">
            {DELETE_REASONS.map((reason) => (
              <button
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                className={cn(
                  'w-full p-3 rounded-lg border text-left transition-all',
                  selectedReason === reason.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {reason.label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {reason.description}
                </div>
              </button>
            ))}
          </div>

          {/* Optional Notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional context..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !selectedReason}
            className={cn(
              'flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors',
              selectedReason
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-400 cursor-not-allowed'
            )}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
