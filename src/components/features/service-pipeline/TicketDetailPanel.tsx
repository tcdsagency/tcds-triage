'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ServiceTicketItem, TriageItem, Employee } from '@/app/api/service-pipeline/route';
import { formatPhoneNumber } from '@/lib/utils';
import {
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  PIPELINE_STAGES,
} from '@/lib/api/agencyzoom-service-tickets';

interface TicketDetailPanelProps {
  item: ServiceTicketItem | TriageItem | null;
  itemType: 'ticket' | 'triage' | null;
  stages: { id: string | number; name: string }[];
  employees: Employee[];
  isOpen: boolean;
  onClose: () => void;
  onStageChange?: (ticketId: string, stageId: number, stageName: string) => Promise<void>;
  onAssigneeChange?: (ticketId: string, csrId: number, csrName: string) => Promise<void>;
  onTriageAction?: (item: TriageItem, action: 'note' | 'ticket' | 'skip' | 'delete') => void;
  onTicketUpdated?: () => void;
}

// Service stages for the pipeline
const SERVICE_STAGES = [
  { id: PIPELINE_STAGES.POLICY_SERVICE_NEW, name: 'New' },
  { id: PIPELINE_STAGES.POLICY_SERVICE_IN_PROGRESS, name: 'In Progress' },
  { id: PIPELINE_STAGES.POLICY_SERVICE_WAITING_ON_INFO, name: 'Waiting on Info' },
];

// Categories for dropdown
const CATEGORY_OPTIONS = [
  { id: 0, name: 'N/A' },
  { id: SERVICE_CATEGORIES.GENERAL_SERVICE, name: 'General Service' },
  { id: SERVICE_CATEGORIES.QUOTE_REQUEST, name: 'Quote Request' },
  { id: SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS, name: 'Billing Question' },
  { id: SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE, name: 'Coverage Change' },
  { id: SERVICE_CATEGORIES.SERVICE_VEHICLE, name: 'Vehicle Change' },
  { id: SERVICE_CATEGORIES.SERVICE_DRIVER, name: 'Driver Change' },
  { id: SERVICE_CATEGORIES.SERVICE_PROPERTY, name: 'Property Change' },
  { id: SERVICE_CATEGORIES.SERVICE_LIENHOLDER, name: 'Lienholder Change' },
  { id: SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING, name: 'Cancellation Request' },
  { id: SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION, name: 'Pending Cancellation' },
  { id: SERVICE_CATEGORIES.SERVICE_COI, name: 'Certificate of Insurance' },
  { id: SERVICE_CATEGORIES.SERVICE_ID_CARDS, name: 'ID Cards' },
  { id: SERVICE_CATEGORIES.CLAIMS_FILED, name: 'Claim Filed' },
  { id: SERVICE_CATEGORIES.CLAIMS_STATUS, name: 'Claim Status' },
];

// Priorities for dropdown
const PRIORITY_OPTIONS = [
  { id: 0, name: 'N/A' },
  { id: SERVICE_PRIORITIES.URGENT, name: 'High' },
  { id: SERVICE_PRIORITIES.TWO_HOUR, name: 'Medium' },
  { id: SERVICE_PRIORITIES.STANDARD, name: 'Standard' },
];

interface FormState {
  stageId: number;
  csrId: number;
  categoryId: number;
  priorityId: number;
  dueDate: string;
}

export default function TicketDetailPanel({
  item,
  itemType,
  stages,
  employees,
  isOpen,
  onClose,
  onStageChange,
  onAssigneeChange,
  onTriageAction,
  onTicketUpdated,
}: TicketDetailPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const isTicket = itemType === 'ticket';
  const ticket = isTicket ? (item as ServiceTicketItem) : null;
  const triageItem = !isTicket ? (item as TriageItem) : null;

  // Initialize form state from ticket
  const initialFormState = useMemo((): FormState => ({
    stageId: ticket?.stageId || PIPELINE_STAGES.POLICY_SERVICE_NEW,
    csrId: ticket?.csrId || 0,
    categoryId: ticket?.categoryId || 0,
    priorityId: ticket?.priorityId || 0,
    dueDate: ticket?.dueDate || '',
  }), [ticket?.stageId, ticket?.csrId, ticket?.categoryId, ticket?.priorityId, ticket?.dueDate]);

  const [formState, setFormState] = useState<FormState>(initialFormState);

  // Reset form when ticket changes
  useEffect(() => {
    setFormState(initialFormState);
  }, [initialFormState]);

  // Check if form has changes
  const isDirty = useMemo(() => {
    if (!ticket) return false;
    return (
      formState.stageId !== (ticket.stageId || PIPELINE_STAGES.POLICY_SERVICE_NEW) ||
      formState.csrId !== (ticket.csrId || 0) ||
      formState.categoryId !== (ticket.categoryId || 0) ||
      formState.priorityId !== (ticket.priorityId || 0) ||
      formState.dueDate !== (ticket.dueDate || '')
    );
  }, [formState, ticket]);

  // Format age
  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    const days = Math.floor(minutes / 1440);
    return `${days}d ago`;
  };

  // Handle close with dirty check
  const handleClose = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  // Handle save and sync
  const handleSaveAndSync = async () => {
    if (!ticket || !isDirty) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/service-tickets/${ticket.azTicketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId: formState.stageId,
          csrId: formState.csrId || undefined,
          categoryId: formState.categoryId || undefined,
          priorityId: formState.priorityId || undefined,
          dueDate: formState.dueDate || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Saved & synced to AgencyZoom');
        onTicketUpdated?.();
        onClose();
      } else {
        toast.error(data.error || 'Failed to save changes');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50',
          'flex flex-col',
          'transform transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isTicket ? 'Ticket Details' : 'Triage Item'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isTicket && ticket ? (
            <>
              {/* Ticket Header */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                  {ticket.subject}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Ticket #{ticket.azTicketId} · {formatAge(ticket.ageMinutes)}
                </p>
              </div>

              {/* Customer Info */}
              {(ticket.customerName || ticket.customerPhone) && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Customer</p>
                  {ticket.customerName && (
                    <p className="font-semibold text-gray-900 dark:text-white">{ticket.customerName}</p>
                  )}
                  {ticket.customerPhone && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                      {formatPhoneNumber(ticket.customerPhone)}
                    </p>
                  )}
                </div>
              )}

              {/* Description */}
              {ticket.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description</p>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg max-h-48 overflow-y-auto">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                {/* Stage */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Stage
                  </label>
                  <select
                    value={formState.stageId}
                    onChange={(e) => setFormState(s => ({ ...s, stageId: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {SERVICE_STAGES.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Assigned To
                  </label>
                  <select
                    value={formState.csrId}
                    onChange={(e) => setFormState(s => ({ ...s, csrId: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={0}>Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category & Priority Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Category
                    </label>
                    <select
                      value={formState.categoryId}
                      onChange={(e) => setFormState(s => ({ ...s, categoryId: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Priority
                    </label>
                    <select
                      value={formState.priorityId}
                      onChange={(e) => setFormState(s => ({ ...s, priorityId: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      {PRIORITY_OPTIONS.map((pri) => (
                        <option key={pri.id} value={pri.id}>
                          {pri.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(e) => setFormState(s => ({ ...s, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </>
          ) : triageItem ? (
            <>
              {/* Triage Item Details */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">
                    {triageItem.itemType === 'wrapup' ? '📞' : '💬'}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {triageItem.contactName || formatPhoneNumber(triageItem.contactPhone) || 'Unknown'}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {triageItem.itemType === 'wrapup' ? 'Call' : 'Message'} · {formatAge(triageItem.ageMinutes)}
                </p>
              </div>

              {/* Contact Info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Contact</p>
                {triageItem.contactName && (
                  <p className="font-semibold text-gray-900 dark:text-white">{triageItem.contactName}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                  {formatPhoneNumber(triageItem.contactPhone)}
                </p>
                {triageItem.contactEmail && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{triageItem.contactEmail}</p>
                )}
              </div>

              {/* Match Status */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Match Status</p>
                <span
                  className={cn(
                    'inline-block px-2 py-1 rounded-full text-sm font-medium',
                    triageItem.matchStatus === 'matched' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    triageItem.matchStatus === 'needs_review' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    triageItem.matchStatus === 'unmatched' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                    triageItem.matchStatus === 'after_hours' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  )}
                >
                  {triageItem.matchStatus.replace('_', ' ')}
                </span>
              </div>

              {/* Summary */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm">
                  {triageItem.summary || 'No summary available'}
                </p>
              </div>

              {/* Request Type */}
              {triageItem.requestType && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Request Type</p>
                  <p className="text-gray-700 dark:text-gray-300">{triageItem.requestType}</p>
                </div>
              )}

              {/* Handled By */}
              {triageItem.handledByAgent && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Handled By</p>
                  <p className="text-gray-700 dark:text-gray-300">{triageItem.handledByAgent.name}</p>
                </div>
              )}

              {/* Quick Actions */}
              {triageItem.matchStatus === 'matched' && onTriageAction && (
                <div className="flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Quick Actions</p>
                  <button
                    onClick={() => {
                      onTriageAction(triageItem, 'note');
                      onClose();
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Post Note to AgencyZoom
                  </button>
                  <button
                    onClick={() => {
                      onTriageAction(triageItem, 'ticket');
                      onClose();
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Create Service Request
                  </button>
                  <button
                    onClick={() => {
                      onTriageAction(triageItem, 'skip');
                      onClose();
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer - Fixed at bottom for tickets */}
        {isTicket && ticket && (
          <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-3">
            {/* Unsaved Changes Warning */}
            {isDirty && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-amber-700 dark:text-amber-300">You have unsaved changes</span>
              </div>
            )}

            {/* Save & Sync Button */}
            <button
              onClick={handleSaveAndSync}
              disabled={!isDirty || isSaving}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
                isDirty && !isSaving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Save & Sync to AgencyZoom
                </>
              )}
            </button>

            {/* Open in AgencyZoom Link */}
            <a
              href={`https://app.agencyzoom.com/service-requests/${ticket.azTicketId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span>Open in AgencyZoom</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Close Confirmation Dialog */}
      {showCloseConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowCloseConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm z-[70]">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Unsaved Changes
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You have unsaved changes. Are you sure you want to close without saving?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowCloseConfirm(false);
                  setFormState(initialFormState);
                  onClose();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
