'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PendingItem } from './PendingItemCard';

// Agent options for service request assignment
const AGENT_OPTIONS = [
  { id: 94007, name: 'Lee Tidwell' },
  { id: 94004, name: 'Todd Conn' },
  { id: 159477, name: 'Stephanie Goodman' },
  { id: 94008, name: 'Angie Sousa' },
  { id: 94006, name: 'Blair Lee' },
  { id: 94005, name: 'Montrice Lemaster' },
  { id: 132766, name: 'Paulo Gacula' },
];

export interface TicketDetails {
  subject?: string;
  assigneeAgentId?: number;
}

interface ReviewModalProps {
  item: PendingItem;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'note' | 'ticket' | 'void', noteContent?: string, ticketDetails?: TicketDetails) => void;
  isLoading?: boolean;
}

export default function ReviewModal({
  item,
  isOpen,
  onClose,
  onAction,
  isLoading = false,
}: ReviewModalProps) {
  const [noteContent, setNoteContent] = useState(item.summary || '');
  const [ticketSubject, setTicketSubject] = useState(
    `Follow-up: ${item.requestType || 'Call'} - ${item.contactName || 'Customer'}`
  );
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<'note' | 'ticket'>('note');

  if (!isOpen) return null;

  const handlePostNote = () => {
    onAction('note', noteContent);
  };

  const handleCreateTicket = () => {
    if (!selectedAgentId) {
      alert('Please select an agent to assign the service request to.');
      return;
    }
    onAction('ticket', noteContent, {
      subject: ticketSubject,
      assigneeAgentId: selectedAgentId as number,
    });
  };

  const handleVoid = () => {
    if (confirm('Are you sure you want to void this item? It will be removed from the queue without any action.')) {
      onAction('void');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Review & Post
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {item.contactName || item.contactPhone} - {item.type === 'wrapup' ? 'Call' : 'Message'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          <button
            onClick={() => setActiveTab('note')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'note'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            Post Note
          </button>
          <button
            onClick={() => setActiveTab('ticket')}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'ticket'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            Create Service Request
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Original Summary (Read-only) */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Original Summary
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {item.summary || 'No summary available'}
            </p>
          </div>

          {/* Editable Note Content */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {activeTab === 'note' ? 'Note Content' : 'Service Request Description'}
              <span className="text-gray-400 font-normal ml-1">(edit before posting)</span>
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={6}
              className={cn(
                'w-full px-3 py-2 rounded-lg border transition-colors resize-none',
                'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                'border-gray-300 dark:border-gray-600',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
              placeholder="Edit the note content before posting..."
            />
          </div>

          {/* Ticket-specific fields */}
          {activeTab === 'ticket' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Service Request Subject
                </label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  )}
                  placeholder="Subject line for the service request..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign To <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value ? Number(e.target.value) : '')}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border transition-colors',
                    'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    !selectedAgentId && 'text-gray-400'
                  )}
                >
                  <option value="">Select an agent...</option>
                  {AGENT_OPTIONS.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Action Items Preview */}
          {item.actionItems.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                Action Items Detected
              </div>
              <ul className="space-y-1">
                {item.actionItems.map((action, i) => (
                  <li key={i} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcription Preview (if available) */}
          {item.transcription && (
            <details className="mb-4">
              <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                View Full Transcription
              </summary>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {item.transcription}
                </pre>
              </div>
            </details>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            {/* Left side - Void button */}
            <button
              onClick={handleVoid}
              disabled={isLoading}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20',
                'border border-red-300 dark:border-red-700',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              Delete / Void
            </button>

            {/* Right side - Main actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>

              {activeTab === 'note' ? (
                <button
                  onClick={handlePostNote}
                  disabled={isLoading || !noteContent.trim()}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-green-600 text-white hover:bg-green-700',
                    (isLoading || !noteContent.trim()) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isLoading ? 'Posting...' : 'Post Note to AgencyZoom'}
                </button>
              ) : (
                <button
                  onClick={handleCreateTicket}
                  disabled={isLoading || !noteContent.trim()}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-blue-600 text-white hover:bg-blue-700',
                    (isLoading || !noteContent.trim()) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isLoading ? 'Creating...' : 'Create Service Request'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
