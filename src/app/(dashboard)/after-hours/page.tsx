'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface AfterHoursItem {
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
    email?: string;
  } | null;
  assignedTo?: {
    id: string;
    name: string;
  } | null;
  dueAt?: string;
  slaBreached: boolean;
  createdAt: string;
  ageMinutes: number;
  // After-hours specific
  messageType?: 'call' | 'voicemail' | 'sms';
  autoReplySent?: boolean;
  autoReplyMessage?: string;
  transcript?: string;
}

interface Stats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  byMessageType: {
    call: number;
    voicemail: number;
    sms: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PRIORITY_CONFIG = {
  urgent: { label: 'URGENT', color: 'bg-red-500 text-white' },
  high: { label: 'HIGH', color: 'bg-orange-500 text-white' },
  medium: { label: 'MEDIUM', color: 'bg-yellow-500 text-yellow-900' },
  low: { label: 'LOW', color: 'bg-gray-200 text-gray-700' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Needs Callback', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'Working', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Dismissed', color: 'bg-gray-100 text-gray-600' },
};

const MESSAGE_TYPE_CONFIG: Record<string, { label: string; emoji: string }> = {
  call: { label: 'Missed Call', emoji: '📞' },
  voicemail: { label: 'Voicemail', emoji: '🎤' },
  sms: { label: 'Text Message', emoji: '💬' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function AfterHoursQueuePage() {
  const [items, setItems] = useState<AfterHoursItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedItem, setSelectedItem] = useState<AfterHoursItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [callbackNote, setCallbackNote] = useState('');

  const currentUserId = 'current-user-id'; // Get from auth in real app

  // =========================================================================
  // Data Fetching
  // =========================================================================

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      // Filter triage items by type=after_hours
      const params = new URLSearchParams({
        type: 'after_hours',
        status: statusFilter === 'all' ? '' : statusFilter,
        limit: '50',
      });

      const res = await fetch(`/api/triage?${params}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.items);
        // Calculate after-hours specific stats
        const allItems = data.items as AfterHoursItem[];
        setStats({
          total: allItems.length,
          pending: allItems.filter(i => i.status === 'pending').length,
          inProgress: allItems.filter(i => i.status === 'in_progress').length,
          resolved: allItems.filter(i => i.status === 'completed').length,
          byMessageType: {
            call: allItems.filter(i => i.messageType === 'call').length,
            voicemail: allItems.filter(i => i.messageType === 'voicemail').length,
            sms: allItems.filter(i => i.messageType === 'sms').length,
          },
        });
      }
    } catch (err) {
      console.error('Failed to load after-hours items:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadItems();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadItems, 30000);
    return () => clearInterval(interval);
  }, [loadItems]);

  // =========================================================================
  // Actions
  // =========================================================================

  const handleClaim = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/triage/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', userId: currentUserId }),
      });
      if (res.ok) {
        loadItems();
      }
    } catch (err) {
      console.error('Claim failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (itemId: string, resolution: string) => {
    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/triage/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          resolution,
          userId: currentUserId
        }),
      });
      if (res.ok) {
        loadItems();
        setSelectedItem(null);
        setCallbackNote('');
      }
    } catch (err) {
      console.error('Resolve failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (itemId: string) => {
    if (!confirm('Dismiss this item without callback?')) return;

    setActionLoading(itemId);
    try {
      const res = await fetch(`/api/triage/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          reason: 'Dismissed - no callback needed',
          userId: currentUserId
        }),
      });
      if (res.ok) {
        loadItems();
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Dismiss failed:', err);
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

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌙</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">After Hours Queue</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Calls and messages received outside business hours
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                <div className="text-xs text-gray-500">Needs Callback</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                <div className="text-xs text-gray-500">Working</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
                <div className="text-xs text-gray-500">Resolved Today</div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          {['pending', 'in_progress', 'completed', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
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
              <div className="animate-spin text-3xl">🌙</div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">🌟</div>
              <h3 className="text-lg font-medium text-gray-900">All Caught Up!</h3>
              <p className="text-gray-500">No after-hours items need attention.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    'bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md',
                    selectedItem?.id === item.id && 'ring-2 ring-indigo-500 border-indigo-500',
                    item.ageMinutes > 480 && item.status === 'pending' && 'border-amber-300 bg-amber-50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    {/* Left Side */}
                    <div className="flex items-start gap-3">
                      {/* Message Type Icon */}
                      <div className="text-2xl">
                        {MESSAGE_TYPE_CONFIG[item.messageType || 'call']?.emoji || '📞'}
                      </div>

                      <div>
                        {/* Customer or Phone */}
                        <div className="font-medium text-gray-900">
                          {item.customer?.name || item.title}
                        </div>

                        {item.customer?.phone && (
                          <div className="text-sm text-gray-600">
                            {item.customer.phone}
                          </div>
                        )}

                        {/* Description preview */}
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        {/* Auto-reply indicator */}
                        {item.autoReplySent && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                            <span>✓</span>
                            <span>Auto-reply sent</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        STATUS_CONFIG[item.status]?.color || 'bg-gray-100'
                      )}>
                        {STATUS_CONFIG[item.status]?.label || item.status}
                      </span>

                      <span className="text-sm text-gray-500">
                        {formatDateTime(item.createdAt)}
                      </span>

                      <span className={cn(
                        'text-xs',
                        item.ageMinutes > 480 ? 'text-amber-600 font-medium' : 'text-gray-400'
                      )}>
                        {formatAge(item.ageMinutes)}
                      </span>

                      {item.assignedTo && (
                        <span className="text-xs text-indigo-600">
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
          <div className="w-[400px] border-l bg-gray-50 overflow-y-auto flex flex-col">
            <div className="p-4 flex-1">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {MESSAGE_TYPE_CONFIG[selectedItem.messageType || 'call']?.emoji}
                  </span>
                  <span className="text-sm font-medium text-gray-500">
                    {MESSAGE_TYPE_CONFIG[selectedItem.messageType || 'call']?.label}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Customer Info */}
              <div className="bg-white rounded-lg border p-4 mb-4">
                {selectedItem.customer ? (
                  <>
                    <div className="font-semibold text-lg text-gray-900">
                      {selectedItem.customer.name}
                    </div>
                    <div className="text-gray-600 mt-1">
                      {selectedItem.customer.phone}
                    </div>
                    {selectedItem.customer.email && (
                      <div className="text-gray-500 text-sm">
                        {selectedItem.customer.email}
                      </div>
                    )}
                    <Link
                      href={`/customer/${selectedItem.customerId}`}
                      className="text-sm text-indigo-600 hover:underline mt-2 inline-block"
                    >
                      View Full Profile →
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-lg text-gray-900">
                      Unknown Caller
                    </div>
                    <div className="text-gray-600 mt-1">
                      {selectedItem.title}
                    </div>
                    <button className="mt-3 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">
                      + Create Lead
                    </button>
                  </>
                )}
              </div>

              {/* Received Time */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 uppercase mb-1">Received</div>
                <div className="text-sm text-gray-900">
                  {formatDateTime(selectedItem.createdAt)}
                  <span className="text-gray-500 ml-2">
                    ({formatAge(selectedItem.ageMinutes)})
                  </span>
                </div>
              </div>

              {/* Message Content / Transcript */}
              {(selectedItem.description || selectedItem.transcript) && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 uppercase mb-1">
                    {selectedItem.messageType === 'voicemail' ? 'Voicemail Transcript' : 'Message'}
                  </div>
                  <div className="bg-white rounded-lg border p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedItem.transcript || selectedItem.description}
                  </div>
                </div>
              )}

              {/* Auto-Reply Sent */}
              {selectedItem.autoReplySent && (
                <div className="bg-green-50 rounded-lg border border-green-200 p-3 mb-4">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-1">
                    <span>✓</span>
                    <span>Auto-Reply Sent</span>
                  </div>
                  {selectedItem.autoReplyMessage && (
                    <p className="text-sm text-green-600 italic">
                      "{selectedItem.autoReplyMessage}"
                    </p>
                  )}
                </div>
              )}

              {/* AI Summary */}
              {selectedItem.aiSummary && (
                <div className="bg-indigo-50 rounded-lg border border-indigo-100 p-3 mb-4">
                  <div className="text-xs text-indigo-700 uppercase mb-1">🤖 AI Summary</div>
                  <p className="text-sm text-gray-700">{selectedItem.aiSummary}</p>
                </div>
              )}

              {/* Callback Notes */}
              {selectedItem.status === 'in_progress' && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 uppercase mb-1">Callback Notes</div>
                  <textarea
                    value={callbackNote}
                    onChange={(e) => setCallbackNote(e.target.value)}
                    placeholder="Add notes about the callback..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t bg-white p-4 space-y-2">
              {selectedItem.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleClaim(selectedItem.id)}
                    disabled={actionLoading === selectedItem.id}
                    className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    {actionLoading === selectedItem.id ? 'Claiming...' : '📞 Claim & Call Back'}
                  </button>
                  <button
                    onClick={() => handleDismiss(selectedItem.id)}
                    disabled={actionLoading === selectedItem.id}
                    className="w-full px-4 py-2 text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    Dismiss (No Callback Needed)
                  </button>
                </>
              )}

              {selectedItem.status === 'in_progress' && (
                <>
                  <button
                    onClick={() => handleResolve(selectedItem.id, callbackNote || 'Callback completed')}
                    disabled={actionLoading === selectedItem.id}
                    className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {actionLoading === selectedItem.id ? 'Saving...' : '✓ Mark Resolved'}
                  </button>
                  <div className="flex gap-2">
                    <a
                      href={`tel:${selectedItem.customer?.phone}`}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-center text-sm"
                    >
                      📞 Call
                    </a>
                    <a
                      href={`sms:${selectedItem.customer?.phone}`}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-center text-sm"
                    >
                      💬 Text
                    </a>
                  </div>
                </>
              )}

              {selectedItem.status === 'completed' && (
                <div className="text-center py-4">
                  <div className="text-green-600 text-lg mb-1">✓ Resolved</div>
                  <p className="text-sm text-gray-500">This item has been completed</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
