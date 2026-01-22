'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ServiceTicketItem, TriageItem, Employee } from '@/app/api/service-pipeline/route';
import { formatPhoneNumber } from '@/lib/utils';

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
}

// Stage IDs for the pipeline
const SERVICE_STAGES = [
  { id: 111160, name: 'New' },
  { id: 111161, name: 'In Progress' },
  { id: 111162, name: 'Waiting on Info' },
];

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
}: TicketDetailPanelProps) {
  const [isChangingStage, setIsChangingStage] = useState(false);
  const [isChangingAssignee, setIsChangingAssignee] = useState(false);

  if (!isOpen || !item) return null;

  const isTicket = itemType === 'ticket';
  const ticket = isTicket ? (item as ServiceTicketItem) : null;
  const triageItem = !isTicket ? (item as TriageItem) : null;

  // Format age
  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`;
    const days = Math.floor(minutes / 1440);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  // Handle stage change
  const handleStageChange = async (newStageId: number) => {
    if (!ticket || !onStageChange) return;
    const stage = SERVICE_STAGES.find((s) => s.id === newStageId);
    if (!stage) return;

    setIsChangingStage(true);
    try {
      await onStageChange(ticket.id, newStageId, stage.name);
    } finally {
      setIsChangingStage(false);
    }
  };

  // Handle assignee change
  const handleAssigneeChange = async (csrId: number) => {
    if (!ticket || !onAssigneeChange) return;
    const employee = employees.find((e) => e.id === csrId);
    if (!employee) return;

    setIsChangingAssignee(true);
    try {
      await onAssigneeChange(ticket.id, csrId, employee.name);
    } finally {
      setIsChangingAssignee(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50',
          'transform transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isTicket ? 'Ticket Details' : 'Triage Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-60px)]">
          {isTicket && ticket ? (
            <>
              {/* Ticket Subject */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {ticket.subject}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Ticket #{ticket.azTicketId} · {formatAge(ticket.ageMinutes)}
                </p>
              </div>

              {/* Customer Info */}
              {(ticket.customerName || ticket.customerPhone) && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Customer</p>
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
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</p>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                </div>
              )}

              {/* Stage Selector */}
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Stage</p>
                <select
                  value={ticket.stageId || 111160}
                  onChange={(e) => handleStageChange(parseInt(e.target.value))}
                  disabled={isChangingStage}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                    'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    isChangingStage && 'opacity-50 cursor-wait'
                  )}
                >
                  {SERVICE_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee Selector */}
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Assigned To</p>
                <select
                  value={ticket.csrId || ''}
                  onChange={(e) => e.target.value && handleAssigneeChange(parseInt(e.target.value))}
                  disabled={isChangingAssignee}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                    'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    isChangingAssignee && 'opacity-50 cursor-wait'
                  )}
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Category</p>
                  <p className="text-gray-700 dark:text-gray-300">
                    {ticket.categoryName || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Priority</p>
                  <p className="text-gray-700 dark:text-gray-300">
                    {ticket.priorityName || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Due Date */}
              {ticket.dueDate && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Due Date</p>
                  <p className="text-gray-700 dark:text-gray-300">{ticket.dueDate}</p>
                </div>
              )}

              {/* AgencyZoom Link */}
              <a
                href={`https://app.agencyzoom.com/service-requests/${ticket.azTicketId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <span>Open in AgencyZoom</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </>
          ) : triageItem ? (
            <>
              {/* Triage Item Details */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">
                    {triageItem.itemType === 'wrapup' ? '📞' : '💬'}
                  </span>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {triageItem.contactName || formatPhoneNumber(triageItem.contactPhone) || 'Unknown'}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {triageItem.itemType === 'wrapup' ? 'Call' : 'Message'} · {formatAge(triageItem.ageMinutes)}
                </p>
              </div>

              {/* Contact Info */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Contact</p>
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
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Match Status</p>
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
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Summary</p>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {triageItem.summary || 'No summary available'}
                </p>
              </div>

              {/* Request Type */}
              {triageItem.requestType && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Request Type</p>
                  <p className="text-gray-700 dark:text-gray-300">{triageItem.requestType}</p>
                </div>
              )}

              {/* Handled By */}
              {triageItem.handledByAgent && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Handled By</p>
                  <p className="text-gray-700 dark:text-gray-300">{triageItem.handledByAgent.name}</p>
                </div>
              )}

              {/* Quick Actions */}
              {triageItem.matchStatus === 'matched' && onTriageAction && (
                <div className="flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Quick Actions</p>
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
      </div>
    </>
  );
}
