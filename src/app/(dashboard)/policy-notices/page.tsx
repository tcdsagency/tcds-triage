'use client';

import { useState, useEffect, useCallback } from 'react';
import PolicyNoticeCard, { PolicyNotice } from '@/components/features/PolicyNoticeCard';

// =============================================================================
// TYPES
// =============================================================================

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface PaginatedResponse {
  success: boolean;
  notices: PolicyNotice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    pending: number;
    assigned: number;
    reviewed: number;
    actioned: number;
    dismissed: number;
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function PolicyNoticesPage() {
  // State
  const [notices, setNotices] = useState<PolicyNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<PolicyNotice | null>(null);
  const [stats, setStats] = useState({
    pending: 0,
    assigned: 0,
    reviewed: 0,
    actioned: 0,
    dismissed: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    urgency: '',
    search: '',
  });

  // Users for assignment dropdown
  const [users, setUsers] = useState<User[]>([]);

  // Fetch notices
  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);
      if (filters.urgency) params.set('urgency', filters.urgency);
      if (filters.search) params.set('search', filters.search);
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      const response = await fetch(`/api/policy-notices?${params}`);
      const data: PaginatedResponse = await response.json();

      if (data.success) {
        setNotices(data.notices);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  // Fetch users for assignment
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNotices();
    fetchUsers();
  }, [fetchNotices, fetchUsers]);

  // Sync from Adapt API
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/policy-notices/sync?manual=true', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        // Refresh the list
        await fetchNotices();
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Handle notice action
  const handleAction = async (
    notice: PolicyNotice,
    action: 'assign' | 'review' | 'action' | 'dismiss' | 'send-zapier',
    data?: Record<string, string>
  ) => {
    try {
      if (action === 'send-zapier') {
        const response = await fetch(`/api/policy-notices/${notice.id}/send-to-zapier`, {
          method: 'POST',
        });
        const result = await response.json();
        if (result.success) {
          await fetchNotices();
          setSelectedNotice(null);
        } else {
          alert(`Failed to send to Zapier: ${result.error}`);
        }
        return;
      }

      const response = await fetch(`/api/policy-notices/${notice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      const result = await response.json();
      if (result.success) {
        await fetchNotices();
        setSelectedNotice(null);
      }
    } catch (error) {
      console.error('Error performing action:', error);
    }
  };

  // Total count
  const totalCount = stats.pending + stats.assigned + stats.reviewed + stats.actioned + stats.dismissed;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Policy Notices
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review and action policy notices from Adapt Insurance
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncing ? (
              <>
                <span className="animate-spin">&#x21bb;</span>
                Syncing...
              </>
            ) : (
              <>
                <span>&#x21bb;</span>
                Sync Now
              </>
            )}
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 mt-4">
          <StatBadge
            label="Pending"
            count={stats.pending}
            active={filters.status === 'pending'}
            color="gray"
            onClick={() => setFilters((f) => ({ ...f, status: f.status === 'pending' ? '' : 'pending' }))}
          />
          <StatBadge
            label="Assigned"
            count={stats.assigned}
            active={filters.status === 'assigned'}
            color="blue"
            onClick={() => setFilters((f) => ({ ...f, status: f.status === 'assigned' ? '' : 'assigned' }))}
          />
          <StatBadge
            label="Reviewed"
            count={stats.reviewed}
            active={filters.status === 'reviewed'}
            color="purple"
            onClick={() => setFilters((f) => ({ ...f, status: f.status === 'reviewed' ? '' : 'reviewed' }))}
          />
          <StatBadge
            label="Actioned"
            count={stats.actioned}
            active={filters.status === 'actioned'}
            color="green"
            onClick={() => setFilters((f) => ({ ...f, status: f.status === 'actioned' ? '' : 'actioned' }))}
          />
          <StatBadge
            label="Dismissed"
            count={stats.dismissed}
            active={filters.status === 'dismissed'}
            color="gray"
            onClick={() => setFilters((f) => ({ ...f, status: f.status === 'dismissed' ? '' : 'dismissed' }))}
          />
        </div>
      </div>

      <div className="flex h-[calc(100vh-180px)]">
        {/* Sidebar Filters */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Filters</h2>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, policy..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
            />
          </div>

          {/* Type Filter */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
            >
              <option value="">All Types</option>
              <option value="billing">Billing</option>
              <option value="policy">Policy</option>
              <option value="claim">Claim</option>
            </select>
          </div>

          {/* Urgency Filter */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Urgency
            </label>
            <select
              value={filters.urgency}
              onChange={(e) => setFilters((f) => ({ ...f, urgency: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
            >
              <option value="">All Urgencies</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(filters.status || filters.type || filters.urgency || filters.search) && (
            <button
              onClick={() => setFilters({ status: '', type: '', urgency: '', search: '' })}
              className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Clear Filters
            </button>
          )}

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {notices.length} of {pagination.total} notices
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin text-4xl">&#x21bb;</div>
            </div>
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <span className="text-4xl mb-2">📭</span>
              <p>No notices found</p>
              <button
                onClick={handleSync}
                className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Sync to fetch notices
              </button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {notices.map((notice) => (
                <PolicyNoticeCard
                  key={notice.id}
                  notice={notice}
                  isSelected={selectedNotice?.id === notice.id}
                  onSelect={() => setSelectedNotice(notice)}
                  onAction={(action) => {
                    if (action === 'assign') {
                      // Show assign modal
                      const userId = prompt('Enter user ID to assign:');
                      if (userId) {
                        handleAction(notice, action, { userId });
                      }
                    } else if (action === 'action') {
                      const actionTaken = prompt('Enter action taken (e.g., contact_customer, send_reminder):');
                      if (actionTaken) {
                        const actionDetails = prompt('Enter action details (optional):') || '';
                        // Get current user ID - for now use a placeholder
                        const userId = 'current-user-id';
                        handleAction(notice, action, { userId, actionTaken, actionDetails });
                      }
                    } else if (action === 'dismiss') {
                      const reviewNotes = prompt('Enter reason for dismissing (optional):') || '';
                      const userId = 'current-user-id';
                      handleAction(notice, action, { userId, reviewNotes });
                    } else {
                      handleAction(notice, action);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel (when notice selected) */}
        {selectedNotice && (
          <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                Notice Details
              </h2>
              <button
                onClick={() => setSelectedNotice(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <DetailRow label="Title" value={selectedNotice.title} />
              <DetailRow label="Type" value={selectedNotice.noticeType || 'N/A'} />
              <DetailRow label="Urgency" value={selectedNotice.urgency || 'N/A'} />
              {/* Priority Score */}
              {selectedNotice.priorityScore !== undefined && selectedNotice.priorityScore !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Priority</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    selectedNotice.priorityScore >= 80 ? 'bg-red-600 text-white' :
                    selectedNotice.priorityScore >= 65 ? 'bg-orange-500 text-white' :
                    selectedNotice.priorityScore >= 50 ? 'bg-yellow-400 text-yellow-900' :
                    'bg-gray-300 text-gray-700'
                  }`}>
                    {selectedNotice.priorityScore}/100
                  </span>
                </div>
              )}
              <DetailRow label="Status" value={selectedNotice.reviewStatus || 'N/A'} />
              <DetailRow label="Insured" value={selectedNotice.insuredName || 'N/A'} />
              <DetailRow label="Policy #" value={selectedNotice.policyNumber || 'N/A'} />
              <DetailRow label="Carrier" value={selectedNotice.carrier || 'N/A'} />

              {selectedNotice.amountDue && (
                <DetailRow label="Amount Due" value={`$${selectedNotice.amountDue}`} />
              )}
              {selectedNotice.dueDate && (
                <DetailRow label="Due Date" value={selectedNotice.dueDate} />
              )}
              {selectedNotice.claimNumber && (
                <DetailRow label="Claim #" value={selectedNotice.claimNumber} />
              )}

              {selectedNotice.description && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedNotice.description}
                  </p>
                </div>
              )}

              {selectedNotice.reviewNotes && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Review Notes</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                    {selectedNotice.reviewNotes}
                  </p>
                </div>
              )}

              {selectedNotice.actionTaken && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Action Taken</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {selectedNotice.actionTaken}
                  </p>
                </div>
              )}

              {/* Donna AI Call Guide */}
              {selectedNotice.donnaContext && (
                <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">&#128161;</span>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                      AI Call Guide
                    </h4>
                  </div>

                  {/* Recommended Action */}
                  {selectedNotice.donnaContext.recommendedAction && (
                    <div className="mb-3 p-2 bg-blue-100 dark:bg-blue-800/50 rounded">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Recommended Action</p>
                      <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold">
                        {selectedNotice.donnaContext.recommendedAction}
                      </p>
                    </div>
                  )}

                  {/* Talking Points */}
                  {selectedNotice.donnaContext.talkingPoints?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Talking Points</p>
                      <ul className="space-y-1">
                        {selectedNotice.donnaContext.talkingPoints.map((point: string, i: number) => (
                          <li key={i} className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">&#9679;</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Objection Handlers */}
                  {selectedNotice.donnaContext.objectionHandlers?.length > 0 && (
                    <div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">If Customer Says...</p>
                      <div className="space-y-2">
                        {selectedNotice.donnaContext.objectionHandlers.map((handler: { objection: string; response: string }, i: number) => (
                          <div key={i} className="text-sm">
                            <p className="text-blue-700 dark:text-blue-300 italic">&quot;{handler.objection}&quot;</p>
                            <p className="text-blue-900 dark:text-blue-100 mt-1 pl-2 border-l-2 border-blue-300">
                              {handler.response}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Churn Risk */}
                  {selectedNotice.donnaContext.churnRisk && (
                    <div className="mt-3 pt-2 border-t border-blue-200 dark:border-blue-700">
                      <span className="text-xs text-blue-700 dark:text-blue-300">Churn Risk: </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        selectedNotice.donnaContext.churnRisk === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                        selectedNotice.donnaContext.churnRisk === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                      }`}>
                        {selectedNotice.donnaContext.churnRisk.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {selectedNotice.reviewStatus === 'pending' && (
                <button
                  onClick={() => {
                    const userId = prompt('Enter user ID to assign:');
                    if (userId) {
                      handleAction(selectedNotice, 'assign', { userId });
                    }
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Assign to Agent
                </button>
              )}

              {selectedNotice.reviewStatus !== 'actioned' && selectedNotice.reviewStatus !== 'dismissed' && (
                <button
                  onClick={() => {
                    const actionTaken = prompt('Enter action taken:');
                    if (actionTaken) {
                      const actionDetails = prompt('Enter details (optional):') || '';
                      handleAction(selectedNotice, 'action', {
                        userId: 'current-user-id',
                        actionTaken,
                        actionDetails,
                      });
                    }
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Take Action
                </button>
              )}

              {selectedNotice.reviewStatus === 'actioned' && !selectedNotice.zapierWebhookSent && (
                <button
                  onClick={() => handleAction(selectedNotice, 'send-zapier')}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Send to AgencyZoom (Zapier)
                </button>
              )}

              {selectedNotice.reviewStatus !== 'dismissed' && selectedNotice.reviewStatus !== 'actioned' && (
                <button
                  onClick={() => {
                    const notes = prompt('Reason for dismissing (optional):') || '';
                    handleAction(selectedNotice, 'dismiss', {
                      userId: 'current-user-id',
                      reviewNotes: notes,
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatBadge({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: 'gray' | 'blue' | 'purple' | 'green';
  onClick: () => void;
}) {
  const colors = {
    gray: active ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800',
    blue: active ? 'bg-blue-200 dark:bg-blue-800' : 'bg-blue-100 dark:bg-blue-900/30',
    purple: active ? 'bg-purple-200 dark:bg-purple-800' : 'bg-purple-100 dark:bg-purple-900/30',
    green: active ? 'bg-green-200 dark:bg-green-800' : 'bg-green-100 dark:bg-green-900/30',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${colors[color]} ${
        active ? 'ring-2 ring-offset-2 ring-blue-500' : ''
      }`}
    >
      {label}: {count}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 font-medium">{value}</span>
    </div>
  );
}
