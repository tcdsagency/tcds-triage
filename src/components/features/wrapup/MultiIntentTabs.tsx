'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Intent data structure
export interface IntentData {
  id: string;
  intentNumber: number;
  summary: string;
  requestType: string;
  categoryId: number | null;
  priorityId: number | null;
  description: string;
  transcriptExcerpt: string;
  confidence: number;
  ticketCreated: boolean;
  azTicketId?: number | null;
  // Selection for batch creation
  selected?: boolean;
}

interface MultiIntentTabsProps {
  intents: IntentData[];
  categories: Array<{ id: number; name: string }>;
  priorities: Array<{ id: number; name: string }>;
  onIntentUpdate: (intentId: string, updates: Partial<IntentData>) => void;
  onSelectionChange: (intentId: string, selected: boolean) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * MultiIntentTabs
 * ===============
 * Tab interface for viewing and editing multiple intents detected in a call.
 * Allows agents to review, edit, and select intents for batch ticket creation.
 */
export default function MultiIntentTabs({
  intents,
  categories,
  priorities,
  onIntentUpdate,
  onSelectionChange,
  className,
  disabled = false,
}: MultiIntentTabsProps) {
  const [activeTab, setActiveTab] = useState(intents[0]?.id || '');

  // Update active tab if intents change
  useEffect(() => {
    if (intents.length > 0 && !intents.find((i) => i.id === activeTab)) {
      setActiveTab(intents[0].id);
    }
  }, [intents, activeTab]);

  const activeIntent = intents.find((i) => i.id === activeTab);

  if (intents.length === 0) {
    return null;
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Tab headers */}
      <div className="flex border-b bg-gray-50 dark:bg-gray-800/50">
        {intents.map((intent, index) => {
          const isActive = intent.id === activeTab;
          const hasTicket = intent.ticketCreated;

          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => setActiveTab(intent.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                hasTicket && 'text-green-600 dark:text-green-400'
              )}
            >
              {/* Intent number */}
              <span
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs',
                  isActive
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                  hasTicket && 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                )}
              >
                {hasTicket ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>

              {/* Request type label */}
              <span className="max-w-[120px] truncate">
                {intent.requestType || `Request ${index + 1}`}
              </span>

              {/* Confidence indicator */}
              {intent.confidence >= 0.9 && (
                <span className="w-2 h-2 rounded-full bg-green-400" title="High confidence" />
              )}
              {intent.confidence >= 0.7 && intent.confidence < 0.9 && (
                <span className="w-2 h-2 rounded-full bg-yellow-400" title="Medium confidence" />
              )}
              {intent.confidence < 0.7 && (
                <span className="w-2 h-2 rounded-full bg-red-400" title="Low confidence" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeIntent && (
        <div className="p-4 space-y-4">
          {/* Selection checkbox */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activeIntent.selected || false}
                onChange={(e) => onSelectionChange(activeIntent.id, e.target.checked)}
                disabled={disabled || activeIntent.ticketCreated}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {activeIntent.ticketCreated
                  ? 'Ticket created'
                  : 'Include in batch ticket creation'}
              </span>
            </label>

            {activeIntent.ticketCreated && activeIntent.azTicketId && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Ticket #{activeIntent.azTicketId}
              </span>
            )}
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Summary
            </label>
            <textarea
              value={activeIntent.summary}
              onChange={(e) => onIntentUpdate(activeIntent.id, { summary: e.target.value })}
              disabled={disabled || activeIntent.ticketCreated}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
              placeholder="Brief summary of this request..."
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={activeIntent.categoryId || ''}
                onChange={(e) =>
                  onIntentUpdate(activeIntent.id, {
                    categoryId: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                disabled={disabled || activeIntent.ticketCreated}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={activeIntent.priorityId || ''}
                onChange={(e) =>
                  onIntentUpdate(activeIntent.id, {
                    priorityId: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                disabled={disabled || activeIntent.ticketCreated}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select priority...</option>
                {priorities.map((pri) => (
                  <option key={pri.id} value={pri.id}>
                    {pri.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={activeIntent.description}
              onChange={(e) => onIntentUpdate(activeIntent.id, { description: e.target.value })}
              disabled={disabled || activeIntent.ticketCreated}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:disabled:bg-gray-800"
              placeholder="Detailed description for the service ticket..."
            />
          </div>

          {/* Transcript excerpt */}
          {activeIntent.transcriptExcerpt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relevant Transcript
              </label>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-400 italic">
                "{activeIntent.transcriptExcerpt}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
