'use client';

import { useState } from 'react';
import { Check, RefreshCw, HelpCircle, Phone, ShieldCheck, FileText } from 'lucide-react';
import DecisionConfirmModal from './DecisionConfirmModal';

interface AgentActionButtonsProps {
  renewalId: string;
  currentDecision: string | null;
  status: string;
  onDecision: (decision: string, notes: string) => Promise<void>;
}

export default function AgentActionButtons({
  renewalId,
  currentDecision,
  status,
  onDecision,
}: AgentActionButtonsProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    decision: string;
    title: string;
    description: string;
    notesRequired: boolean;
  }>({ isOpen: false, decision: '', title: '', description: '', notesRequired: false });

  const isCompleted = status === 'completed' || status === 'cancelled';
  const isReshopPhase = currentDecision === 'reshop' || status === 'requote_requested' || status === 'quote_ready';

  const openModal = (decision: string, title: string, description: string, notesRequired: boolean) => {
    setModalState({ isOpen: true, decision, title, description, notesRequired });
  };

  if (isCompleted) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
        This renewal has been completed.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {!isReshopPhase ? (
          // Initial decision buttons
          <>
            <button
              onClick={() =>
                openModal(
                  'renew_as_is',
                  'Renew As-Is',
                  'Approve the renewal with no changes. The SR will be moved to completed.',
                  false
                )
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Check className="h-4 w-4" />
              Renew As-Is
            </button>

            <button
              onClick={() =>
                openModal(
                  'reshop',
                  'Reshop',
                  'Send this renewal for re-quoting. The SR will move to "Requote Requested" stage.',
                  true
                )
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Reshop
            </button>

            <button
              onClick={() =>
                openModal(
                  'needs_more_info',
                  'Needs More Info',
                  'Flag this for additional information. No stage change - a note will be posted.',
                  true
                )
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <HelpCircle className="h-4 w-4" />
              Needs More Info
            </button>

            <button
              onClick={() =>
                openModal(
                  'contact_customer',
                  'Contact Customer',
                  'Move to the "Contact Customer" stage to discuss the renewal.',
                  false
                )
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <Phone className="h-4 w-4" />
              Contact Customer
            </button>
          </>
        ) : (
          // Post-reshop producer buttons
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Reshop in progress - choose outcome:
            </p>
            <button
              onClick={() =>
                openModal(
                  'no_better_option',
                  'No Better Option',
                  'No better quote was found. The renewal will be accepted as-is and the SR completed.',
                  false
                )
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
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
                  true
                )
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <FileText className="h-4 w-4" />
              Bound New Policy
            </button>
          </>
        )}
      </div>

      <DecisionConfirmModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((s) => ({ ...s, isOpen: false }))}
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
