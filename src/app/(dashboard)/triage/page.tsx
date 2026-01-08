'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface TriageItem {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description?: string;
  aiSummary?: string;
  aiPriorityScore: number | null;
  aiPriorityReason?: string;
  customerId?: string;
  callId?: string;
  customer?: {
    id: string;
    name: string;
    phone?: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
  dueAt?: string;
  slaBreached: boolean;
  createdAt: string;
  ageMinutes: number;
}

interface Stats {
  byStatus: {
    pending: number;
    inProgress: number;
    escalated: number;
    completed: number;
    cancelled: number;
  };
  byPriority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  sla: {
    breached: number;
    dueSoon: number;
    healthy: number;
  };
  unassigned: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PRIORITY_CONFIG = {
  urgent: { label: 'URGENT', emoji: '🔴', color: 'bg-red-500 text-white' },
  high: { label: 'HIGH', emoji: '🟠', color: 'bg-orange-500 text-white' },
  medium: { label: 'MEDIUM', emoji: '🟡', color: 'bg-yellow-500 text-yellow-900' },
  low: { label: 'LOW', emoji: '⚪', color: 'bg-gray-200 text-gray-700' },
};

const TYPE_CONFIG: Record<string, { label: string; emoji: string }> = {
  call: { label: 'Call', emoji: '📞' },
  quote: { label: 'Quote', emoji: '📋' },
  claim: { label: 'Claim', emoji: '⚠️' },
  service: { label: 'Service', emoji: '🔧' },
  lead: { label: 'Lead', emoji: '🎯' },
  after_hours: { label: 'After Hours', emoji: '🌙' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  escalated: { label: 'Escalated', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function TriagePage() {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedItem, setSelectedItem] = useState<TriageItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.id) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch(err => console.error('Failed to fetch current user:', err));
  }, []);

  // =========================================================================
  // Data Fetching
  // =========================================================================
  
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/triage?status=${statusFilter}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load triage items:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadItems();
    // Auto-refresh every 15 seconds
    const interval = setInterval(loadItems, 15000);
    return () => clearInterval(interval);
  }, [loadItems]);

  // =========================================================================
  // Actions
  // =========================================================================

  const handleClaim = async (itemId: string) => {
    if (!currentUserId) {
      console.error('Cannot claim: user not loaded');
      return;
    }
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/triage/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', userId: currentUserId }),
      });
      if (res.ok) {
        loadItems();
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Claim failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (itemId: string, resolution: string) => {
    if (!currentUserId) {
      console.error('Cannot complete: user not loaded');
      return;
    }
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/triage/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', resolution, userId: currentUserId }),
      });
      if (res.ok) {
        loadItems();
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Complete failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================================
  // Helpers
  // =========================================================================

  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatSLA = (dueAt?: string, breached?: boolean) => {
    if (breached) {
      return <span className="text-red-600 font-medium">SLA BREACHED</span>;
    }
    if (!dueAt) return null;
    
    const due = new Date(dueAt);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    
    if (diff < 0) {
      return <span className="text-red-600 font-medium">Overdue</span>;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 1) {
      return <span className="text-orange-600 font-medium">{minutes}m remaining</span>;
    }
    return <span className="text-gray-500">{hours}h {minutes}m remaining</span>;
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Triage Queue</h1>
            <p className="text-sm text-gray-500 mt-1">
              AI-prioritized items needing attention
            </p>
          </div>
          
          {/* Quick Stats */}
          {stats && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.byPriority.urgent}</div>
                <div className="text-xs text-gray-500">Urgent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.byPriority.high}</div>
                <div className="text-xs text-gray-500">High</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.byStatus.pending}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.unassigned}</div>
                <div className="text-xs text-gray-500">Unassigned</div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          {['pending', 'in_progress', 'escalated', 'completed', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
              {stats && status !== 'all' && (
                <span className="ml-1 text-xs opacity-75">
                  ({stats.byStatus[status as keyof typeof stats.byStatus] || 0})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin text-3xl">⏳</div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">✅</div>
              <h3 className="text-lg font-medium text-gray-900">Queue Clear!</h3>
              <p className="text-gray-500">No items need attention right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    'bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md',
                    selectedItem?.id === item.id && 'ring-2 ring-blue-500 border-blue-500',
                    item.slaBreached && 'border-red-300 bg-red-50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    {/* Left: Priority + Type + Title */}
                    <div className="flex items-start gap-3">
                      {/* Priority Badge */}
                      <div
                        className={cn(
                          'px-2 py-1 rounded text-xs font-bold',
                          PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG]?.color || 'bg-gray-200'
                        )}
                        title={item.aiPriorityReason}
                      >
                        {item.aiPriorityScore ?? '?'}
                      </div>
                      
                      <div>
                        {/* Type + Title */}
                        <div className="flex items-center gap-2">
                          <span>{TYPE_CONFIG[item.type]?.emoji || '📋'}</span>
                          <span className="font-medium text-gray-900">{item.title}</span>
                        </div>
                        
                        {/* Customer Info */}
                        {item.customer && (
                          <div className="text-sm text-gray-600 mt-1">
                            {item.customer.name}
                            {item.customer.phone && (
                              <span className="text-gray-400 ml-2">• {item.customer.phone}</span>
                            )}
                          </div>
                        )}
                        
                        {/* Description preview */}
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Status + Age + SLA */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        STATUS_CONFIG[item.status]?.color || 'bg-gray-100'
                      )}>
                        {STATUS_CONFIG[item.status]?.label || item.status}
                      </span>
                      
                      <span className="text-xs text-gray-400">
                        {formatAge(item.ageMinutes)}
                      </span>
                      
                      {formatSLA(item.dueAt, item.slaBreached)}
                      
                      {item.assignedTo && (
                        <span className="text-xs text-blue-600">
                          → {item.assignedTo.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="w-96 border-l bg-gray-50 overflow-y-auto">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Item Details</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Priority Score */}
              <div className="bg-white rounded-lg border p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">AI Priority Score</span>
                  <span className={cn(
                    'px-3 py-1 rounded-full text-sm font-bold',
                    PRIORITY_CONFIG[selectedItem.priority as keyof typeof PRIORITY_CONFIG]?.color
                  )}>
                    {selectedItem.aiPriorityScore ?? '?'} / 100
                  </span>
                </div>
                {selectedItem.aiPriorityReason && (
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedItem.aiPriorityReason}
                  </p>
                )}
              </div>

              {/* Type + Title */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 uppercase mb-1">
                  {TYPE_CONFIG[selectedItem.type]?.emoji} {TYPE_CONFIG[selectedItem.type]?.label || selectedItem.type}
                </div>
                <h4 className="font-medium text-gray-900">{selectedItem.title}</h4>
              </div>

              {/* Customer */}
              {selectedItem.customer && (
                <div className="bg-white rounded-lg border p-3 mb-4">
                  <div className="text-xs text-gray-500 uppercase mb-2">Customer</div>
                  <div className="font-medium">{selectedItem.customer.name}</div>
                  {selectedItem.customer.phone && (
                    <div className="text-sm text-gray-500">{selectedItem.customer.phone}</div>
                  )}
                  <Link
                    href={`/customer/${selectedItem.customerId}`}
                    className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                  >
                    View Full Profile →
                  </Link>
                </div>
              )}

              {/* Description */}
              {selectedItem.description && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 uppercase mb-1">Description</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* AI Summary */}
              {selectedItem.aiSummary && (
                <div className="bg-blue-50 rounded-lg border border-blue-100 p-3 mb-4">
                  <div className="text-xs text-blue-700 uppercase mb-1">🤖 AI Summary</div>
                  <p className="text-sm text-gray-700">{selectedItem.aiSummary}</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t">
                {selectedItem.status === 'pending' && (
                  <button
                    onClick={() => handleClaim(selectedItem.id)}
                    disabled={actionLoading === selectedItem.id}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading === selectedItem.id ? 'Claiming...' : '✋ Claim This Item'}
                  </button>
                )}
                
                {selectedItem.status === 'in_progress' && (
                  <>
                    <button
                      onClick={() => {
                        const resolution = prompt('Enter resolution:');
                        if (resolution) handleComplete(selectedItem.id, resolution);
                      }}
                      disabled={actionLoading === selectedItem.id}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      ✓ Mark Complete
                    </button>
                    <button
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      ⬆️ Escalate
                    </button>
                  </>
                )}

                {selectedItem.customerId && (
                  <Link
                    href={`/customer/${selectedItem.customerId}`}
                    className="block w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-center"
                  >
                    👤 Open Customer Profile
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
