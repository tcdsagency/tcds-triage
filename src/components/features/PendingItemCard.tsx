'use client';

import { useState, useRef, useEffect } from 'react';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { AgencyZoomLink, getAgencyZoomUrl } from '@/components/ui/agencyzoom-link';

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
  timestamp: string;
  ageMinutes: number;

  // Trestle enrichment
  trestleData: {
    name?: string;
    address?: string;
    email?: string;
    altPhones?: string[];
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
}

export interface PendingItemCardProps {
  item: PendingItem;
  isSelected?: boolean;
  isChecked?: boolean;
  onSelect?: () => void;
  onCheck?: (checked: boolean) => void;
  onQuickAction?: (action: 'note' | 'ticket' | 'acknowledge' | 'skip' | 'void' | 'ncm') => void;
  onReviewClick?: () => void;
  onFindMatch?: () => void;
  onReportIssue?: () => void;
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
  onSelect,
  onCheck,
  onQuickAction,
  onReviewClick,
  onFindMatch,
  onReportIssue,
}: PendingItemCardProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  const statusStyle = STATUS_STYLES[item.matchStatus] || STATUS_STYLES.unmatched;
  const sentimentStyle = item.sentiment ? SENTIMENT_STYLES[item.sentiment] : null;
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.wrapup;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target as Node)) {
        setShowMoreActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
              <span className="flex items-center gap-1">
                {typeConfig.icon} {typeConfig.label}
                {item.direction && (
                  <span className="text-gray-400">
                    ({item.direction === 'inbound' ? '↓ in' : '↑ out'})
                  </span>
                )}
              </span>
              {item.handledBy && (
                <span>by {item.handledBy}</span>
              )}
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

        {/* ===== AI SUMMARY (Prominent) ===== */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              AI Summary
            </span>
            {item.requestType && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {item.requestType}
              </span>
            )}
          </div>
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
            {item.summary || 'No summary available'}
          </p>
        </div>

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
            className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* PRIMARY ACTION - Large and prominent */}
            {primaryAction && primaryAction.onClick && (
              <button
                onClick={() => primaryAction.onClick?.()}
                className={cn(
                  'flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2',
                  primaryAction.className
                )}
              >
                {primaryAction.icon} {primaryAction.label}
              </button>
            )}

            {/* Post to NCM - For unmatched without AZ link */}
            {(item.matchStatus === 'unmatched' || item.matchStatus === 'needs_review' || item.matchStatus === 'after_hours') &&
              !item.agencyzoomCustomerId &&
              !item.agencyzoomLeadId && (
              <button
                onClick={() => onQuickAction('ncm')}
                className="px-3 py-2 text-sm rounded-lg font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                title="Post to No Customer Match queue in AgencyZoom"
              >
                📋 NCM Queue
              </button>
            )}

            {/* Skip - Secondary action */}
            <button
              onClick={() => onQuickAction('skip')}
              className="px-3 py-2 text-sm rounded-lg font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Skip
            </button>

            {/* AgencyZoom Link */}
            {(item.agencyzoomCustomerId || item.agencyzoomLeadId) && (
              <AgencyZoomLink
                href={getAgencyZoomUrl(
                  item.agencyzoomCustomerId || item.agencyzoomLeadId || '',
                  item.agencyzoomCustomerId ? 'customer' : 'lead'
                )}
                size="sm"
                showText={false}
              />
            )}

            {/* More Actions Dropdown */}
            <div className="relative" ref={moreActionsRef}>
              <button
                onClick={() => setShowMoreActions(!showMoreActions)}
                className="px-2 py-2 text-sm rounded-lg font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                •••
              </button>

              {showMoreActions && (
                <div className="absolute right-0 bottom-full mb-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
                  {item.type === 'message' && (
                    <button
                      onClick={() => {
                        onQuickAction('acknowledge');
                        setShowMoreActions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      ✓ Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onQuickAction('void');
                      setShowMoreActions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                  >
                    🗑️ Void Item
                  </button>
                  {onReportIssue && (
                    <button
                      onClick={() => {
                        onReportIssue();
                        setShowMoreActions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                    >
                      ⚠️ Report Issue
                    </button>
                  )}
                </div>
              )}
            </div>
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
