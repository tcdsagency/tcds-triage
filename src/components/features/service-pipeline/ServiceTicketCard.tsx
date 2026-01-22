'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { ServiceTicketItem } from '@/app/api/service-pipeline/route';

// NCM (No Customer Match) household ID in AgencyZoom
const NCM_HOUSEHOLD_ID = 22138921;

interface ServiceTicketCardProps {
  ticket: ServiceTicketItem;
  onClick?: () => void;
  isDragging?: boolean;
}

// Format date to AgencyZoom style: "Jan 22, 2026"
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const date = parseISO(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T'));
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
}

// Priority color mapping
const PRIORITY_COLORS: Record<string, string> = {
  'Urgent': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  '2 Hour': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Standard': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

export default function ServiceTicketCard({
  ticket,
  onClick,
  isDragging,
}: ServiceTicketCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: ticket.id,
    data: {
      type: 'ticket',
      ticket,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;
  const isNCM = ticket.azHouseholdId === NCM_HOUSEHOLD_ID;

  // Get CSR initials
  const getCsrInitials = (name: string | null) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase();
  };

  // Generate a color based on CSR name
  const getCsrColor = (name: string | null) => {
    if (!name) return '#9ca3af';
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const priorityClass = PRIORITY_COLORS[ticket.priorityName || ''] || PRIORITY_COLORS['Standard'];

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
        {/* NCM Badge - prominent at top if applicable */}
        {isNCM && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              No Customer Match
            </span>
          </div>
        )}

        {/* Header: Customer Name + CSR Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
              {ticket.customerName || 'Unknown Customer'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
              {ticket.subject}
            </p>
          </div>
          {/* CSR Badge */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: getCsrColor(ticket.csrName) }}
            title={ticket.csrName || 'Unassigned'}
          >
            {getCsrInitials(ticket.csrName)}
          </div>
        </div>

        {/* Category/Service Type Badge */}
        {ticket.categoryName && (
          <div className="flex items-center gap-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              {ticket.categoryName}
            </span>
            {ticket.priorityName && ticket.priorityName !== 'Standard' && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', priorityClass)}>
                {ticket.priorityName}
              </span>
            )}
          </div>
        )}

        {/* Footer: Dates */}
        <div className="pt-1 border-t border-gray-100 dark:border-gray-700/50 space-y-0.5">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Entered:</span> {formatDate(ticket.createdAt)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Due:</span> {formatDate(ticket.dueDate)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Drag overlay version (used during drag)
export function ServiceTicketCardOverlay({ ticket }: { ticket: ServiceTicketItem }) {
  const getCsrInitials = (name: string | null) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase();
  };

  const getCsrColor = (name: string | null) => {
    if (!name) return '#9ca3af';
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500 shadow-xl p-3 w-64">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
            {ticket.subject}
          </h4>
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
          style={{ backgroundColor: getCsrColor(ticket.csrName) }}
          title={ticket.csrName || 'Unassigned'}
        >
          {getCsrInitials(ticket.csrName)}
        </div>
      </div>
    </div>
  );
}
