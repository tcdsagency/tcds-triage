'use client';

import { cn, formatPhoneNumber } from '@/lib/utils';
import { getAgencyZoomUrl } from '@/components/ui/agencyzoom-link';

// =============================================================================
// TYPES
// =============================================================================

export interface ReviewedItem {
  id: string;
  callId: string | null;
  type: 'wrapup';
  direction: 'inbound' | 'outbound' | null;

  // Contact info
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;

  // Review info
  status: string;
  outcome: string | null;
  isAutoVoided: boolean;
  autoVoidReason: string | null;

  // Reviewer info
  reviewerId: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  completedAt: string | null;

  // Content
  summary: string | null;
  requestType: string | null;

  // Match info
  matchStatus: string | null;
  agencyzoomCustomerId: string | null;
  agencyzoomLeadId: string | null;
  agencyzoomNoteId: string | null;

  // Timestamps
  createdAt: string;
}

export interface ReviewedItemCardProps {
  item: ReviewedItem;
  onResubmit?: (id: string) => void;
  isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ReviewedItemCard({
  item,
  onResubmit,
  isLoading = false,
}: ReviewedItemCardProps) {
  const displayName = item.customerName || 'Unknown';
  const displayPhone = item.customerPhone ? formatPhoneNumber(item.customerPhone) : null;

  const completedTime = item.completedAt
    ? new Date(item.completedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : item.reviewedAt
      ? new Date(item.reviewedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : null;

  // Determine outcome display
  const getOutcomeDisplay = () => {
    if (item.isAutoVoided) {
      return {
        label: 'Auto-Voided',
        reason: item.autoVoidReason || 'Automatically voided',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-600',
        badgeBg: 'bg-gray-500',
        badgeText: 'text-white',
        icon: '🗑️',
      };
    }

    switch (item.outcome) {
      case 'note_posted':
      case 'posted_to_agencyzoom':
        return {
          label: 'Note Posted',
          reason: 'Posted to AgencyZoom',
          bgColor: 'bg-green-50 dark:bg-green-900/10',
          borderColor: 'border-green-300 dark:border-green-700',
          badgeBg: 'bg-green-500',
          badgeText: 'text-white',
          icon: '✓',
        };
      case 'service_request':
      case 'sr_created':
        return {
          label: 'Service Request',
          reason: 'SR created in AgencyZoom',
          bgColor: 'bg-blue-50 dark:bg-blue-900/10',
          borderColor: 'border-blue-300 dark:border-blue-700',
          badgeBg: 'bg-blue-500',
          badgeText: 'text-white',
          icon: '📋',
        };
      case 'voided':
        return {
          label: 'Voided',
          reason: 'Manually voided',
          bgColor: 'bg-red-50 dark:bg-red-900/10',
          borderColor: 'border-red-300 dark:border-red-700',
          badgeBg: 'bg-red-500',
          badgeText: 'text-white',
          icon: '✕',
        };
      case 'skipped':
        return {
          label: 'Skipped',
          reason: 'Skipped without action',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
          borderColor: 'border-yellow-300 dark:border-yellow-700',
          badgeBg: 'bg-yellow-500',
          badgeText: 'text-white',
          icon: '⏭',
        };
      default:
        return {
          label: 'Completed',
          reason: item.outcome || 'Reviewed',
          bgColor: 'bg-gray-50 dark:bg-gray-800',
          borderColor: 'border-gray-300 dark:border-gray-600',
          badgeBg: 'bg-gray-500',
          badgeText: 'text-white',
          icon: '✓',
        };
    }
  };

  const outcomeDisplay = getOutcomeDisplay();

  return (
    <div
      className={cn(
        'rounded-xl border-2 overflow-hidden',
        outcomeDisplay.bgColor,
        outcomeDisplay.borderColor
      )}
    >
      {/* Status Header */}
      <div className={cn('flex items-center justify-between px-4 py-2', outcomeDisplay.badgeBg)}>
        <span className={cn('font-semibold text-sm', outcomeDisplay.badgeText)}>
          {outcomeDisplay.icon} {outcomeDisplay.label}
        </span>
        {completedTime && (
          <span className={cn('text-xs font-medium', outcomeDisplay.badgeText, 'opacity-90')}>
            {completedTime}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Contact Info */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {displayName}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              {displayPhone && (
                <span className="font-mono">{displayPhone}</span>
              )}
              <span className="flex items-center gap-1">
                📞 Call
                {item.direction && (
                  <span className="text-gray-400">
                    ({item.direction === 'inbound' ? '↓ in' : '↑ out'})
                  </span>
                )}
              </span>
              {item.callId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(item.callId || '');
                    const btn = e.currentTarget;
                    btn.textContent = '✓ Copied';
                    setTimeout(() => {
                      btn.textContent = `ID: ${item.callId?.slice(0, 8)}...`;
                    }, 1500);
                  }}
                  className="font-mono text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:underline cursor-pointer"
                  title={`Click to copy: ${item.callId}`}
                >
                  ID: {item.callId.slice(0, 8)}...
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        {item.summary && (
          <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Summary
              </span>
              {item.requestType && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {item.requestType}
                </span>
              )}
            </div>
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-sm line-clamp-3">
              {item.summary}
            </p>
          </div>
        )}

        {/* Outcome Reason */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">{outcomeDisplay.reason}</span>
          {item.reviewerName && !item.isAutoVoided && (
            <span className="ml-2">by {item.reviewerName}</span>
          )}
        </div>

        {/* Auto-void reason detail */}
        {item.isAutoVoided && item.autoVoidReason && (
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
            Reason: {item.autoVoidReason}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          {/* Re-submit button */}
          {onResubmit && (
            <button
              onClick={() => onResubmit(item.id)}
              disabled={isLoading}
              className={cn(
                'px-4 py-2 rounded-lg font-semibold text-sm transition-colors',
                isLoading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 border border-amber-300 dark:border-amber-700'
              )}
            >
              {isLoading ? 'Processing...' : 'Re-submit for Review'}
            </button>
          )}

          {/* AgencyZoom Link */}
          {(item.agencyzoomCustomerId || item.agencyzoomLeadId) && (
            <a
              href={getAgencyZoomUrl(
                item.agencyzoomCustomerId || item.agencyzoomLeadId || '',
                item.agencyzoomCustomerId ? 'customer' : 'lead'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Open in AgencyZoom
            </a>
          )}

          {/* Note Link */}
          {item.agencyzoomNoteId && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Note ID: {item.agencyzoomNoteId.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SKELETON
// =============================================================================

export function ReviewedItemCardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-pulse">
      <div className="h-10 bg-gray-200 dark:bg-gray-700" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
