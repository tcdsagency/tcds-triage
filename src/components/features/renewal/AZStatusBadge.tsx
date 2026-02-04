'use client';

import { cn } from '@/lib/utils';

const STAGE_ORDER = [
  'policy_pending_review',
  'waiting_agent_review',
  'contact_customer',
  'requote_requested',
  'quote_ready_ezl',
  'completed',
];

const STAGE_LABELS: Record<string, string> = {
  pending_ingestion: 'Pending Ingestion',
  comparison_ready: 'Comparison Ready',
  waiting_agent_review: 'Agent Review',
  agent_reviewed: 'Reviewed',
  requote_requested: 'Requote Requested',
  quote_ready: 'Quote Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface AZStatusBadgeProps {
  status: string;
  agencyzoomSrId?: number | null;
  compact?: boolean;
}

export default function AZStatusBadge({ status, agencyzoomSrId, compact }: AZStatusBadgeProps) {
  const label = STAGE_LABELS[status] || status.replace(/_/g, ' ');

  const colorMap: Record<string, string> = {
    pending_ingestion: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    comparison_ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    waiting_agent_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    agent_reviewed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    requote_requested: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    quote_ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
          colorMap[status] || 'bg-gray-100 text-gray-600'
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold',
            colorMap[status] || 'bg-gray-100 text-gray-600'
          )}
        >
          {label}
        </span>
        {agencyzoomSrId && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            AZ SR #{agencyzoomSrId}
          </span>
        )}
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1">
        {STAGE_ORDER.map((stage, i) => {
          const currentIndex = STAGE_ORDER.indexOf(
            status === 'completed' ? 'completed' :
            status === 'quote_ready' ? 'quote_ready_ezl' :
            status === 'waiting_agent_review' || status === 'comparison_ready' ? 'waiting_agent_review' :
            status === 'requote_requested' ? 'requote_requested' :
            'policy_pending_review'
          );
          const isComplete = i <= currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div
              key={stage}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                isComplete
                  ? isCurrent
                    ? 'bg-emerald-500'
                    : 'bg-emerald-400/60'
                  : 'bg-gray-200 dark:bg-gray-700'
              )}
              title={STAGE_LABELS[stage] || stage}
            />
          );
        })}
      </div>
    </div>
  );
}
