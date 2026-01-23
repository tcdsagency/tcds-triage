'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TriageQueuePanel from '@/components/features/triage-inbox/TriageQueuePanel';
import ItemDetailPanel from '@/components/features/triage-inbox/ItemDetailPanel';
import CustomerContextPanel from '@/components/features/triage-inbox/CustomerContextPanel';

// =============================================================================
// TYPES
// =============================================================================

export interface TriageQueueItem {
  id: string;
  type: 'wrapup' | 'message';
  customerName: string | null;
  customerPhone: string | null;
  summary: string | null;
  transcript: string | null;
  createdAt: string;
  agentName: string | null;
  direction: string;
  status: string;
  aiTriageRecommendation?: {
    suggestedAction: 'append' | 'create' | 'dismiss';
    confidence: number;
    reasoning: string;
    relatedTickets?: Array<{
      ticketId: number;
      similarity: number;
      subject: string;
      csrName: string | null;
    }>;
  } | null;
  // Customer matching
  matchedCustomerId: string | null;
  matchedAgencyzoomId: string | null;
}

export interface CustomerContext {
  customer: {
    id: string;
    agencyzoomId: string | null;
    hawksoftId: string | null;
    name: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    clientLevel: string | null;
    agencyzoomUrl: string | null;
    isLead: boolean;
  } | null;
  policies: Array<{
    policyNumber: string;
    type: string;
    carrier: string;
    status: string;
    premium: number | null;
    expirationDate: string | null;
  }>;
  openTickets: Array<{
    id: number;
    subject: string;
    stageName: string | null;
    csrName: string | null;
    createdAt: string;
    daysOpen: number;
    priorityName: string | null;
    categoryName: string | null;
  }>;
  recentCalls: Array<{
    id: string;
    date: string;
    summary: string | null;
    agentName: string | null;
    direction: string;
    duration: number | null;
  }>;
  recentMessages: Array<{
    id: string;
    date: string;
    body: string;
    direction: string;
  }>;
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TriageInboxPage() {
  // Queue data
  const [queueItems, setQueueItems] = useState<TriageQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item
  const [selectedItem, setSelectedItem] = useState<TriageQueueItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Customer context for selected item
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  // AI recommendation loading
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const fetchQueueItems = useCallback(async () => {
    try {
      const res = await fetch('/api/service-pipeline');
      const data = await res.json();

      if (data.success) {
        // Get triage items from the service pipeline response
        const triageItems = data.items?.triage || [];

        // Transform triage items to queue items
        const items: TriageQueueItem[] = triageItems.map((t: any) => ({
          id: t.id,
          type: t.itemType || 'wrapup',
          customerName: t.contactName,
          customerPhone: t.contactPhone,
          summary: t.summary,
          transcript: t.transcript || null,
          createdAt: t.timestamp,
          agentName: t.handledBy || t.handledByAgent?.name || null,
          direction: t.direction === 'inbound' ? 'Inbound' : 'Outbound',
          status: 'pending_review',
          aiTriageRecommendation: null, // Will be fetched on demand
          matchedCustomerId: null,
          matchedAgencyzoomId: t.agencyzoomCustomerId || t.agencyzoomLeadId || null,
        }));
        setQueueItems(items);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch queue items');
      }
    } catch (err) {
      console.error('Queue fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchQueueItems();
    const interval = setInterval(fetchQueueItems, 30000);
    return () => clearInterval(interval);
  }, [fetchQueueItems]);

  // ==========================================================================
  // CUSTOMER CONTEXT FETCHING
  // ==========================================================================

  const fetchCustomerContext = useCallback(async (item: TriageQueueItem) => {
    setContextLoading(true);
    try {
      // Try to fetch by matched customer ID or phone
      let url = '/api/triage/customer-context';
      if (item.matchedAgencyzoomId) {
        url += `?agencyzoomId=${item.matchedAgencyzoomId}`;
      } else if (item.matchedCustomerId) {
        url += `?customerId=${item.matchedCustomerId}`;
      } else if (item.customerPhone) {
        const normalized = item.customerPhone.replace(/\D/g, '').slice(-10);
        url += `?phone=${normalized}`;
      } else {
        setCustomerContext(null);
        setContextLoading(false);
        return;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setCustomerContext(data);
      } else {
        setCustomerContext(null);
      }
    } catch (err) {
      console.error('Customer context fetch error:', err);
      setCustomerContext(null);
    } finally {
      setContextLoading(false);
    }
  }, []);

  // ==========================================================================
  // AI RECOMMENDATION FETCHING
  // ==========================================================================

  const fetchAIRecommendation = useCallback(async (item: TriageQueueItem) => {
    if (item.aiTriageRecommendation) return; // Already has recommendation

    setRecommendationLoading(true);
    try {
      const res = await fetch('/api/triage/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          itemType: item.type,
          customerId: item.matchedCustomerId || item.matchedAgencyzoomId,
        }),
      });

      const data = await res.json();

      if (data.success && data.recommendation) {
        // Update the item with the recommendation
        setQueueItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, aiTriageRecommendation: data.recommendation }
              : i
          )
        );

        // Update selected item if it's the same
        if (selectedItem?.id === item.id) {
          setSelectedItem((prev) =>
            prev ? { ...prev, aiTriageRecommendation: data.recommendation } : prev
          );
        }
      }
    } catch (err) {
      console.error('AI recommendation error:', err);
    } finally {
      setRecommendationLoading(false);
    }
  }, [selectedItem?.id]);

  // ==========================================================================
  // ITEM SELECTION
  // ==========================================================================

  const handleSelectItem = useCallback(
    (item: TriageQueueItem, index: number) => {
      setSelectedItem(item);
      setSelectedIndex(index);

      // Fetch customer context
      fetchCustomerContext(item);

      // Fetch AI recommendation if not already present
      if (!item.aiTriageRecommendation) {
        fetchAIRecommendation(item);
      }
    },
    [fetchCustomerContext, fetchAIRecommendation]
  );

  // Auto-select first item when queue loads
  useEffect(() => {
    if (queueItems.length > 0 && !selectedItem) {
      handleSelectItem(queueItems[0], 0);
    }
  }, [queueItems, selectedItem, handleSelectItem]);

  // ==========================================================================
  // KEYBOARD NAVIGATION
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          // Next item
          if (selectedIndex < queueItems.length - 1) {
            handleSelectItem(queueItems[selectedIndex + 1], selectedIndex + 1);
          }
          e.preventDefault();
          break;

        case 'k':
        case 'ArrowUp':
          // Previous item
          if (selectedIndex > 0) {
            handleSelectItem(queueItems[selectedIndex - 1], selectedIndex - 1);
          }
          e.preventDefault();
          break;

        case 'a':
          // Append (if AI recommends)
          if (selectedItem?.aiTriageRecommendation?.suggestedAction === 'append') {
            // TODO: Open append modal
          }
          break;

        case 'c':
          // Create new ticket
          // TODO: Open create modal
          break;

        case 'd':
          // Dismiss
          // TODO: Open dismiss modal
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, queueItems, selectedItem, handleSelectItem]);

  // ==========================================================================
  // TRIAGE ACTIONS
  // ==========================================================================

  const handleAppend = useCallback(
    async (ticketId: number, notes?: string) => {
      if (!selectedItem) return;

      try {
        const res = await fetch(`/api/triage/${selectedItem.id}/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId, notes }),
        });

        const data = await res.json();

        if (data.success) {
          toast.success(`Appended to ticket #${ticketId}`);
          // Remove from queue and select next
          const newItems = queueItems.filter((i) => i.id !== selectedItem.id);
          setQueueItems(newItems);
          if (newItems.length > 0) {
            const nextIndex = Math.min(selectedIndex, newItems.length - 1);
            handleSelectItem(newItems[nextIndex], nextIndex);
          } else {
            setSelectedItem(null);
            setCustomerContext(null);
          }
        } else {
          toast.error(data.error || 'Failed to append');
        }
      } catch (err) {
        toast.error('Failed to append to ticket');
      }
    },
    [selectedItem, queueItems, selectedIndex, handleSelectItem]
  );

  const handleDismiss = useCallback(
    async (reason: string) => {
      if (!selectedItem) return;

      try {
        const res = await fetch(`/api/triage/${selectedItem.id}/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });

        const data = await res.json();

        if (data.success) {
          toast.success('Item dismissed');
          // Remove from queue and select next
          const newItems = queueItems.filter((i) => i.id !== selectedItem.id);
          setQueueItems(newItems);
          if (newItems.length > 0) {
            const nextIndex = Math.min(selectedIndex, newItems.length - 1);
            handleSelectItem(newItems[nextIndex], nextIndex);
          } else {
            setSelectedItem(null);
            setCustomerContext(null);
          }
        } else {
          toast.error(data.error || 'Failed to dismiss');
        }
      } catch (err) {
        toast.error('Failed to dismiss item');
      }
    },
    [selectedItem, queueItems, selectedIndex, handleSelectItem]
  );

  const handleCreate = useCallback(async () => {
    // TODO: Open create ticket modal with pre-filled data
    toast.info('Create ticket modal coming soon');
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Triage Inbox</h1>
            <p className="text-sm text-muted-foreground">
              {queueItems.length} items pending review
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-1 bg-muted rounded">j/k</span>
            <span>navigate</span>
            <span className="px-2 py-1 bg-muted rounded ml-2">a</span>
            <span>append</span>
            <span className="px-2 py-1 bg-muted rounded ml-2">c</span>
            <span>create</span>
            <span className="px-2 py-1 bg-muted rounded ml-2">d</span>
            <span>dismiss</span>
          </div>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Queue */}
        <div className="w-80 flex-none border-r border-border overflow-y-auto">
          <TriageQueuePanel
            items={queueItems}
            selectedItemId={selectedItem?.id || null}
            loading={loading}
            onSelectItem={handleSelectItem}
          />
        </div>

        {/* Center Panel: Item Detail */}
        <div className="flex-1 overflow-y-auto">
          <ItemDetailPanel
            item={selectedItem}
            customerContext={customerContext}
            recommendationLoading={recommendationLoading}
            onAppend={handleAppend}
            onDismiss={handleDismiss}
            onCreate={handleCreate}
          />
        </div>

        {/* Right Panel: Customer Context */}
        <div className="w-80 flex-none border-l border-border overflow-y-auto">
          <CustomerContextPanel
            context={customerContext}
            loading={contextLoading}
            selectedTicketId={
              selectedItem?.aiTriageRecommendation?.relatedTickets?.[0]?.ticketId
            }
            onSelectTicket={(ticketId) => {
              // When user selects a ticket, trigger append
              handleAppend(ticketId);
            }}
          />
        </div>
      </div>
    </div>
  );
}
