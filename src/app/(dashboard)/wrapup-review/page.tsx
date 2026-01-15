'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DeleteWrapupModal, CreateTicketModal, CreateLeadModal } from '@/components/features/wrapup';
import type { WrapupDeleteReason, WrapupTicketType, WrapupLeadType } from '@/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const NO_MATCH_CUSTOMER = {
  id: "22138921",
  name: "No Customer Match",
  type: "placeholder",
};

// =============================================================================
// TYPES
// =============================================================================

interface WrapupItem {
  id: string;
  callId: string;
  direction: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  requestType: string | null;
  summary: string | null;
  aiCleanedSummary: string | null;
  agentExtension: string | null;
  agentName: string | null;
  aiExtraction: {
    actionItems?: string[];
    extractedData?: Record<string, string>;
    sentiment?: string;
    serviceRequestType?: string;
    serviceRequestTypeId?: number;
    agencyZoomCustomerId?: string;
    agencyZoomLeadId?: string;
    matchType?: 'customer' | 'lead' | 'none';
  } | null;
  matchStatus: string;
  trestleData: {
    person?: { name?: string; firstName?: string; lastName?: string };
    address?: { street?: string; city?: string; state?: string; zip?: string };
    emails?: string[];
  } | null;
  createdAt: string;
  call?: {
    fromNumber: string;
    toNumber: string;
    startedAt: string;
    durationSeconds: number;
    transcription?: string;
    agentId?: string;
  };
  agent?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    extension?: string;
  };
}

interface MatchSuggestion {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  confidence: string;
  isSelected: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
  action?: string;
  wrapupId?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MATCH_STATUS_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  matched: { label: 'Matched', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', badge: '' },
  multiple_matches: { label: 'Select Match', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', badge: '?' },
  unmatched: { label: '+ New Caller', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', badge: '+' },
  unprocessed: { label: 'Processing', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', badge: '...' },
};

// =============================================================================
// COMPONENTS
// =============================================================================

function DirectionBadge({ direction }: { direction: string }) {
  const isInbound = direction?.toLowerCase() === 'inbound';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        isInbound
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      )}
    >
      {isInbound ? (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          INCOMING
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          OUTGOING
        </>
      )}
    </span>
  );
}

function AgentAvatar({ agent, size = 'sm' }: { agent?: WrapupItem['agent']; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  const initials = agent
    ? `${agent.firstName?.[0] || ''}${agent.lastName?.[0] || ''}`
    : '??';
  const name = agent
    ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim()
    : 'Unknown';

  return (
    <div className="flex items-center gap-2" title={`Handled by ${name}`}>
      {agent?.avatarUrl ? (
        <img
          src={agent.avatarUrl}
          alt={name}
          className={cn(sizeClasses, 'rounded-full object-cover')}
        />
      ) : (
        <div
          className={cn(
            sizeClasses,
            'rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-bold'
          )}
        >
          {initials}
        </div>
      )}
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Handled by: <span className="font-medium text-gray-900 dark:text-white">{name}</span>
      </span>
    </div>
  );
}

function WrapupCard({
  item,
  isSelected,
  onClick,
}: {
  item: WrapupItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const matchConfig = MATCH_STATUS_CONFIG[item.matchStatus] || MATCH_STATUS_CONFIG.unprocessed;
  const ageMinutes = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 60000);

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <DirectionBadge direction={item.direction} />
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {item.customerName || item.customerPhone || 'Unknown Caller'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {item.call?.durationSeconds ? `${Math.floor(item.call.durationSeconds / 60)}m ${item.call.durationSeconds % 60}s` : '—'}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', matchConfig.color)}>
            {matchConfig.badge} {matchConfig.label}
          </span>
          <span className="text-xs text-gray-400">
            {ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ago`}
          </span>
        </div>
      </div>

      {/* Agent Info */}
      {item.agent && (
        <div className="mb-2">
          <AgentAvatar agent={item.agent} size="sm" />
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
        {item.aiCleanedSummary || item.summary || 'No summary available'}
      </p>

      {/* Action Items Badge */}
      {item.aiExtraction?.actionItems && item.aiExtraction.actionItems.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
          <span>📝</span>
          <span>{item.aiExtraction.actionItems.length} action item(s)</span>
        </div>
      )}
    </div>
  );
}

function CustomerMatchSelector({
  suggestions,
  selectedId,
  onSelect,
}: {
  suggestions: MatchSuggestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Select Customer Match:
      </h4>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.contactId)}
            className={cn(
              'p-3 rounded-lg border cursor-pointer transition-all',
              selectedId === s.contactId
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.contactName}</div>
                <div className="text-sm text-gray-500">
                  {s.contactPhone && <span>{s.contactPhone}</span>}
                  {s.contactEmail && <span> • {s.contactEmail}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {Math.round(parseFloat(s.confidence) * 100)}% match
                </span>
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border-2',
                    selectedId === s.contactId
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  )}
                >
                  {selectedId === s.contactId && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoreActionsDropdown({
  onDelete,
  onSkip,
  disabled,
}: {
  onDelete: () => void;
  onSkip: () => void;
  disabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-3 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        title="More actions"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-20">
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onSkip();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="mr-2">⏭️</span>
                Skip (No action needed)
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onDelete();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <span className="mr-2">🗑️</span>
                Delete this wrapup
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        toast.type === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-white/80 hover:text-white"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function WrapupReviewPage() {
  const [wrapups, setWrapups] = useState<WrapupItem[]>([]);
  const [selectedWrapup, setSelectedWrapup] = useState<WrapupItem | null>(null);
  const [matchSuggestions, setMatchSuggestions] = useState<MatchSuggestion[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedTranscript, setExpandedTranscript] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch wrapups queue
  const fetchWrapups = useCallback(async () => {
    try {
      const res = await fetch('/api/calls/wrapup?status=pending_review&limit=50');
      const data = await res.json();
      if (data.success && data.wrapups) {
        setWrapups(data.wrapups);
        if (!selectedWrapup && data.wrapups.length > 0) {
          selectWrapup(data.wrapups[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch wrapups:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedWrapup]);

  // Select a wrapup and load its details
  const selectWrapup = async (wrapup: WrapupItem) => {
    setSelectedWrapup(wrapup);
    setNoteContent(wrapup.aiCleanedSummary || wrapup.summary || '');
    setSelectedCustomerId(null);
    setMatchSuggestions([]);

    if (wrapup.matchStatus === 'multiple_matches') {
      try {
        const res = await fetch(`/api/wrapups/${wrapup.id}/complete`);
        const data = await res.json();
        if (data.success && data.matchSuggestions) {
          setMatchSuggestions(data.matchSuggestions);
        }
      } catch (error) {
        console.error('Failed to fetch match suggestions:', error);
      }
    } else if (wrapup.matchStatus === 'matched') {
      const azId = wrapup.aiExtraction?.agencyZoomCustomerId;
      if (azId) {
        setSelectedCustomerId(azId);
      }
    }
  };

  // Handle post note action
  const handlePostNote = async () => {
    if (!selectedWrapup) return;

    setActionLoading(true);
    try {
      const body: Record<string, unknown> = {
        action: 'note',
        customerId: selectedCustomerId,
        editedSummary: noteContent !== (selectedWrapup.aiCleanedSummary || selectedWrapup.summary)
          ? noteContent
          : undefined,
      };

      const res = await fetch(`/api/wrapups/${selectedWrapup.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', 'Note posted to AgencyZoom');
        removeWrapupAndSelectNext();
      } else {
        addToast('error', data.error || 'Failed to post note');
      }
    } catch (error) {
      console.error('Post note error:', error);
      addToast('error', 'Failed to post note');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle create ticket
  const handleCreateTicket = async (ticketType: WrapupTicketType, assignedToId: string, summary?: string) => {
    if (!selectedWrapup) return;

    setActionLoading(true);
    try {
      const body = {
        action: 'ticket',
        customerId: selectedCustomerId,
        editedSummary: summary || noteContent,
        ticketDetails: {
          subject: `Follow-up: ${selectedWrapup.requestType || 'Call'} - ${selectedWrapup.customerName || 'Unknown'}`,
          description: summary || noteContent,
          ticketType,
          assignedToId,
        },
      };

      const res = await fetch(`/api/wrapups/${selectedWrapup.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', 'Service ticket created');
        setShowTicketModal(false);
        removeWrapupAndSelectNext();
      } else {
        addToast('error', data.error || 'Failed to create ticket');
      }
    } catch (error) {
      console.error('Create ticket error:', error);
      addToast('error', 'Failed to create ticket');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle create lead
  const handleCreateLead = async (leadType: WrapupLeadType, assignedToId: string, summary?: string) => {
    if (!selectedWrapup) return;

    setActionLoading(true);
    try {
      const body = {
        action: 'lead',
        editedSummary: summary || noteContent,
        leadDetails: {
          firstName: selectedWrapup.customerName?.split(' ')[0] || 'Unknown',
          lastName: selectedWrapup.customerName?.split(' ').slice(1).join(' ') || 'Caller',
          phone: selectedWrapup.customerPhone,
          email: selectedWrapup.customerEmail,
          leadType,
          assignedToId,
        },
      };

      const res = await fetch(`/api/wrapups/${selectedWrapup.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', 'Lead created in AgencyZoom');
        setShowLeadModal(false);
        removeWrapupAndSelectNext();
      } else {
        addToast('error', data.error || 'Failed to create lead');
      }
    } catch (error) {
      console.error('Create lead error:', error);
      addToast('error', 'Failed to create lead');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (reason: WrapupDeleteReason, notes?: string) => {
    if (!selectedWrapup) return;

    setActionLoading(true);
    try {
      const body = {
        action: 'delete',
        deleteReason: reason,
        deleteNotes: notes,
      };

      const res = await fetch(`/api/wrapups/${selectedWrapup.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', 'Wrapup deleted');
        setShowDeleteModal(false);
        removeWrapupAndSelectNext();
      } else {
        addToast('error', data.error || 'Failed to delete wrapup');
      }
    } catch (error) {
      console.error('Delete error:', error);
      addToast('error', 'Failed to delete wrapup');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle skip
  const handleSkip = async () => {
    if (!selectedWrapup) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/wrapups/${selectedWrapup.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', 'Wrapup skipped');
        removeWrapupAndSelectNext();
      } else {
        addToast('error', data.error || 'Failed to skip wrapup');
      }
    } catch (error) {
      console.error('Skip error:', error);
      addToast('error', 'Failed to skip wrapup');
    } finally {
      setActionLoading(false);
    }
  };

  // Remove current wrapup and select next
  const removeWrapupAndSelectNext = () => {
    const remaining = wrapups.filter((w) => w.id !== selectedWrapup?.id);
    setWrapups(remaining);
    if (remaining.length > 0) {
      selectWrapup(remaining[0]);
    } else {
      setSelectedWrapup(null);
    }
  };

  useEffect(() => {
    fetchWrapups();
    const interval = setInterval(fetchWrapups, 30000);
    return () => clearInterval(interval);
  }, [fetchWrapups]);

  const canPostNote = selectedWrapup?.matchStatus === 'matched' || !!selectedCustomerId;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading wrapups...</div>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pending Review
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {wrapups.length} call{wrapups.length !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <button
          onClick={fetchWrapups}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {wrapups.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            All caught up!
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            No calls pending review. Great work!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Queue List */}
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
            {wrapups.map((wrapup) => (
              <WrapupCard
                key={wrapup.id}
                item={wrapup}
                isSelected={selectedWrapup?.id === wrapup.id}
                onClick={() => selectWrapup(wrapup)}
              />
            ))}
          </div>

          {/* Review Panel */}
          {selectedWrapup && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 sticky top-6 max-h-[calc(100vh-150px)] overflow-y-auto">
              {/* Header with Direction */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Review Call
                  </h2>
                  <DirectionBadge direction={selectedWrapup.direction} />
                </div>
                {selectedWrapup.agent && (
                  <AgentAvatar agent={selectedWrapup.agent} size="md" />
                )}
              </div>

              {/* Call Info */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Caller:</span>{' '}
                    <span className="font-medium">
                      {selectedWrapup.customerName || selectedWrapup.customerPhone || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>{' '}
                    <span className="font-medium">{selectedWrapup.requestType || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>{' '}
                    <span className="font-medium">{selectedWrapup.customerPhone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>{' '}
                    <span className="font-medium">{selectedWrapup.customerEmail || '—'}</span>
                  </div>
                </div>

                {selectedWrapup.matchStatus === 'unmatched' && selectedWrapup.trestleData?.person && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      📍 Identity hint from Trestle: {selectedWrapup.trestleData.person.name}
                      {selectedWrapup.trestleData.address &&
                        ` - ${selectedWrapup.trestleData.address.city}, ${selectedWrapup.trestleData.address.state}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Match Selector */}
              {selectedWrapup.matchStatus === 'multiple_matches' && (
                <div className="mb-4">
                  <CustomerMatchSelector
                    suggestions={matchSuggestions}
                    selectedId={selectedCustomerId}
                    onSelect={setSelectedCustomerId}
                  />
                </div>
              )}

              {/* Editable Summary */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Summary (editable before posting)
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Action Items */}
              {selectedWrapup.aiExtraction?.actionItems && selectedWrapup.aiExtraction.actionItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Action Items
                  </h4>
                  <ul className="space-y-1">
                    {selectedWrapup.aiExtraction.actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500">•</span>
                        <span className="text-gray-600 dark:text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Always Visible Transcript */}
              <div className="mb-4">
                <button
                  onClick={() => setExpandedTranscript(!expandedTranscript)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <svg
                    className={cn('w-4 h-4 transition-transform', expandedTranscript && 'rotate-90')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Call Transcript
                </button>
                {expandedTranscript && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg max-h-48 overflow-y-auto">
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
                      {selectedWrapup.call?.transcription || 'No transcript available'}
                    </p>
                  </div>
                )}
              </div>

              {/* No Customer Match Option */}
              {selectedWrapup.matchStatus === 'unmatched' && !selectedCustomerId && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                    Can&apos;t find a matching customer? Use the placeholder for E&amp;O compliance:
                  </p>
                  <button
                    onClick={() => setSelectedCustomerId(NO_MATCH_CUSTOMER.id)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-lg font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors text-sm"
                  >
                    📋 Use &quot;{NO_MATCH_CUSTOMER.name}&quot;
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePostNote}
                  disabled={actionLoading || !canPostNote}
                  title={!canPostNote ? 'Select a customer match first' : 'Post a note to AgencyZoom'}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    canPostNote
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {actionLoading ? '...' : '📝 Post Note'}
                </button>
                <button
                  onClick={() => setShowTicketModal(true)}
                  disabled={actionLoading || !canPostNote}
                  title={!canPostNote ? 'Select a customer match first' : 'Create a service ticket'}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    canPostNote
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {actionLoading ? '...' : '🎫 Create Ticket'}
                </button>
                <button
                  onClick={() => setShowLeadModal(true)}
                  disabled={actionLoading}
                  title="Create a new lead in AgencyZoom"
                  className="px-4 py-2 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                >
                  {actionLoading ? '...' : '🎯 Create Lead'}
                </button>
                <MoreActionsDropdown
                  onDelete={() => setShowDeleteModal(true)}
                  onSkip={handleSkip}
                  disabled={actionLoading}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <DeleteWrapupModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        isLoading={actionLoading}
        callerName={selectedWrapup?.customerName || selectedWrapup?.customerPhone || 'this wrapup'}
      />

      <CreateTicketModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onConfirm={handleCreateTicket}
        isLoading={actionLoading}
        initialSummary={noteContent}
        callerName={selectedWrapup?.customerName || 'Unknown'}
      />

      <CreateLeadModal
        isOpen={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        onConfirm={handleCreateLead}
        isLoading={actionLoading}
        initialSummary={noteContent}
        callerName={selectedWrapup?.customerName || 'Unknown'}
        callerPhone={selectedWrapup?.customerPhone || undefined}
      />
    </div>
  );
}
