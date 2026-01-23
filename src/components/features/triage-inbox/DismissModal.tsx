'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DismissModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss: (reason: string) => Promise<void>;
  loading: boolean;
}

const DISMISSAL_REASONS = [
  { key: 'spam', label: 'Spam / Telemarketing' },
  { key: 'wrong_number', label: 'Wrong Number' },
  { key: 'hang_up', label: 'Hang Up / No Conversation' },
  { key: 'already_resolved', label: 'Already Resolved' },
  { key: 'duplicate', label: 'Duplicate Entry' },
  { key: 'test_call', label: 'Test Call' },
  { key: 'internal', label: 'Internal Call' },
  { key: 'no_action_needed', label: 'No Action Needed' },
  { key: 'other', label: 'Other' },
];

export default function DismissModal({
  isOpen,
  onClose,
  onDismiss,
  loading,
}: DismissModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState('');

  if (!isOpen) return null;

  const handleDismiss = async () => {
    const reason = selectedReason === 'other' ? `other: ${otherReason}` : selectedReason;
    if (reason) {
      await onDismiss(reason);
    }
  };

  const canSubmit = selectedReason && (selectedReason !== 'other' || otherReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Dismiss Item</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Select a reason for dismissing this item:
          </p>

          <div className="space-y-2">
            {DISMISSAL_REASONS.map((reason) => (
              <button
                key={reason.key}
                onClick={() => setSelectedReason(reason.key)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                  selectedReason === reason.key
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                    selectedReason === reason.key
                      ? 'border-primary'
                      : 'border-muted-foreground'
                  )}>
                    {selectedReason === reason.key && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span>{reason.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Other reason input */}
          {selectedReason === 'other' && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Please specify:
              </label>
              <input
                type="text"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDismiss}
            disabled={!canSubmit || loading}
            className={cn(
              'px-4 py-2 bg-gray-600 text-white rounded-lg transition-colors',
              canSubmit && !loading
                ? 'hover:bg-gray-700'
                : 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? 'Dismissing...' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}
