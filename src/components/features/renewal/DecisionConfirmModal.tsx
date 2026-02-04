'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DecisionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
  decision: string;
  title: string;
  description: string;
  notesRequired?: boolean;
  notesPlaceholder?: string;
}

export default function DecisionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  decision,
  title,
  description,
  notesRequired,
  notesPlaceholder = 'Add notes (optional)...',
}: DecisionConfirmModalProps) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (notesRequired && !notes.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(notes.trim());
      setNotes('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const colorMap: Record<string, string> = {
    renew_as_is: 'bg-green-600 hover:bg-green-700',
    reshop: 'bg-amber-600 hover:bg-amber-700',
    needs_more_info: 'bg-blue-600 hover:bg-blue-700',
    contact_customer: 'bg-blue-600 hover:bg-blue-700',
    no_better_option: 'bg-green-600 hover:bg-green-700',
    bound_new_policy: 'bg-green-600 hover:bg-green-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 m-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={notesRequired ? 'Notes are required for this action...' : notesPlaceholder}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 mb-4"
        />

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || (notesRequired && !notes.trim())}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              colorMap[decision] || 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {submitting ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
