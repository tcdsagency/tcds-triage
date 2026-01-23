'use client';

import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import type { CustomerContext } from '@/app/(dashboard)/triage-inbox/page';

interface CustomerContextPanelProps {
  context: CustomerContext | null;
  loading: boolean;
  selectedTicketId?: number;
  onSelectTicket: (ticketId: number) => void;
}

// Policy type emoji mapping
const POLICY_TYPE_EMOJI: Record<string, string> = {
  auto: '🚗',
  home: '🏠',
  homeowners: '🏠',
  renters: '🏢',
  umbrella: '☂️',
  flood: '🌊',
  life: '💚',
  commercial: '🏪',
  motorcycle: '🏍️',
  boat: '⛵',
  rv: '🚐',
  mobile_home: '🏘️',
};

// Client level colors
const CLIENT_LEVEL_COLORS: Record<string, string> = {
  VIP: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Premium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Standard: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  New: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function CustomerContextPanel({
  context,
  loading,
  selectedTicketId,
  onSelectTicket,
}: CustomerContextPanelProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-3/4 mb-2" />
          <div className="h-4 bg-muted rounded w-1/2 mb-1" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!context || !context.customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className="font-medium">No Customer Match</p>
        <p className="text-sm text-muted-foreground">Customer not found in system</p>
      </div>
    );
  }

  const { customer, policies, openTickets, recentCalls, recentMessages } = context;

  return (
    <div className="p-4 space-y-6">
      {/* Customer Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg">{customer.name}</h3>
            {customer.phone && (
              <p className="text-sm text-muted-foreground">
                {formatPhoneNumber(customer.phone)}
              </p>
            )}
            {customer.email && (
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {customer.email}
              </p>
            )}
          </div>
          {customer.clientLevel && (
            <span className={cn(
              'text-xs px-2 py-1 rounded-full font-medium',
              CLIENT_LEVEL_COLORS[customer.clientLevel] || CLIENT_LEVEL_COLORS.Standard
            )}>
              {customer.clientLevel}
            </span>
          )}
        </div>

        {/* AgencyZoom Link */}
        {customer.agencyzoomUrl && (
          <a
            href={customer.agencyzoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
          >
            View in AgencyZoom
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}

        {customer.isLead && (
          <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
            Lead
          </span>
        )}
      </div>

      {/* Open Tickets */}
      {openTickets.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <span>Open Tickets</span>
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
              {openTickets.length}
            </span>
          </h4>
          <div className="space-y-2">
            {openTickets.slice(0, 5).map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket.id)}
                className={cn(
                  'w-full text-left p-2 rounded border transition-colors',
                  selectedTicketId === ticket.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{ticket.id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ticket.daysOpen}d ago
                  </span>
                </div>
                <div className="text-sm font-medium truncate">
                  {ticket.subject}
                </div>
                {ticket.csrName && (
                  <div className="text-xs text-muted-foreground">
                    {ticket.csrName}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Policies */}
      {policies.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Active Policies</h4>
          <div className="space-y-2">
            {policies.slice(0, 5).map((policy, idx) => {
              const typeKey = policy.type.toLowerCase().replace(/[^a-z]/g, '');
              const emoji = POLICY_TYPE_EMOJI[typeKey] || '📋';

              return (
                <div key={idx} className="p-2 border border-border rounded">
                  <div className="flex items-center gap-2">
                    <span>{emoji}</span>
                    <span className="text-sm font-medium">{policy.policyNumber}</span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-6">
                    {policy.carrier}
                    {policy.premium && (
                      <span className="ml-2">
                        ${policy.premium.toLocaleString()}/yr
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Calls */}
      {recentCalls.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Calls</h4>
          <div className="space-y-2">
            {recentCalls.slice(0, 3).map((call) => (
              <div key={call.id} className="p-2 border border-border rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    call.direction === 'Inbound'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  )}>
                    {call.direction === 'Inbound' ? '↓' : '↑'} {call.agentName || 'Agent'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(call.date), { addSuffix: true })}
                  </span>
                </div>
                {call.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {call.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Messages */}
      {recentMessages.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Messages</h4>
          <div className="space-y-2">
            {recentMessages.slice(0, 3).map((msg) => (
              <div key={msg.id} className="p-2 border border-border rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    msg.direction === 'inbound'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  )}>
                    {msg.direction === 'inbound' ? '← In' : '→ Out'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.date), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {msg.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
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
