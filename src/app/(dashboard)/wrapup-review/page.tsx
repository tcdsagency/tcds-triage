'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// CONSTANTS
// =============================================================================

// Placeholder customer for calls that cannot be matched - for E&O compliance
const NO_MATCH_CUSTOMER = {
  id: "22138921", // Update to match your AgencyZoom instance
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
  // Joined call data
  call?: {
    fromNumber: string;
    toNumber: string;
    startedAt: string;
    durationSeconds: number;
    transcription?: string; // Actual call transcript
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

// =============================================================================
// CONSTANTS
// =============================================================================

const MATCH_STATUS_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  matched: { label: 'Matched', color: 'bg-green-100 text-green-700', badge: '✓' },
  multiple_matches: { label: 'Needs Match', color: 'bg-yellow-100 text-yellow-700', badge: '?' },
  unmatched: { label: 'New Caller', color: 'bg-blue-100 text-blue-700', badge: '+' },
  unprocessed: { label: 'Processing', color: 'bg-gray-100 text-gray-500', badge: '...' },
};

const REQUEST_TYPE_EMOJI: Record<string, string> = {
  quote: '📋',
  claim: '⚠️',
  billing: '💳',
  service: '🔧',
  renewal: '🔄',
  cancel: '❌',
  inquiry: '❓',
};

// =============================================================================
// COMPONENTS
// =============================================================================

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
  const typeEmoji = REQUEST_TYPE_EMOJI[item.requestType?.toLowerCase() || ''] || '📞';
  const ageMinutes = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 60000);

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{typeEmoji}</span>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {item.customerName || item.customerPhone || 'Unknown Caller'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {item.direction} • {item.call?.durationSeconds ? `${Math.floor(item.call.durationSeconds / 60)}m ${item.call.durationSeconds % 60}s` : '—'}
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
      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
        {item.aiCleanedSummary || item.summary || 'No summary available'}
      </p>
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

function WrapupActionButtons({
  onComplete,
  loading,
  matchStatus,
  hasCustomerId,
  onUseNoMatch,
}: {
  onComplete: (action: 'note' | 'ticket' | 'lead' | 'skip') => void;
  loading: boolean;
  matchStatus: string;
  hasCustomerId: boolean;
  onUseNoMatch: () => void;
}) {
  const canPostNote = matchStatus === 'matched' || hasCustomerId;
  const canCreateTicket = matchStatus === 'matched' || hasCustomerId;
  const showNoMatchOption = matchStatus === 'unmatched' && !hasCustomerId;

  return (
    <div className="space-y-3">
      {/* No Customer Match option for unmatched calls */}
      {showNoMatchOption && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
            Can&apos;t find a matching customer? Use the placeholder for E&amp;O compliance:
          </p>
          <button
            onClick={onUseNoMatch}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors text-sm"
          >
            {loading ? '...' : `📋 Use "${NO_MATCH_CUSTOMER.name}"`}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onComplete('note')}
          disabled={loading || !canPostNote}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            canPostNote
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          )}
        >
          {loading ? '...' : '📝 Post Note'}
        </button>
        <button
          onClick={() => onComplete('ticket')}
          disabled={loading || !canCreateTicket}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            canCreateTicket
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          )}
        >
          {loading ? '...' : '🎫 Create Ticket'}
        </button>
        <button
          onClick={() => onComplete('lead')}
          disabled={loading}
          className="px-4 py-2 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          {loading ? '...' : '🎯 Create Lead'}
        </button>
        <button
          onClick={() => onComplete('skip')}
          disabled={loading}
          className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {loading ? '...' : 'Skip'}
        </button>
      </div>
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
  const [expandedTranscript, setExpandedTranscript] = useState(false);

  // Fetch wrapups queue
  const fetchWrapups = useCallback(async () => {
    try {
      const res = await fetch('/api/calls/wrapup?status=pending_review&limit=50');
      const data = await res.json();
      if (data.success && data.wrapups) {
        setWrapups(data.wrapups);
        // Auto-select first if none selected
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

    // Load match suggestions if needed
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
      // Set customer ID from AI extraction
      const azId = wrapup.aiExtraction?.agencyZoomCustomerId;
      if (azId) {
        setSelectedCustomerId(azId);
      }
    }
  };

  // Complete wrapup
  const handleComplete = async (action: 'note' | 'ticket' | 'lead' | 'skip') => {
    if (!selectedWrapup) return;

    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { action };

      if (selectedCustomerId) {
        body.customerId = selectedCustomerId;
      }

      if (action === 'note' && noteContent !== (selectedWrapup.aiCleanedSummary || selectedWrapup.summary)) {
        body.noteContent = noteContent;
      }

      if (action === 'ticket') {
        body.ticketDetails = {
          subject: `Follow-up: ${selectedWrapup.requestType || 'Call'} - ${selectedWrapup.customerName || 'Unknown'}`,
          description: noteContent,
        };
      }

      const res = await fetch(`/api/wrapups/${selectedWrapup.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        // Remove from list and select next
        const remaining = wrapups.filter((w) => w.id !== selectedWrapup.id);
        setWrapups(remaining);
        if (remaining.length > 0) {
          selectWrapup(remaining[0]);
        } else {
          setSelectedWrapup(null);
        }
      } else {
        alert(data.error || 'Failed to complete wrapup');
      }
    } catch (error) {
      console.error('Complete error:', error);
      alert('Failed to complete wrapup');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchWrapups();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchWrapups, 30000);
    return () => clearInterval(interval);
  }, [fetchWrapups]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading wrapups...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Review Call
              </h2>

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

                {/* Trestle Data (for unmatched) */}
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

              {/* Match Selector (for multiple matches) */}
              {selectedWrapup.matchStatus === 'multiple_matches' && (
                <div className="mb-4">
                  <CustomerMatchSelector
                    suggestions={matchSuggestions}
                    selectedId={selectedCustomerId}
                    onSelect={setSelectedCustomerId}
                  />
                </div>
              )}

              {/* AI Summary */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Summary (editable)
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

              {/* Transcript Toggle */}
              <button
                onClick={() => setExpandedTranscript(!expandedTranscript)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
              >
                {expandedTranscript ? '▼ Hide Transcript' : '▶ Show Transcript'}
              </button>

              {expandedTranscript && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
                    {selectedWrapup.call?.transcription || 'No transcript available'}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <WrapupActionButtons
                onComplete={handleComplete}
                loading={actionLoading}
                matchStatus={selectedWrapup.matchStatus}
                hasCustomerId={!!selectedCustomerId}
                onUseNoMatch={() => setSelectedCustomerId(NO_MATCH_CUSTOMER.id)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
