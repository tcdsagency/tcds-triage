'use client';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export type TicketStatus = 'active' | 'completed' | 'removed';

export interface ServiceTicketData {
  azTicketId: number;
  status: TicketStatus;
  stageName?: string | null;
  subject?: string;
  csrName?: string | null;
  dueDate?: string | null;
}

interface ServiceTicketBadgeProps {
  ticket: ServiceTicketData;
  size?: 'sm' | 'md';
  showLink?: boolean;
  className?: string;
}

// =============================================================================
// STYLES
// =============================================================================

const STATUS_STYLES: Record<TicketStatus, {
  bg: string;
  text: string;
  border: string;
  icon: string;
  label: string;
}> = {
  active: {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    icon: '🎫',
    label: 'Open',
  },
  completed: {
    bg: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
    icon: '✓',
    label: 'Completed',
  },
  removed: {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-300 dark:border-gray-600',
    icon: '✕',
    label: 'Removed',
  },
};

const SIZE_STYLES = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ServiceTicketBadge({
  ticket,
  size = 'md',
  showLink = true,
  className,
}: ServiceTicketBadgeProps) {
  const style = STATUS_STYLES[ticket.status];
  const azUrl = `https://app.agencyzoom.com/service-center/${ticket.azTicketId}`;

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {/* Status Badge */}
      <span
        className={cn(
          'inline-flex items-center font-medium rounded border gap-1',
          style.bg, style.text, style.border,
          SIZE_STYLES[size]
        )}
        title={ticket.subject || `Service Ticket #${ticket.azTicketId}`}
      >
        <span>{style.icon}</span>
        <span>SR #{ticket.azTicketId}</span>
      </span>

      {/* Stage Name (if provided and active) */}
      {ticket.status === 'active' && ticket.stageName && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {ticket.stageName}
        </span>
      )}

      {/* Link to AgencyZoom */}
      {showLink && (
        <a
          href={azUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
        >
          View →
        </a>
      )}
    </div>
  );
}

// =============================================================================
// COMPACT VARIANT (for tight spaces)
// =============================================================================

export function ServiceTicketBadgeCompact({
  ticket,
  className,
}: {
  ticket: ServiceTicketData;
  className?: string;
}) {
  const style = STATUS_STYLES[ticket.status];
  const azUrl = `https://app.agencyzoom.com/service-center/${ticket.azTicketId}`;

  return (
    <a
      href={azUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium rounded border px-1.5 py-0.5 hover:opacity-80',
        style.bg, style.text, style.border,
        className
      )}
      title={`${style.label}: ${ticket.subject || 'Service Ticket'}`}
    >
      <span>{style.icon}</span>
      <span>#{ticket.azTicketId}</span>
    </a>
  );
}

// =============================================================================
// CARD VARIANT (for pending review items)
// =============================================================================

export function ServiceTicketCard({
  ticket,
  className,
}: {
  ticket: ServiceTicketData;
  className?: string;
}) {
  const style = STATUS_STYLES[ticket.status];
  const azUrl = `https://app.agencyzoom.com/service-center/${ticket.azTicketId}`;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-lg border',
        style.bg, style.border,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('font-medium', style.text)}>
          {style.icon} SR #{ticket.azTicketId}
        </span>
        {ticket.stageName && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            • {ticket.stageName}
          </span>
        )}
        {ticket.csrName && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            • {ticket.csrName}
          </span>
        )}
      </div>
      <a
        href={azUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
      >
        Open in AZ →
      </a>
    </div>
  );
}
