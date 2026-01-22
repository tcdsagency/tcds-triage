'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import ServiceTicketCard from './ServiceTicketCard';
import TriageCard from './TriageCard';
import type { ServiceTicketItem, TriageItem } from '@/app/api/service-pipeline/route';

export interface StageConfig {
  id: string | number;
  name: string;
  color: string;
  order: number;
}

interface ServiceKanbanColumnProps {
  stage: StageConfig;
  triageItems?: TriageItem[];
  tickets?: ServiceTicketItem[];
  onItemClick?: (item: TriageItem | ServiceTicketItem, type: 'triage' | 'ticket') => void;
  onTriageAction?: (item: TriageItem, action: 'note' | 'ticket' | 'skip' | 'delete') => void;
  isOver?: boolean;
}

// Stage color mapping
const STAGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
  },
};

export default function ServiceKanbanColumn({
  stage,
  triageItems = [],
  tickets = [],
  onItemClick,
  onTriageAction,
  isOver,
}: ServiceKanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: {
      type: 'stage',
      stage,
    },
  });

  const colors = STAGE_COLORS[stage.color] || STAGE_COLORS.gray;
  const isHighlighted = isOver || isDroppableOver;
  const isTriage = stage.id === 'triage';

  // Get all item IDs for sortable context
  const itemIds = isTriage
    ? triageItems.map((item) => item.id)
    : tickets.map((ticket) => ticket.id);

  const itemCount = isTriage ? triageItems.length : tickets.length;

  return (
    <div
      className={cn(
        'flex flex-col w-72 min-w-72 rounded-lg border-2 transition-all h-full',
        colors.bg,
        isHighlighted ? 'border-blue-500 ring-2 ring-blue-500/20' : colors.border
      )}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 rounded-t-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className={cn('font-semibold text-sm', colors.text)}>{stage.name}</h3>
          <span
            className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              colors.bg,
              colors.text,
              'border',
              colors.border
            )}
          >
            {itemCount}
          </span>
        </div>
      </div>

      {/* Column Content - Scrollable */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 overflow-y-auto min-h-[200px] space-y-2',
          isHighlighted && 'bg-blue-50/50 dark:bg-blue-900/10'
        )}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {isTriage
            ? triageItems.map((item) => (
                <TriageCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick?.(item, 'triage')}
                  onQuickAction={
                    onTriageAction
                      ? (action) => onTriageAction(item, action)
                      : undefined
                  }
                />
              ))
            : tickets.map((ticket) => (
                <ServiceTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => onItemClick?.(ticket, 'ticket')}
                />
              ))}
        </SortableContext>

        {/* Empty State */}
        {itemCount === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 dark:text-gray-500 text-sm">
            {isTriage ? 'No items to triage' : 'No tickets in this stage'}
          </div>
        )}
      </div>
    </div>
  );
}
