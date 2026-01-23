'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TriageQueueItem, CustomerContext } from '@/app/(dashboard)/triage-inbox/page';
import AIRecommendationCard from './AIRecommendationCard';
import DismissModal from './DismissModal';
import AppendModal from './AppendModal';

interface ItemDetailPanelProps {
  item: TriageQueueItem | null;
  customerContext: CustomerContext | null;
  recommendationLoading: boolean;
  onAppend: (ticketId: number, notes?: string) => Promise<void>;
  onDismiss: (reason: string) => Promise<void>;
  onCreate: () => void;
}

export default function ItemDetailPanel({
  item,
  customerContext,
  recommendationLoading,
  onAppend,
  onDismiss,
  onCreate,
}: ItemDetailPanelProps) {
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [showAppendModal, setShowAppendModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="font-medium">No item selected</p>
        <p className="text-sm text-muted-foreground">Select an item from the queue to view details</p>
      </div>
    );
  }

  const recommendation = item.aiTriageRecommendation;
  const hasOpenTickets = (customerContext?.openTickets?.length || 0) > 0;

  const handleAppend = async (ticketId: number, notes?: string) => {
    setActionLoading(true);
    try {
      await onAppend(ticketId, notes);
      setShowAppendModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (reason: string) => {
    setActionLoading(true);
    try {
      await onDismiss(reason);
      setShowDismissModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* AI Recommendation Card */}
      <AIRecommendationCard
        recommendation={recommendation}
        loading={recommendationLoading}
        openTickets={customerContext?.openTickets || []}
        onAppend={(ticketId) => handleAppend(ticketId)}
        onDismiss={() => setShowDismissModal(true)}
        onCreate={onCreate}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {item.customerName || 'Unknown Caller'}
          </h2>
          {item.customerPhone && (
            <p className="text-muted-foreground">
              {formatPhoneNumber(item.customerPhone)}
            </p>
          )}
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>{format(new Date(item.createdAt), 'MMM d, yyyy')}</div>
          <div>{format(new Date(item.createdAt), 'h:mm a')}</div>
        </div>
      </div>

      {/* Call Info */}
      <div className="flex items-center gap-4 text-sm">
        <span className={cn(
          'px-2 py-1 rounded',
          item.direction === 'Inbound'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        )}>
          {item.direction === 'Inbound' ? '↓ Inbound Call' : '↑ Outbound Call'}
        </span>
        {item.agentName && (
          <span className="text-muted-foreground">
            Agent: {item.agentName}
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="font-medium mb-2">Call Summary</h3>
        <p className="text-sm whitespace-pre-wrap">
          {item.summary || 'No summary available'}
        </p>
      </div>

      {/* Related Tickets from AI */}
      {recommendation?.relatedTickets && recommendation.relatedTickets.length > 0 && (
        <div>
          <h3 className="font-medium mb-3">Related Tickets</h3>
          <div className="space-y-2">
            {recommendation.relatedTickets.map((ticket) => (
              <button
                key={ticket.ticketId}
                onClick={() => setShowAppendModal(true)}
                className="w-full text-left p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">#{ticket.ticketId}</span>
                    <span className="text-sm font-medium">{ticket.subject}</span>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    ticket.similarity >= 0.8
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : ticket.similarity >= 0.6
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  )}>
                    {Math.round(ticket.similarity * 100)}% match
                  </span>
                </div>
                {ticket.csrName && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Assigned to: {ticket.csrName}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        {hasOpenTickets && (
          <button
            onClick={() => setShowAppendModal(true)}
            disabled={actionLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Append to Ticket
          </button>
        )}
        <button
          onClick={onCreate}
          disabled={actionLoading}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create New Ticket
        </button>
        <button
          onClick={() => setShowDismissModal(true)}
          disabled={actionLoading}
          className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* Modals */}
      <DismissModal
        isOpen={showDismissModal}
        onClose={() => setShowDismissModal(false)}
        onDismiss={handleDismiss}
        loading={actionLoading}
      />

      <AppendModal
        isOpen={showAppendModal}
        onClose={() => setShowAppendModal(false)}
        onAppend={handleAppend}
        loading={actionLoading}
        tickets={customerContext?.openTickets || []}
        suggestedTicketId={recommendation?.relatedTickets?.[0]?.ticketId}
      />
    </div>
  );
}

// Format phone number for display
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}
