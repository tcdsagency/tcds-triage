'use client';

import { useState } from 'react';
import { Check, RefreshCw, Flag, Lock, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import DecisionConfirmModal from './DecisionConfirmModal';

interface FixedBottomBarProps {
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

export default function FixedBottomBar({
  renewalId,
  currentDecision,
  status,
  onDecision,
  reviewProgress,
  reviewedCount,
  totalReviewable,
  materialChangesCount = 0,
  quotamationUrl,
}: FixedBottomBarProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    decision: string;
    title: string;
    description: string;
    notesRequired: boolean;
  }>({ isOpen: false, decision: '', title: '', description: '', notesRequired: false });

  const isCompleted = status === 'completed' || status === 'cancelled';
  const isReshopPhase = currentDecision === 'reshop' || status === 'requote_requested' || status === 'quote_ready';
  const reviewIncomplete = totalReviewable === 0
    ? materialChangesCount > 0
    : reviewProgress < 100;

  const openModal = (decision: string, title: string, description: string, notesRequired: boolean) => {
    setModalState({ isOpen: true, decision, title, description, notesRequired });
  };

  if (isCompleted) {
    return (
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3">
        <div className="max-w-screen-2xl mx-auto text-center text-sm text-gray-500 italic">
          This renewal has been completed.
        </div>
      </div>
    );
  }

  if (currentDecision && currentDecision !== 'needs_more_info' && currentDecision !== 'contact_customer' && currentDecision !== 'reshop') {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-screen-2xl mx-auto px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Review counter */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">
                  {reviewedCount} / {totalReviewable}
                </span>
                <span className="text-xs text-gray-400">reviewed</span>
              </div>
              <div className="h-1.5 w-24 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    reviewProgress >= 100 ? 'bg-green-500' : 'bg-amber-500',
                  )}
                  style={{ width: `${Math.min(reviewProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Quotamation reshop link */}
            {quotamationUrl && (
              <a
                href={quotamationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Reshop via Quotamation
              </a>
            )}

            {!isReshopPhase ? (
              <div className="flex gap-2">
                {/* Approve */}
                <div className="relative group">
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
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      reviewIncomplete
                        ? 'border-2 border-gray-300 text-gray-400 cursor-not-allowed'
                        : 'border-2 border-green-500 text-green-700 hover:bg-green-50',
                    )}
                  >
                    {reviewIncomplete ? <Lock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    Approve
                  </button>
                  {reviewIncomplete && (
                    <div className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 -top-9 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                      Review all items first
                    </div>
                  )}
                </div>

                {/* Reshop */}
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
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    reviewIncomplete
                      ? 'bg-amber-400 text-white hover:bg-amber-500'
                      : 'bg-amber-500 text-white hover:bg-amber-600',
                  )}
                >
                  <RefreshCw className="h-4 w-4" />
                  Reshop
                </button>

                {/* Flag */}
                <button
                  onClick={() =>
                    openModal(
                      'needs_more_info',
                      'Flag for Review',
                      'Flag this for additional information. A note will be posted.',
                      true,
                    )
                  }
                  className="flex items-center gap-1.5 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                >
                  <Flag className="h-4 w-4" />
                  Flag
                </button>
              </div>
            ) : (
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
                  className="flex items-center gap-1.5 px-4 py-2 border-2 border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
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
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  <FileText className="h-4 w-4" />
                  Bound New Policy
                </button>
              </div>
            )}
          </div>
        </div>
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
