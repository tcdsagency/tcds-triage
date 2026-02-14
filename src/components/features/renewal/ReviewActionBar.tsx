'use client';

import { useState } from 'react';
import { Check, RefreshCw, Flag, Lock, ShieldCheck, FileText } from 'lucide-react';
import DecisionConfirmModal from './DecisionConfirmModal';

interface ReviewActionBarProps {
  renewalId: string;
  currentDecision: string | null;
  status: string;
  onDecision: (decision: string, notes: string) => Promise<void>;
  reviewProgress: number;
  reviewedCount: number;
  totalReviewable: number;
}

export default function ReviewActionBar({
  renewalId,
  currentDecision,
  status,
  onDecision,
  reviewProgress,
  reviewedCount,
  totalReviewable,
}: ReviewActionBarProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    decision: string;
    title: string;
    description: string;
    notesRequired: boolean;
  }>({ isOpen: false, decision: '', title: '', description: '', notesRequired: false });

  const isCompleted = status === 'completed' || status === 'cancelled';
  const isReshopPhase = currentDecision === 'reshop' || status === 'requote_requested' || status === 'quote_ready';
  const reviewIncomplete = reviewProgress < 100;

  const openModal = (decision: string, title: string, description: string, notesRequired: boolean) => {
    setModalState({ isOpen: true, decision, title, description, notesRequired });
  };

  if (isCompleted) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic py-2 text-center">
        This renewal has been completed.
      </div>
    );
  }

  // Don't show if a final decision has been made (but not reshop/needs_more_info/contact_customer)
  if (currentDecision && currentDecision !== 'needs_more_info' && currentDecision !== 'contact_customer' && currentDecision !== 'reshop') {
    return null;
  }

  return (
    <>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 space-y-3">
        {/* Review counter */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {reviewedCount} / {totalReviewable} items reviewed
          </span>
          <span className={`text-xs font-bold ${reviewProgress >= 100 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {reviewProgress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${reviewProgress >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(reviewProgress, 100)}%` }}
          />
        </div>

        {!isReshopPhase ? (
          // Three side-by-side buttons
          <div className="flex gap-2">
            {/* Approve Renewal */}
            <div className="flex-1 relative group">
              <button
                onClick={() =>
                  openModal(
                    'renew_as_is',
                    'Approve Renewal',
                    'Approve the renewal with no changes. The SR will be moved to completed.',
                    false,
                  )
                }
                disabled={reviewIncomplete}
                className={
                  reviewIncomplete
                    ? 'w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium'
                    : 'w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-green-500 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm font-medium'
                }
              >
                {reviewIncomplete ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve
              </button>
              {reviewIncomplete && (
                <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 -top-9 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                  Review all items first
                </div>
              )}
            </div>

            {/* Reshop via Quotation */}
            <button
              onClick={() =>
                openModal(
                  'reshop',
                  'Reshop via Quotation',
                  'Send this renewal for re-quoting. The SR will move to "Requote Requested" stage.',
                  true,
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Reshop
            </button>

            {/* Flag for Review */}
            <button
              onClick={() =>
                openModal(
                  'needs_more_info',
                  'Flag for Review',
                  'Flag this for additional information. A note will be posted.',
                  true,
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <Flag className="h-4 w-4" />
              Flag
            </button>
          </div>
        ) : (
          // Post-reshop buttons
          <div className="flex gap-2">
            <button
              onClick={() =>
                openModal(
                  'no_better_option',
                  'No Better Option',
                  'No better quote was found. The renewal will be accepted as-is.',
                  false,
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-green-500 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm font-medium"
            >
              <ShieldCheck className="h-4 w-4" />
              No Better Option
            </button>
            <button
              onClick={() =>
                openModal(
                  'bound_new_policy',
                  'Bound New Policy',
                  'A better policy was found and bound. Include the new policy number in notes.',
                  true,
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <FileText className="h-4 w-4" />
              Bound New Policy
            </button>
          </div>
        )}
      </div>

      <DecisionConfirmModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(s => ({ ...s, isOpen: false }))}
        onConfirm={(notes) => onDecision(modalState.decision, notes)}
        decision={modalState.decision}
        title={modalState.title}
        description={modalState.description}
        notesRequired={modalState.notesRequired}
        notesPlaceholder={
          modalState.decision === 'bound_new_policy'
            ? 'Enter the new policy number...'
            : modalState.decision === 'reshop'
              ? 'Reason for reshopping...'
              : 'Add notes (optional)...'
        }
      />
    </>
  );
}
