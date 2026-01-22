'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn, formatPhoneNumber } from '@/lib/utils';
import type { TriageItem } from '@/app/api/service-pipeline/route';

interface TriageCardProps {
  item: TriageItem;
  onClick?: () => void;
  onQuickAction?: (action: 'note' | 'ticket' | 'skip' | 'delete') => void;
  isDragging?: boolean;
}

// Match status colors
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  matched: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: '✓',
  },
  needs_review: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    icon: '?',
  },
  unmatched: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    icon: '✗',
  },
  after_hours: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    icon: '🌙',
  },
};

export default function TriageCard({
  item,
  onClick,
  onQuickAction,
  isDragging,
}: TriageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: 'triage',
      item,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  // Format age
  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  const statusStyle = STATUS_COLORS[item.matchStatus] || STATUS_COLORS.unmatched;

  // Get handler initials
  const getHandlerInitials = () => {
    if (!item.handledByAgent) return null;
    return item.handledByAgent.initials;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all group',
        'hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600',
        isCurrentlyDragging
          ? 'opacity-50 shadow-lg border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="p-3 space-y-2">
        {/* Header: Contact + Type Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {/* Item type icon */}
              <span className="text-gray-400 dark:text-gray-500 text-sm">
                {item.itemType === 'wrapup' ? '📞' : '💬'}
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {item.contactName || formatPhoneNumber(item.contactPhone) || 'Unknown'}
              </h4>
            </div>
            {item.contactPhone && item.contactName && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                {formatPhoneNumber(item.contactPhone)}
              </p>
            )}
          </div>
          {/* Match status badge */}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              statusStyle.bg,
              statusStyle.text
            )}
            title={item.matchStatus.replace('_', ' ')}
          >
            {statusStyle.icon}
          </span>
        </div>

        {/* Summary preview */}
        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
          {item.summary || 'No summary available'}
        </p>

        {/* Footer: Request type + Handler + Age */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            {item.requestType && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
                {item.requestType}
              </span>
            )}
            {item.handledByAgent && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                style={{ backgroundColor: '#6366f1' }}
                title={item.handledByAgent.name}
              >
                {getHandlerInitials()}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatAge(item.ageMinutes)}
          </span>
        </div>

        {/* Quick actions on hover */}
        {onQuickAction && item.matchStatus === 'matched' && (
          <div className="hidden group-hover:flex items-center justify-end gap-1 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction('note');
              }}
              className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
              title="Post Note to AZ"
            >
              Note
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction('ticket');
              }}
              className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              title="Create SR"
            >
              SR
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction('skip');
              }}
              className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
              title="Skip"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Drag overlay version (used during drag)
export function TriageCardOverlay({ item }: { item: TriageItem }) {
  const statusStyle = STATUS_COLORS[item.matchStatus] || STATUS_COLORS.unmatched;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500 shadow-xl p-3 w-64">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 dark:text-gray-500 text-sm">
              {item.itemType === 'wrapup' ? '📞' : '💬'}
            </span>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {item.contactName || formatPhoneNumber(item.contactPhone) || 'Unknown'}
            </h4>
          </div>
        </div>
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            statusStyle.bg,
            statusStyle.text
          )}
        >
          {statusStyle.icon}
        </span>
      </div>
    </div>
  );
}
