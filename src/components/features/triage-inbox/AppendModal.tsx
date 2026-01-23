'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Ticket {
  id: number;
  subject: string;
  stageName: string | null;
  csrName: string | null;
  createdAt: string;
  daysOpen: number;
  priorityName: string | null;
  categoryName: string | null;
}

interface AppendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppend: (ticketId: number, notes?: string) => Promise<void>;
  loading: boolean;
  tickets: Ticket[];
  suggestedTicketId?: number;
}

export default function AppendModal({
  isOpen,
  onClose,
  onAppend,
  loading,
  tickets,
  suggestedTicketId,
}: AppendModalProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Auto-select suggested ticket when modal opens
  useEffect(() => {
    if (isOpen && suggestedTicketId) {
      setSelectedTicketId(suggestedTicketId);
    } else if (isOpen && tickets.length > 0 && !selectedTicketId) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [isOpen, suggestedTicketId, tickets, selectedTicketId]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAppend = async () => {
    if (selectedTicketId) {
      await onAppend(selectedTicketId, notes || undefined);
    }
  };

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-none">
          <h3 className="text-lg font-semibold">Append to Ticket</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {tickets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No open tickets found for this customer.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create a new ticket instead.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Select a ticket to append this call summary to:
              </p>

              {/* Ticket list */}
              <div className="space-y-2 mb-4">
                {tickets.map((ticket) => {
                  const isSuggested = ticket.id === suggestedTicketId;
                  const isSelected = ticket.id === selectedTicketId;

                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">
                              #{ticket.id}
                            </span>
                            {isSuggested && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                                Suggested
                              </span>
                            )}
                          </div>
                          <div className="font-medium truncate">
                            {ticket.subject}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {ticket.csrName && (
                              <span>{ticket.csrName}</span>
                            )}
                            {ticket.stageName && (
                              <span className="px-1.5 py-0.5 bg-muted rounded">
                                {ticket.stageName}
                              </span>
                            )}
                            <span>{ticket.daysOpen}d ago</span>
                          </div>
                        </div>

                        {/* Radio indicator */}
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-none mt-1',
                          isSelected
                            ? 'border-primary'
                            : 'border-muted-foreground'
                        )}>
                          {isSelected && (
                            <div className="w-3 h-3 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Notes input */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Additional Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional context..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border flex-none">
          <div className="text-sm text-muted-foreground">
            {selectedTicket && (
              <span>
                Appending to: <strong>#{selectedTicket.id}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAppend}
              disabled={!selectedTicketId || loading}
              className={cn(
                'px-4 py-2 bg-blue-600 text-white rounded-lg transition-colors',
                selectedTicketId && !loading
                  ? 'hover:bg-blue-700'
                  : 'opacity-50 cursor-not-allowed'
              )}
            >
              {loading ? 'Appending...' : 'Append to Ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
