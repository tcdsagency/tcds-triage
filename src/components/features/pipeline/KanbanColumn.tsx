'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import LeadCard, { PipelineLead } from './LeadCard';
import { Agent } from './AgentBadge';

export interface StageData {
  id: number;
  name: string;
  order: number;
  leads: PipelineLead[];
  count: number;
  totalPremium: number;
}

interface KanbanColumnProps {
  stage: StageData;
  agents: Map<string, Agent>;
  onLeadClick?: (lead: PipelineLead) => void;
  isOver?: boolean;
}

// Stage color mapping
const STAGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'New Lead/Data Entry': {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
  },
  'Contacted/Quoted': {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
  },
  'Sent to Customer': {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
  },
  'Sent to Lender': {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  Sold: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
  },
  Unassigned: {
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
  },
};

const DEFAULT_COLORS = {
  bg: 'bg-gray-50 dark:bg-gray-900/20',
  border: 'border-gray-200 dark:border-gray-700',
  text: 'text-gray-700 dark:text-gray-300',
};

export default function KanbanColumn({ stage, agents, onLeadClick, isOver }: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: {
      type: 'stage',
      stage,
    },
  });

  const colors = STAGE_COLORS[stage.name] || DEFAULT_COLORS;
  const isHighlighted = isOver || isDroppableOver;

  // Format total premium
  const formatPremium = (premium: number) => {
    if (!premium) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(premium);
  };

  // Get lead IDs for sortable context
  const leadIds = stage.leads.map((lead) => lead.id);

  return (
    <div
      className={cn(
        'flex flex-col w-72 min-w-72 rounded-lg border-2 transition-all',
        colors.bg,
        isHighlighted ? 'border-blue-500 ring-2 ring-blue-500/20' : colors.border
      )}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 rounded-t-lg">
        <div className="flex items-center justify-between mb-1">
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
            {stage.count}
          </span>
        </div>
        {stage.totalPremium > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Total: {formatPremium(stage.totalPremium)}
          </div>
        )}
      </div>

      {/* Column Content - Scrollable */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 overflow-y-auto min-h-[200px] space-y-2',
          isHighlighted && 'bg-blue-50/50 dark:bg-blue-900/10'
        )}
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {stage.leads.map((lead) => {
            const agent = lead.producerId ? agents.get(lead.producerId) || null : null;
            return (
              <LeadCard
                key={lead.id}
                lead={lead}
                agent={agent}
                onClick={() => onLeadClick?.(lead)}
              />
            );
          })}
        </SortableContext>

        {/* Empty State */}
        {stage.leads.length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 dark:text-gray-500 text-sm">
            No leads in this stage
          </div>
        )}
      </div>
    </div>
  );
}
