'use client';

import { useState } from 'react';
import { Check, RefreshCw, Flag, Lock, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import DecisionConfirmModal from './DecisionConfirmModal';

interface ReviewActionBarProps {
  renewalId: string;
  currentDecision: string | null;
  status: string;
  onDecision: (decision: string, notes: string) => Promise<void>;
  reviewProgress: number;
  reviewedCount: number;
  totalReviewable: number;
  materialChangesCount?: number;
  quotamationUrl?: string;
}

export default function ReviewActionBar({
  renewalId,
  currentDecision,
  status,
  onDecision,
  reviewProgress,
  reviewedCount,
  totalReviewable,
  materialChangesCount = 0,
  quotamationUrl,
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
  // When check engine didn't run but material changes exist, treat as incomplete
  const reviewIncomplete = totalReviewable === 0
    ? materialChangesCount > 0
    : reviewProgress < 100;

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
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] bg-gray-50 dark:bg-gray-900/50 px-5 py-3 space-y-3">
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

        {/* Quotamation reshop link (always visible) */}
        {quotamationUrl && (
          <a
            href={quotamationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Reshop via Quotamation
          </a>
        )}

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

            {/* Reshop */}
            <div className="flex-1 relative group">
              <button
                onClick={() =>
                  openModal(
                    'reshop',
                    'Reshop',
                    reviewIncomplete
                      ? 'You have not reviewed all items yet. Are you sure you want to reshop? Notes are required.'
                      : 'Send this renewal for re-quoting. The SR will move to "Requote Requested" stage.',
                    true,
                  )
                }
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
                  reviewIncomplete
                    ? 'bg-amber-400 text-white hover:bg-amber-500'
                    : 'bg-amber-500 text-white hover:bg-amber-600',
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Reshop
              </button>
              {reviewIncomplete && (
                <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 -top-9 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                  Review incomplete — notes required
                </div>
              )}
            </div>

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
