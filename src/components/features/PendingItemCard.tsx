'use client';

import { useState, useRef, useEffect } from 'react';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { getAgencyZoomUrl } from '@/components/ui/agencyzoom-link';
import { LeadQualityBadgeCompact } from '@/components/features/LeadQualityBadge';
import { ServiceTicketBadgeCompact } from '@/components/features/ServiceTicketBadge';
import { toast } from 'sonner';

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2
                      bg-gray-900 text-white text-xs rounded-lg opacity-0
                      group-hover:opacity-100 transition-opacity whitespace-nowrap
                      pointer-events-none z-50 max-w-xs text-center">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1
                        border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

// =============================================================================
// TYPES
// =============================================================================

export interface PendingItem {
  id: string;
  type: 'wrapup' | 'message' | 'lead';

  // Display info
  direction: 'inbound' | 'outbound' | null;
  contactName: string | null;
  contactPhone: string;
  contactEmail: string | null;
  contactType: 'customer' | 'lead' | null;

  // Status/matching
  matchStatus: 'matched' | 'needs_review' | 'unmatched' | 'after_hours';
  matchReason: string | null;
  sentiment: 'positive' | 'neutral' | 'frustrated' | null;
  isAutoPosted: boolean;

  // Content
  summary: string;
  requestType: string | null;
  actionItems: string[];
  policies: string[];

  // Metadata
  handledBy: string | null;
  handledByAgent: {
    id: string;
    name: string;
    avatar: string | null;
    extension: string | null;
    initials: string;
  } | null;
  timestamp: string;
  ageMinutes: number;

  // Trestle enrichment
  trestleData: {
    name?: string;
    address?: string;
    email?: string;
    altPhones?: string[];
    // Lead quality scoring
    leadQuality?: {
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      activityScore: number;
      phoneValid?: boolean;
      phoneLineType?: string;
      isDisconnected?: boolean;
      isSpam?: boolean;
    };
  } | null;

  // Match suggestions
  matchSuggestions: {
    id: string;
    name: string;
    type: 'customer' | 'lead';
    phone?: string;
    confidence: number;
    reason: string;
  }[];

  // References
  callId?: string;
  transcription?: string;
  agencyzoomCustomerId?: string;
  agencyzoomLeadId?: string;

  // Message grouping (for SMS conversations)
  conversationThread?: {
    direction: string;
    body: string | null;
    timestamp: string;
    isAutoReply: boolean;
  }[];
  messageIds?: string[]; // All message IDs in this group

  // Linked service ticket (if one was created)
  linkedTicket?: {
    id: string;
    azTicketId: number;
    status: 'active' | 'completed' | 'removed';
    stageName: string | null;
    subject: string;
    csrName: string | null;
  } | null;
}

export interface PendingItemCardProps {
  item: PendingItem;
  isSelected?: boolean;
  isChecked?: boolean;
  isFocused?: boolean; // For J/K keyboard navigation
  onSelect?: () => void;
  onCheck?: (checked: boolean) => void;
  onQuickAction?: (action: 'note' | 'ticket' | 'acknowledge' | 'skip' | 'void' | 'ncm') => void;
  onReviewClick?: () => void;
  onFindMatch?: () => void;
  onReportIssue?: () => void;
  onDelete?: () => void;
  onEditSummary?: (newSummary: string) => void;
}

// =============================================================================
// STATUS-DRIVEN DESIGN SYSTEM
// =============================================================================

const STATUS_STYLES: Record<string, {
  label: string;
  description: string;
  cardBg: string;
  cardBorder: string;
  badgeBg: string;
  badgeText: string;
  icon: string;
  accentColor: string;
}> = {
  matched: {
    label: 'Matched',
    description: 'Ready to process',
    cardBg: 'bg-white dark:bg-gray-800',
    cardBorder: 'border-green-300 dark:border-green-700',
    badgeBg: 'bg-green-500',
    badgeText: 'text-white',
    icon: '✓',
    accentColor: 'text-green-600 dark:text-green-400',
  },
  needs_review: {
    label: 'Needs Review',
    description: 'Potential matches found',
    cardBg: 'bg-blue-50/50 dark:bg-blue-900/10',
    cardBorder: 'border-blue-300 dark:border-blue-700',
    badgeBg: 'bg-blue-500',
    badgeText: 'text-white',
    icon: '?',
    accentColor: 'text-blue-600 dark:text-blue-400',
  },
  unmatched: {
    label: 'No Match',
    description: 'Customer not found',
    cardBg: 'bg-amber-50/50 dark:bg-amber-900/10',
    cardBorder: 'border-amber-400 dark:border-amber-600',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white',
    icon: '!',
    accentColor: 'text-amber-600 dark:text-amber-400',
  },
  after_hours: {
    label: 'After Hours',
    description: 'Received outside business hours',
    cardBg: 'bg-purple-50/50 dark:bg-purple-900/10',
    cardBorder: 'border-purple-300 dark:border-purple-700',
    badgeBg: 'bg-purple-500',
    badgeText: 'text-white',
    icon: '🌙',
    accentColor: 'text-purple-600 dark:text-purple-400',
  },
};

const SENTIMENT_STYLES: Record<string, {
  icon: string;
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  positive: {
    icon: '😊',
    label: 'Positive',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-700',
  },
  neutral: {
    icon: '😐',
    label: 'Neutral',
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-600',
  },
  frustrated: {
    icon: '😤',
    label: 'Frustrated',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-700',
  },
};

const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  wrapup: { label: 'Call', icon: '📞' },
  message: { label: 'SMS', icon: '💬' },
  lead: { label: 'Lead', icon: '🎯' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function PendingItemCard({
  item,
  isSelected = false,
  isChecked = false,
  isFocused = false,
  onSelect,
  onCheck,
  onQuickAction,
  onReviewClick,
  onFindMatch,
  onReportIssue,
  onDelete,
  onEditSummary,
}: PendingItemCardProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState(item.summary || '');
  const [hasBeenEdited, setHasBeenEdited] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const summaryTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditingSummary && summaryTextareaRef.current) {
      summaryTextareaRef.current.focus();
      summaryTextareaRef.current.select();
    }
  }, [isEditingSummary]);

  const handleSaveSummary = async () => {
    // Skip if no changes
    if (editedSummary === item.summary) {
      setIsEditingSummary(false);
      return;
    }

    try {
      setSavingSummary(true);

      // Save to database via API
      const response = await fetch(`/api/pending-review/${item.id}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: editedSummary }),
      });

      const result = await response.json();

      if (result.success) {
        setHasBeenEdited(true);
        setIsEditingSummary(false);
        toast.success('Summary saved');

        // Also call parent handler if provided
        if (onEditSummary) {
          onEditSummary(editedSummary);
        }
      } else {
        throw new Error(result.error || 'Failed to save summary');
      }
    } catch (error: unknown) {
      console.error('Failed to save summary:', error);
      toast.error(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSavingSummary(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedSummary(item.summary || '');
    setIsEditingSummary(false);
  };

  const statusStyle = STATUS_STYLES[item.matchStatus] || STATUS_STYLES.unmatched;
  const sentimentStyle = item.sentiment ? SENTIMENT_STYLES[item.sentiment] : null;
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.wrapup;

  // For after-hours messages, prefer phone number over email-like contact names
  const isEmailLikeName = item.contactName && item.contactName.includes('@');
  const displayName = (item.matchStatus === 'after_hours' && isEmailLikeName && item.contactPhone)
    ? formatPhoneNumber(item.contactPhone)
    : (item.contactName || 'Unknown Caller');

  // Format age display
  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  // Check if this is a call with transcription
  const hasTranscription = item.type === 'wrapup' && item.transcription;

  // Determine primary action based on status
  const getPrimaryAction = () => {
    if (item.matchStatus === 'matched' || item.agencyzoomCustomerId || item.agencyzoomLeadId) {
      return {
        label: 'Review & Post',
        icon: '📝',
        onClick: onReviewClick,
        className: 'bg-green-600 hover:bg-green-700 text-white',
      };
    }
    if (item.matchStatus === 'unmatched' || item.matchStatus === 'needs_review' || item.matchStatus === 'after_hours') {
      return {
        label: 'Find Match',
        icon: '🔍',
        onClick: onFindMatch,
        className: 'bg-blue-600 hover:bg-blue-700 text-white',
      };
    }
    return null;
  };

  const primaryAction = getPrimaryAction();

  // Format transcript with speaker labels
  const formatTranscript = (text: string) => {
    // Simple heuristic: lines starting with "Agent:" or "Customer:" are speakers
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const isAgent = line.toLowerCase().startsWith('agent:') || line.toLowerCase().startsWith('rep:');
      const isCustomer = line.toLowerCase().startsWith('customer:') || line.toLowerCase().startsWith('caller:');

      if (isAgent) {
        return (
          <div key={i} className="mb-2">
            <span className="text-blue-600 dark:text-blue-400 font-medium text-xs uppercase">Agent</span>
            <p className="text-gray-700 dark:text-gray-300">{line.replace(/^(agent|rep):\s*/i, '')}</p>
          </div>
        );
      }
      if (isCustomer) {
        return (
          <div key={i} className="mb-2">
            <span className="text-purple-600 dark:text-purple-400 font-medium text-xs uppercase">Customer</span>
            <p className="text-gray-700 dark:text-gray-300">{line.replace(/^(customer|caller):\s*/i, '')}</p>
          </div>
        );
      }
      return line.trim() ? <p key={i} className="text-gray-600 dark:text-gray-400 mb-1">{line}</p> : null;
    });
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative rounded-xl border-2 cursor-pointer transition-all overflow-hidden',
        statusStyle.cardBg,
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
          : isFocused
            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg'
            : cn(statusStyle.cardBorder, 'hover:shadow-md')
      )}
    >
      {/* ===== STATUS HEADER BAR ===== */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2',
        statusStyle.badgeBg
      )}>
        <div className="flex items-center gap-2">
          {/* Checkbox */}
          {onCheck && (
            <div onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onCheck(e.target.checked)}
                className="w-4 h-4 rounded border-white/30 text-white bg-white/20 focus:ring-white/50"
              />
            </div>
          )}

          {/* Status Label */}
          <span className={cn('font-semibold text-sm', statusStyle.badgeText)}>
            {statusStyle.icon} {statusStyle.label}
          </span>

          {/* Frustrated sentiment alert */}
          {item.sentiment === 'frustrated' && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">
              ⚠️ FRUSTRATED
            </span>
          )}
        </div>

        {/* Time */}
        <span className={cn('text-xs font-medium', statusStyle.badgeText, 'opacity-90')}>
          {formatAge(item.ageMinutes)}
        </span>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="p-4 space-y-3">

        {/* Contact Info Row */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Name */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                {displayName}
              </h3>
              {item.contactType && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  item.contactType === 'customer'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                )}>
                  {item.contactType}
                </span>
              )}
            </div>

            {/* Metadata line */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              {item.contactPhone && (
                <span className="font-mono">{item.contactPhone}</span>
              )}
              {/* Lead Quality Badge */}
              {item.trestleData?.leadQuality && (
                <LeadQualityBadgeCompact data={item.trestleData.leadQuality} />
              )}
              <span className="flex items-center gap-1">
                {typeConfig.icon} {typeConfig.label}
                {item.direction && (
                  <span className="text-gray-400">
                    ({item.direction === 'inbound' ? '↓ in' : '↑ out'})
                  </span>
                )}
              </span>
              {/* Call ID for reference */}
              {item.callId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(item.callId || '');
                    // Simple feedback - could use toast but keeping it lightweight
                    const btn = e.currentTarget;
                    btn.textContent = '✓ Copied';
                    setTimeout(() => {
                      btn.textContent = `ID: ${item.callId?.slice(0, 8)}...`;
                    }, 1500);
                  }}
                  className="font-mono text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline cursor-pointer"
                  title={`Click to copy full ID: ${item.callId}`}
                >
                  ID: {item.callId.slice(0, 8)}...
                </button>
              )}
            </div>
          </div>

          {/* Right side badges */}
          <div className="flex items-center gap-2">
            {/* Agent Profile Badge - Prominent display */}
            {item.handledByAgent && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700">
                {/* Avatar or Initials */}
                {item.handledByAgent.avatar ? (
                  <img
                    src={item.handledByAgent.avatar}
                    alt={item.handledByAgent.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-400 dark:ring-blue-500"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold ring-2 ring-blue-400 dark:ring-blue-500">
                    {item.handledByAgent.initials}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                    {item.handledByAgent.name}
                  </span>
                  {item.handledByAgent.extension && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Ext. {item.handledByAgent.extension}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Sentiment badge (if not frustrated - that's in header) */}
            {sentimentStyle && item.sentiment !== 'frustrated' && (
              <span className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium border',
                sentimentStyle.bg,
                sentimentStyle.text,
                sentimentStyle.border
              )}>
                <span className="text-lg">{sentimentStyle.icon}</span>
                <span>{sentimentStyle.label}</span>
              </span>
            )}
          </div>
        </div>

        {/* ===== AI SUMMARY (Editable) ===== */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {item.type === 'message' ? 'Message' : 'AI Summary'}
              </span>
              {hasBeenEdited && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 font-medium">
                  Edited
                </span>
              )}
              {item.requestType && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {item.requestType}
                </span>
              )}
              {item.messageIds && item.messageIds.length > 1 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
                  {item.messageIds.length} messages
                </span>
              )}
            </div>
            {!isEditingSummary && onEditSummary && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingSummary(true);
                }}
                className="text-xs px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {isEditingSummary ? (
            <div onClick={(e) => e.stopPropagation()}>
              <textarea
                ref={summaryTextareaRef}
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={savingSummary}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSummary}
                  disabled={savingSummary}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {savingSummary ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {hasBeenEdited ? editedSummary : (item.summary || 'No summary available')}
            </p>
          )}
        </div>

        {/* ===== CONVERSATION THREAD (for SMS with multiple messages or auto-replies) ===== */}
        {item.type === 'message' && item.conversationThread && item.conversationThread.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowConversation(!showConversation);
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                💬 Full Conversation
                {item.conversationThread.some(m => m.isAutoReply) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300">
                    Auto-reply sent
                  </span>
                )}
              </span>
              <span className="text-gray-400">
                {showConversation ? '▲' : '▼'}
              </span>
            </button>

            {showConversation && (
              <div className="p-3 bg-white dark:bg-gray-900 max-h-64 overflow-y-auto space-y-2">
                {item.conversationThread.map((msg, i) => {
                  const isInbound = msg.direction === 'inbound';
                  const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <div
                      key={i}
                      className={cn(
                        'max-w-[85%] rounded-lg p-2',
                        isInbound
                          ? 'bg-gray-100 dark:bg-gray-800 mr-auto'
                          : msg.isAutoReply
                            ? 'bg-purple-100 dark:bg-purple-900/30 ml-auto border border-purple-200 dark:border-purple-700'
                            : 'bg-emerald-100 dark:bg-emerald-900/30 ml-auto'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'text-xs font-medium',
                          isInbound
                            ? 'text-gray-500 dark:text-gray-400'
                            : msg.isAutoReply
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        )}>
                          {isInbound ? '📥 Customer' : msg.isAutoReply ? '🤖 Auto-Reply' : '📤 Agent'}
                        </span>
                        <span className="text-xs text-gray-400">{time}</span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {msg.body || '(empty)'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== TRANSCRIPT (Collapsible) ===== */}
        {hasTranscription && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTranscript(!showTranscript);
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
                📝 Full Transcript
              </span>
              <span className="text-gray-400">
                {showTranscript ? '▲' : '▼'}
              </span>
            </button>

            {showTranscript && (
              <div className="p-4 bg-white dark:bg-gray-900 max-h-64 overflow-y-auto text-sm leading-relaxed">
                {formatTranscript(item.transcription || '')}
              </div>
            )}
          </div>
        )}

        {/* ===== CONTEXT BADGES ===== */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-posted indicator */}
          {item.isAutoPosted && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium">
              ✓ Auto-posted
            </span>
          )}

          {/* Action items count */}
          {item.actionItems.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
              📋 {item.actionItems.length} action{item.actionItems.length !== 1 ? 's' : ''}
            </span>
          )}

          {/* Policies */}
          {item.policies.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium">
              🔖 {item.policies.join(', ')}
            </span>
          )}

          {/* Linked Service Ticket */}
          {item.linkedTicket && (
            <ServiceTicketBadgeCompact
              ticket={{
                azTicketId: item.linkedTicket.azTicketId,
                status: item.linkedTicket.status,
                stageName: item.linkedTicket.stageName,
                subject: item.linkedTicket.subject,
              }}
            />
          )}
        </div>

        {/* ===== MATCH REASON (for unmatched/needs_review) ===== */}
        {item.matchReason && (item.matchStatus === 'unmatched' || item.matchStatus === 'needs_review') && (
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <span>ℹ️</span>
            <span>{item.matchReason}</span>
          </div>
        )}

        {/* ===== TRESTLE IDENTITY HINT (for unmatched) ===== */}
        {item.matchStatus === 'unmatched' && item.trestleData && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1 uppercase tracking-wide">
              📍 Identity Hint (Trestle)
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">
              {item.trestleData.name}
            </div>
            {item.trestleData.address && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {item.trestleData.address}
              </div>
            )}
          </div>
        )}

        {/* ===== MATCH SUGGESTIONS (for needs_review) ===== */}
        {item.matchStatus === 'needs_review' && item.matchSuggestions.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1 uppercase tracking-wide">
              🔍 {item.matchSuggestions.length} Potential Match{item.matchSuggestions.length !== 1 ? 'es' : ''}
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200">
              <span className="font-medium">{item.matchSuggestions[0].name}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">
                {Math.round(item.matchSuggestions[0].confidence * 100)}% • {item.matchSuggestions[0].reason}
              </span>
            </div>
          </div>
        )}

        {/* ===== ACTION BUTTONS ===== */}
        {onQuickAction && (
          <div
            className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Determine if customer is matched (has AZ link) */}
            {(() => {
              const isMatched = item.agencyzoomCustomerId || item.agencyzoomLeadId;
              const isUnmatched = !isMatched && (item.matchStatus === 'unmatched' || item.matchStatus === 'needs_review' || item.matchStatus === 'after_hours');

              return (
                <>
                  {/* Primary Actions Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* MATCHED: Post Note (primary) */}
                    {isMatched && (
                      <Tooltip text="Save call summary to customer record in AgencyZoom">
                        <button
                          onClick={() => onQuickAction('note')}
                          className="px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Post Note
                        </button>
                      </Tooltip>
                    )}

                    {/* MATCHED: Create SR (primary) */}
                    {isMatched && (
                      <Tooltip text="Create a service request for follow-up action">
                        <button
                          onClick={() => onQuickAction('ticket')}
                          className="px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Create SR
                        </button>
                      </Tooltip>
                    )}

                    {/* UNMATCHED: Find Match */}
                    {isUnmatched && onFindMatch && (
                      <Tooltip text="Search for matching customer in HawkSoft/AgencyZoom">
                        <button
                          onClick={() => onFindMatch()}
                          className="px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Find Match
                        </button>
                      </Tooltip>
                    )}

                    {/* UNMATCHED: NCM Queue */}
                    {isUnmatched && (
                      <Tooltip text="Post to No Customer Match queue for processing">
                        <button
                          onClick={() => onQuickAction('ncm')}
                          className="px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          NCM Queue
                        </button>
                      </Tooltip>
                    )}
                  </div>

                  {/* Secondary Actions Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* AgencyZoom Link */}
                    {isMatched && (
                      <a
                        href={getAgencyZoomUrl(
                          item.agencyzoomCustomerId || item.agencyzoomLeadId || '',
                          item.agencyzoomCustomerId ? 'customer' : 'lead'
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                      >
                        Open in AZ
                      </a>
                    )}

                    {/* Acknowledge - For messages */}
                    {item.type === 'message' && (
                      <button
                        onClick={() => onQuickAction('acknowledge')}
                        className="px-3 py-2 rounded-lg font-medium text-sm transition-colors bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Acknowledge
                      </button>
                    )}

                    {/* Skip */}
                    <Tooltip text="Mark complete without CRM action (call already handled)">
                      <button
                        onClick={() => onQuickAction('skip')}
                        className="px-3 py-2 rounded-lg font-medium text-sm transition-colors bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Skip
                      </button>
                    </Tooltip>

                    {/* Delete */}
                    {onDelete && (
                      <Tooltip text="Remove invalid call from queue (spam, wrong number, etc.)">
                        <button
                          onClick={() => onDelete()}
                          className="px-3 py-2 rounded-lg font-medium text-sm transition-colors bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                        >
                          Delete...
                        </button>
                      </Tooltip>
                    )}

                    {/* Report Issue */}
                    {onReportIssue && (
                      <button
                        onClick={() => onReportIssue()}
                        className="px-3 py-2 rounded-lg font-medium text-sm transition-colors bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                      >
                        Report Issue
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

export function PendingItemCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-pulse">
      {/* Header bar */}
      <div className="h-10 bg-gray-200 dark:bg-gray-700" />

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>

        <div className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />

        <div className="flex gap-2">
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
