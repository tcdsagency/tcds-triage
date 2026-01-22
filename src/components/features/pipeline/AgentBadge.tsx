'use client';

import { cn } from '@/lib/utils';

export interface Agent {
  id: string;
  name: string;
  initials: string;
  color: string;
  agencyzoomId?: string | null;
}

interface AgentBadgeProps {
  agent: Agent | null;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const SIZE_STYLES = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export default function AgentBadge({
  agent,
  size = 'md',
  showName = false,
  className,
}: AgentBadgeProps) {
  if (!agent) {
    return (
      <div
        className={cn(
          'rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 font-semibold',
          SIZE_STYLES[size],
          className
        )}
        title="Unassigned"
      >
        ?
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center text-white font-semibold shadow-sm',
          SIZE_STYLES[size]
        )}
        style={{ backgroundColor: agent.color }}
        title={agent.name}
      >
        {agent.initials}
      </div>
      {showName && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {agent.name}
        </span>
      )}
    </div>
  );
}
