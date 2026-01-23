'use client';

import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { TriageQueueItem } from '@/app/(dashboard)/triage-inbox/page';

interface TriageQueuePanelProps {
  items: TriageQueueItem[];
  selectedItemId: string | null;
  loading: boolean;
  onSelectItem: (item: TriageQueueItem, index: number) => void;
}

// Map action to colors
const ACTION_COLORS = {
  append: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  dismiss: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const ACTION_LABELS = {
  append: 'Append',
  create: 'Create',
  dismiss: 'Dismiss',
};

export default function TriageQueuePanel({
  items,
  selectedItemId,
  loading,
  onSelectItem,
}: TriageQueuePanelProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-medium">All caught up!</p>
        <p className="text-sm text-muted-foreground">No items pending triage</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item, index) => {
        const isSelected = item.id === selectedItemId;
        const recommendation = item.aiTriageRecommendation;
        const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

        return (
          <button
            key={item.id}
            onClick={() => onSelectItem(item, index)}
            className={cn(
              'w-full text-left p-4 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary',
              isSelected && 'bg-muted'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Unread indicator */}
              <div className={cn(
                'w-2 h-2 rounded-full mt-2 flex-none',
                isSelected ? 'bg-primary' : 'bg-blue-500'
              )} />

              <div className="flex-1 min-w-0">
                {/* Header: Name & Time */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {item.customerName || 'Unknown Caller'}
                  </span>
                  <span className="text-xs text-muted-foreground flex-none">
                    {timeAgo}
                  </span>
                </div>

                {/* Phone */}
                {item.customerPhone && (
                  <div className="text-sm text-muted-foreground truncate">
                    {formatPhoneNumber(item.customerPhone)}
                  </div>
                )}

                {/* Summary preview */}
                <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {item.summary || 'No summary available'}
                </div>

                {/* AI Recommendation badge */}
                {recommendation && (
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        ACTION_COLORS[recommendation.suggestedAction]
                      )}
                    >
                      {ACTION_LABELS[recommendation.suggestedAction]}
                      {recommendation.confidence >= 0.8 && (
                        <span className="ml-1">
                          {Math.round(recommendation.confidence * 100)}%
                        </span>
                      )}
                    </span>

                    {/* Show related ticket if append */}
                    {recommendation.suggestedAction === 'append' &&
                      recommendation.relatedTickets?.[0] && (
                        <span className="text-xs text-muted-foreground">
                          → #{recommendation.relatedTickets[0].ticketId}
                        </span>
                      )}
                  </div>
                )}

                {/* Type badge */}
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    item.direction === 'Inbound'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  )}>
                    {item.direction === 'Inbound' ? '↓ Inbound' : '↑ Outbound'}
                  </span>

                  {item.agentName && (
                    <span className="text-xs text-muted-foreground">
                      {item.agentName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
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
