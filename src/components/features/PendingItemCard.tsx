'use client';

import { cn } from '@/lib/utils';

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
  onQuickAction?: (action: 'note' | 'ticket' | 'acknowledge' | 'skip') => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MATCH_STATUS_CONFIG: Record<string, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
}> = {
  matched: {
    label: 'Matched',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-700',
    icon: '✓',
  },
  needs_review: {
    label: 'Needs Review',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-700',
    icon: '?',
  },
  unmatched: {
    label: 'No Match',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-700',
    icon: '+',
  },
  after_hours: {
    label: 'After Hours',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-700',
    icon: '🌙',
  },
};

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  wrapup: { label: 'Call', icon: '📞', color: 'text-blue-600 dark:text-blue-400' },
  message: { label: 'SMS', icon: '💬', color: 'text-green-600 dark:text-green-400' },
  lead: { label: 'Lead', icon: '🎯', color: 'text-purple-600 dark:text-purple-400' },
};

const SENTIMENT_CONFIG: Record<string, { icon: string; label: string }> = {
  positive: { icon: '😊', label: 'Positive' },
  neutral: { icon: '😐', label: 'Neutral' },
  frustrated: { icon: '😤', label: 'Frustrated' },
};

const REQUEST_TYPE_ICONS: Record<string, string> = {
  quote: '📋',
  claim: '⚠️',
  billing: '💳',
  service: '🔧',
  renewal: '🔄',
  cancel: '❌',
  inquiry: '❓',
  sms: '💬',
  'after hours': '🌙',
  'new lead': '🎯',
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
}: PendingItemCardProps) {
  const matchConfig = MATCH_STATUS_CONFIG[item.matchStatus] || MATCH_STATUS_CONFIG.unmatched;
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.wrapup;
  const sentimentConfig = item.sentiment ? SENTIMENT_CONFIG[item.sentiment] : null;
  const requestIcon = REQUEST_TYPE_ICONS[item.requestType?.toLowerCase() || ''] || '📝';

  // Format age display
  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative p-4 rounded-lg border-2 cursor-pointer transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/30 ring-2 ring-blue-500/20'
          : cn(matchConfig.borderColor, 'hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800')
      )}
    >
      {/* Checkbox for bulk selection */}
      {onCheck && (
        <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onCheck(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Header Row */}
      <div className={cn('flex items-start justify-between mb-3', onCheck && 'ml-7')}>
        <div className="flex items-center gap-3">
          {/* Type Icon */}
          <div className={cn('text-2xl', typeConfig.color)}>
            {requestIcon}
          </div>

          {/* Contact Info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                {item.contactName || item.contactPhone || 'Unknown'}
              </span>
              {item.contactType && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  item.contactType === 'customer'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                )}>
                  {item.contactType}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{typeConfig.icon} {typeConfig.label}</span>
              {item.direction && (
                <>
                  <span>•</span>
                  <span>{item.direction === 'inbound' ? '↓' : '↑'} {item.direction}</span>
                </>
              )}
              {item.handledBy && (
                <>
                  <span>•</span>
                  <span>by {item.handledBy}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Status Badge + Time */}
        <div className="flex flex-col items-end gap-1">
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
            matchConfig.bgColor,
            matchConfig.textColor
          )}>
            <span>{matchConfig.icon}</span>
            <span>{matchConfig.label}</span>
          </span>
          <span className="text-xs text-gray-400">
            {formatAge(item.ageMinutes)}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
        {item.summary || 'No summary available'}
      </p>

      {/* Badges Row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Sentiment */}
        {sentimentConfig && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            item.sentiment === 'positive' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
            item.sentiment === 'neutral' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
            item.sentiment === 'frustrated' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          )}>
            {sentimentConfig.icon} {sentimentConfig.label}
          </span>
        )}

        {/* Request Type */}
        {item.requestType && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {item.requestType}
          </span>
        )}

        {/* Auto-posted indicator */}
        {item.isAutoPosted && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            ✓ Auto-posted
          </span>
        )}

        {/* Action items count */}
        {item.actionItems.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            📝 {item.actionItems.length} action{item.actionItems.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Policies */}
        {item.policies.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            🔖 {item.policies.join(', ')}
          </span>
        )}
      </div>

      {/* Trestle Identity Hint (for unmatched) */}
      {item.matchStatus === 'unmatched' && item.trestleData && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
            📍 Identity hint from Trestle
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {item.trestleData.name}
            {item.trestleData.address && ` - ${item.trestleData.address}`}
          </div>
        </div>
      )}

      {/* Match Suggestions (for needs_review) */}
      {item.matchStatus === 'needs_review' && item.matchSuggestions.length > 0 && (
        <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
            🔍 {item.matchSuggestions.length} potential match{item.matchSuggestions.length !== 1 ? 'es' : ''}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Best: {item.matchSuggestions[0].name} ({Math.round(item.matchSuggestions[0].confidence * 100)}% - {item.matchSuggestions[0].reason})
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {onQuickAction && (
        <div
          className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Different actions based on match status */}
          {item.matchStatus === 'matched' && (
            <>
              <button
                onClick={() => onQuickAction('note')}
                className="px-3 py-1.5 text-xs rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                📝 Post Note
              </button>
              <button
                onClick={() => onQuickAction('ticket')}
                className="px-3 py-1.5 text-xs rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                🎫 Ticket
              </button>
            </>
          )}

          {item.type === 'message' && (
            <button
              onClick={() => onQuickAction('acknowledge')}
              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              ✓ Acknowledge
            </button>
          )}

          <button
            onClick={() => onQuickAction('skip')}
            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

export function PendingItemCardSkeleton() {
  return (
    <div className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
    </div>
  );
}
