'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PendingItemCard, { PendingItemCardSkeleton, type PendingItem } from '@/components/features/PendingItemCard';
import PendingCountsBar, { type PendingCounts } from '@/components/features/PendingCountsBar';
import BulkActionBar from '@/components/features/BulkActionBar';
import ReviewModal from '@/components/features/ReviewModal';
import CustomerSearchModal from '@/components/features/CustomerSearchModal';

// =============================================================================
// TYPES
// =============================================================================

type StatusFilter = 'all' | 'matched' | 'needs_review' | 'unmatched' | 'after_hours';
type TypeFilter = 'all' | 'wrapup' | 'message';

interface APIResponse {
  success: boolean;
  items: PendingItem[];
  counts: PendingCounts;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_TABS: { key: StatusFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'matched', label: 'Matched', icon: '✓' },
  { key: 'needs_review', label: 'Needs Review', icon: '?' },
  { key: 'unmatched', label: 'No Match', icon: '+' },
  { key: 'after_hours', label: 'After Hours', icon: '🌙' },
];

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PendingReviewPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [counts, setCounts] = useState<PendingCounts>({
    wrapups: 0,
    messages: 0,
    leads: 0,
    total: 0,
    byStatus: { matched: 0, needsReview: 0, unmatched: 0, afterHours: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedItems, setSelectedItems] = useState<PendingItem[]>([]);
  const [selectedItemForReview, setSelectedItemForReview] = useState<PendingItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewModalItem, setReviewModalItem] = useState<PendingItem | null>(null);
  const [findMatchItem, setFindMatchItem] = useState<PendingItem | null>(null);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const res = await fetch(`/api/pending-review?${params.toString()}`);
      const data: APIResponse = await res.json();

      if (data.success) {
        setItems(data.items);
        setCounts(data.counts);
      } else {
        console.error('Failed to fetch items:', data.error);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchItems();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchItems, 30000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  // ==========================================================================
  // SELECTION HANDLERS
  // ==========================================================================

  const handleSelectItem = (item: PendingItem) => {
    setSelectedItemForReview(item);
  };

  const handleCheckItem = (item: PendingItem, checked: boolean) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, item]);
    } else {
      setSelectedItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  const handleSelectAll = () => {
    setSelectedItems(filteredItems);
  };

  const handleClearSelection = () => {
    setSelectedItems([]);
  };

  // ==========================================================================
  // ACTION HANDLERS
  // ==========================================================================

  const handleQuickAction = async (
    item: PendingItem,
    action: 'note' | 'ticket' | 'acknowledge' | 'skip' | 'void'
  ) => {
    // Confirm void action
    if (action === 'void') {
      if (!confirm('Are you sure you want to void this item? It will be removed from the queue without any action.')) {
        return;
      }
    }

    // Determine if this is a lead (has leadId but no customerId, or contactType is 'lead')
    const isLead = !!item.agencyzoomLeadId && !item.agencyzoomCustomerId;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/pending-review/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.type,
          action,
          customerId: item.agencyzoomCustomerId || item.agencyzoomLeadId,
          isLead,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Remove item from list
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setSelectedItems((prev) => prev.filter((i) => i.id !== item.id));
        if (selectedItemForReview?.id === item.id) {
          setSelectedItemForReview(null);
        }
        // Show success toast
        const actionMessages: Record<string, string> = {
          note: 'Note posted to AgencyZoom',
          ticket: 'Service request created',
          acknowledge: 'Message acknowledged',
          skip: 'Item skipped',
          void: 'Item voided',
        };
        toast.success(actionMessages[action] || 'Action completed');
        // Update counts
        fetchItems();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Action error:', error);
      toast.error('Failed to complete action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewModalAction = async (
    action: 'note' | 'ticket' | 'void',
    noteContent?: string
  ) => {
    if (!reviewModalItem) return;

    // Determine if this is a lead
    const isLead = !!reviewModalItem.agencyzoomLeadId && !reviewModalItem.agencyzoomCustomerId;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/pending-review/${reviewModalItem.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: reviewModalItem.type,
          action,
          customerId: reviewModalItem.agencyzoomCustomerId || reviewModalItem.agencyzoomLeadId,
          isLead,
          noteContent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Remove item from list
        setItems((prev) => prev.filter((i) => i.id !== reviewModalItem.id));
        setSelectedItems((prev) => prev.filter((i) => i.id !== reviewModalItem.id));
        if (selectedItemForReview?.id === reviewModalItem.id) {
          setSelectedItemForReview(null);
        }
        // Close modal
        setReviewModalItem(null);
        // Show success toast
        const actionMessages: Record<string, string> = {
          note: 'Note posted to AgencyZoom',
          ticket: 'Service request created in AgencyZoom',
          void: 'Item voided',
        };
        toast.success(actionMessages[action] || 'Action completed');
        // Update counts
        fetchItems();
      } else {
        toast.error(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Review action error:', error);
      toast.error('Failed to complete action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCustomerMatch = async (customer: {
    id: string;
    agencyzoomId: string | null;
    displayName: string;
    isLead: boolean;
  }) => {
    if (!findMatchItem) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/pending-review/${findMatchItem.id}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: findMatchItem.type,
          customerId: customer.agencyzoomId || customer.id,
          customerName: customer.displayName,
          isLead: customer.isLead,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update item in list with new match info
        setItems((prev) =>
          prev.map((item) =>
            item.id === findMatchItem.id
              ? {
                  ...item,
                  matchStatus: 'matched' as const,
                  contactName: customer.displayName,
                  agencyzoomCustomerId: customer.isLead ? undefined : (customer.agencyzoomId || customer.id),
                  agencyzoomLeadId: customer.isLead ? (customer.agencyzoomId || customer.id) : undefined,
                }
              : item
          )
        );
        // Close modal
        setFindMatchItem(null);
        // Show success with reminder about phone number
        toast.success('Customer matched successfully', {
          description: data.reminder || 'Please verify the customer\'s phone number is correct in AgencyZoom.',
          duration: 8000,
        });
      } else {
        toast.error(data.error || 'Match failed');
      }
    } catch (error) {
      console.error('Match error:', error);
      toast.error('Failed to match customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAction = async (
    action: 'note' | 'ticket' | 'acknowledge' | 'skip' | 'delete'
  ) => {
    if (selectedItems.length === 0) return;

    const confirmMsg =
      action === 'delete'
        ? `Are you sure you want to delete ${selectedItems.length} items?`
        : `Process ${selectedItems.length} items as ${action}?`;

    if (!confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/pending-review/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: selectedItems.map((i) => i.id),
          items: selectedItems.map((i) => ({
            id: i.id,
            type: i.type,
            customerId: i.agencyzoomCustomerId || i.agencyzoomLeadId,
          })),
          action,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Remove processed items
        const processedIds = new Set(selectedItems.map((i) => i.id));
        setItems((prev) => prev.filter((i) => !processedIds.has(i.id)));
        setSelectedItems([]);
        setSelectedItemForReview(null);
        // Refresh counts
        fetchItems();
      } else {
        alert(data.error || 'Bulk action failed');
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      alert('Failed to complete bulk action');
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================================
  // FILTERING
  // ==========================================================================

  const filteredItems = items.filter((item) => {
    if (statusFilter !== 'all' && item.matchStatus !== statusFilter) return false;
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    return true;
  });

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pending Review
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Review calls, messages, and leads awaiting action
          </p>
        </div>
        <button
          onClick={fetchItems}
          disabled={loading}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            loading
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
          )}
        >
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {/* Counts Bar */}
      <PendingCountsBar
        counts={counts}
        activeTypeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        isLoading={loading}
      />

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        {STATUS_TABS.map((tab) => {
          const tabCount =
            tab.key === 'all'
              ? counts.total
              : tab.key === 'matched'
              ? counts.byStatus.matched
              : tab.key === 'needs_review'
              ? counts.byStatus.needsReview
              : tab.key === 'unmatched'
              ? counts.byStatus.unmatched
              : counts.byStatus.afterHours;

          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs',
                  statusFilter === tab.key
                    ? 'bg-white/20'
                    : 'bg-black/10 dark:bg-white/10'
                )}
              >
                {tabCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <PendingItemCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">
            {statusFilter === 'all' ? '✅' : '🔍'}
          </div>
          <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            {statusFilter === 'all' ? 'All caught up!' : 'No items found'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {statusFilter === 'all'
              ? 'No pending items to review. Great work!'
              : `No items with status "${statusFilter.replace('_', ' ')}"`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <PendingItemCard
              key={item.id}
              item={item}
              isSelected={selectedItemForReview?.id === item.id}
              isChecked={selectedItems.some((i) => i.id === item.id)}
              onSelect={() => handleSelectItem(item)}
              onCheck={(checked) => handleCheckItem(item, checked)}
              onQuickAction={(action) => handleQuickAction(item, action)}
              onReviewClick={() => setReviewModalItem(item)}
              onFindMatch={() => setFindMatchItem(item)}
            />
          ))}
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedItems={selectedItems}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkAction={handleBulkAction}
        totalItems={filteredItems.length}
        isLoading={actionLoading}
      />

      {/* Review Modal */}
      {reviewModalItem && (
        <ReviewModal
          item={reviewModalItem}
          isOpen={!!reviewModalItem}
          onClose={() => setReviewModalItem(null)}
          onAction={handleReviewModalAction}
          isLoading={actionLoading}
        />
      )}

      {/* Customer Search Modal for manual matching */}
      {findMatchItem && (
        <CustomerSearchModal
          isOpen={!!findMatchItem}
          onClose={() => setFindMatchItem(null)}
          onSelect={handleCustomerMatch}
          initialPhone={findMatchItem.contactPhone}
          title={`Find Match for ${findMatchItem.contactName || findMatchItem.contactPhone || 'Unknown'}`}
        />
      )}
    </div>
  );
}
