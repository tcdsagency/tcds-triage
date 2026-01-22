'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn, formatPhoneNumber } from '@/lib/utils';
import AgentBadge, { Agent } from './AgentBadge';

export interface PipelineLead {
  id: string;
  agencyzoomId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pipelineStage: string | null;
  pipelineStageId: number | null;
  stageEnteredAt: Date | string | null;
  quotedPremium: number | null;
  leadSource: string | null;
  producerId: string | null;
  producerName: string | null;
  createdAt: Date | string;
}

interface LeadCardProps {
  lead: PipelineLead;
  agent: Agent | null;
  onClick?: () => void;
  isDragging?: boolean;
}

export default function LeadCard({ lead, agent, onClick, isDragging }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      lead,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  // Format stage entry date
  const formatStageDate = (date: Date | string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Format premium
  const formatPremium = (premium: number | null) => {
    if (!premium) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(premium);
  };

  const fullName = `${lead.firstName} ${lead.lastName}`.trim() || 'Unknown';
  const stageDate = formatStageDate(lead.stageEnteredAt || lead.createdAt);
  const premium = formatPremium(lead.quotedPremium);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all',
        'hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600',
        isCurrentlyDragging
          ? 'opacity-50 shadow-lg border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="p-3 space-y-2">
        {/* Header: Name + Agent Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-white truncate">
              {fullName}
            </h4>
            {stageDate && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Entered on: {stageDate}
              </p>
            )}
          </div>
          <AgentBadge agent={agent} size="sm" />
        </div>

        {/* Contact Info */}
        {(lead.phone || lead.email) && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            {lead.phone && (
              <div className="font-mono">{formatPhoneNumber(lead.phone)}</div>
            )}
            {lead.email && !lead.phone && (
              <div className="truncate">{lead.email}</div>
            )}
          </div>
        )}

        {/* Footer: Source + Premium */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700/50">
          {lead.leadSource ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
              {lead.leadSource}
            </span>
          ) : (
            <span />
          )}
          {premium && (
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              {premium}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Drag overlay version (used during drag)
export function LeadCardOverlay({ lead, agent }: { lead: PipelineLead; agent: Agent | null }) {
  const fullName = `${lead.firstName} ${lead.lastName}`.trim() || 'Unknown';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500 shadow-xl p-3 w-64">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">
            {fullName}
          </h4>
        </div>
        <AgentBadge agent={agent} size="sm" />
      </div>
    </div>
  );
}
