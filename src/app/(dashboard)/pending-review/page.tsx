'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PendingItemCard, { PendingItemCardSkeleton, type PendingItem } from '@/components/features/PendingItemCard';
import PendingCountsBar, { type PendingCounts } from '@/components/features/PendingCountsBar';
import BulkActionBar from '@/components/features/BulkActionBar';
import ReviewModal from '@/components/features/ReviewModal';
import CustomerSearchModal from '@/components/features/CustomerSearchModal';
import ReportIssueModal from '@/components/features/ReportIssueModal';
import ReviewedItemCard, { ReviewedItemCardSkeleton, type ReviewedItem } from '@/components/features/ReviewedItemCard';
import AssigneeSelectModal from '@/components/features/AssigneeSelectModal';
import DeleteModal from '@/components/features/DeleteModal';
import { hasFeatureAccess } from '@/lib/feature-permissions';

// =============================================================================
// TYPES
// =============================================================================

type MainView = 'pending' | 'reviewed';
type StatusFilter = 'all' | 'matched' | 'needs_review' | 'unmatched' | 'after_hours';
type TypeFilter = 'all' | 'wrapup' | 'message';
type ReviewedFilter = 'all' | 'auto_voided' | 'reviewed';

interface APIResponse {
  success: boolean;
  items: PendingItem[];
  counts: PendingCounts;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Status tabs now handled by PendingCountsBar component

// =============================================================================
// MAIN PAGE
// =============================================================================

// Alert threshold in seconds (1:30 = 90 seconds)
const ALERT_THRESHOLD_SECONDS = 90;
const ALERT_INTERVAL_MS = 60000; // Play sound every 60 seconds when alerting

// Snooze options in minutes
const SNOOZE_OPTIONS = [5, 10, 15] as const;

export default function PendingReviewPage() {
  // Main view state
  const [mainView, setMainView] = useState<MainView>('pending');

  // Pending items state
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
  const [reportIssueItem, setReportIssueItem] = useState<PendingItem | null>(null);
  const [assignSRItem, setAssignSRItem] = useState<PendingItem | null>(null);
  const [assignNCMItem, setAssignNCMItem] = useState<PendingItem | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [deleteModalItem, setDeleteModalItem] = useState<PendingItem | null>(null);
  const [editedSummaries, setEditedSummaries] = useState<Record<string, string>>({});

  // Reviewed items state
  const [reviewedItems, setReviewedItems] = useState<ReviewedItem[]>([]);
  const [reviewedCounts, setReviewedCounts] = useState({ total: 0, autoVoided: 0, reviewed: 0 });
  const [reviewedFilter, setReviewedFilter] = useState<ReviewedFilter>('all');
  const [reviewedLoading, setReviewedLoading] = useState(false);
  const [resubmitLoading, setResubmitLoading] = useState<string | null>(null);

  // Alert system state
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean> | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Snooze state
  const [snoozeUntil, setSnoozeUntil] = useState<Date | null>(null);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);

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
  // REVIEWED ITEMS FETCHING
  // ==========================================================================

  const fetchReviewedItems = useCallback(async () => {
    setReviewedLoading(true);
    try {
      const params = new URLSearchParams();
      if (reviewedFilter !== 'all') params.set('filter', reviewedFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/reviewed-items?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setReviewedItems(data.items || []);
        setReviewedCounts(data.counts || { total: 0, autoVoided: 0, reviewed: 0 });
      } else {
        console.error('Failed to fetch reviewed items:', data.error);
        toast.error('Failed to load reviewed items');
      }
    } catch (error) {
      console.error('Reviewed items fetch error:', error);
      toast.error('Failed to load reviewed items');
    } finally {
      setReviewedLoading(false);
    }
  }, [reviewedFilter]);

  // Fetch reviewed items when switching to that tab or filter changes
  useEffect(() => {
    if (mainView === 'reviewed') {
      fetchReviewedItems();
    }
  }, [mainView, fetchReviewedItems]);

  // Handle re-submit for review
  const handleResubmit = async (id: string) => {
    setResubmitLoading(id);
    try {
      const res = await fetch('/api/reviewed-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'resubmit' }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Item re-submitted for review');
        // Remove from reviewed list
        setReviewedItems((prev) => prev.filter((item) => item.id !== id));
        // Refresh pending items
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to re-submit item');
      }
    } catch (error) {
      console.error('Re-submit error:', error);
      toast.error('Failed to re-submit item');
    } finally {
      setResubmitLoading(null);
    }
  };

  // ==========================================================================
  // PENDING REVIEW ALERTS SYSTEM
  // ==========================================================================

  // Fetch user permissions on mount
  useEffect(() => {
    async function fetchUserPermissions() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
          setUserPermissions(data.user.featurePermissions || null);
          setUserRole(data.user.role);
          setCurrentUserId(data.user.id);
          // Check if alerts are enabled for this user
          const enabled = hasFeatureAccess('pendingReviewAlerts', data.user.featurePermissions, data.user.role);
          setAlertsEnabled(enabled);
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
      }
    }
    fetchUserPermissions();
  }, []);

  // Play alert tone using Web Audio API
  const playAlertTone = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create oscillator for alert tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Alert tone: two-tone pattern
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.15); // ~C#6
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3); // A5

      // Envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.17);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.3);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.32);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Clean up after sound finishes
      setTimeout(() => {
        audioContext.close();
      }, 600);
    } catch (err) {
      console.log('Web Audio not available:', err);
    }
  }, []);

  // Check if currently snoozed
  const isSnoozed = snoozeUntil && new Date() < snoozeUntil;

  // Handle snooze selection
  const handleSnooze = (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000);
    setSnoozeUntil(until);
    setShowSnoozeModal(false);
    toast.success(`Alerts snoozed for ${minutes} minutes`, {
      description: `Alerts will resume at ${until.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    });
  };

  // Clear snooze when all items are cleared
  useEffect(() => {
    if (items.length === 0 && snoozeUntil) {
      setSnoozeUntil(null);
    }
  }, [items.length, snoozeUntil]);

  // Auto-clear snooze when it expires
  useEffect(() => {
    if (!snoozeUntil) return;

    const timeUntilExpiry = snoozeUntil.getTime() - Date.now();
    if (timeUntilExpiry <= 0) {
      setSnoozeUntil(null);
      return;
    }

    const timeout = setTimeout(() => {
      setSnoozeUntil(null);
      toast.info('Snooze ended - alerts resumed');
    }, timeUntilExpiry);

    return () => clearTimeout(timeout);
  }, [snoozeUntil]);

  // Check for items waiting too long and trigger alerts
  useEffect(() => {
    if (!alertsEnabled) {
      // Clear any existing interval if alerts disabled
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
      return;
    }

    const checkAndAlert = () => {
      // Skip if snoozed
      if (snoozeUntil && new Date() < snoozeUntil) {
        return;
      }

      // Find items waiting longer than threshold (convert ageMinutes to seconds)
      const overdueItems = items.filter(item => (item.ageMinutes * 60) >= ALERT_THRESHOLD_SECONDS);

      if (overdueItems.length > 0) {
        // Play alert tone
        playAlertTone();

        // Show notification if browser supports it and permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pending Review Alert', {
            body: `${overdueItems.length} item(s) waiting over 90 seconds!`,
            icon: '/favicon.ico',
            tag: 'pending-review-alert', // Prevents duplicate notifications
            requireInteraction: true,
          });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
          // Request permission
          Notification.requestPermission();
        }

        // Show snooze modal automatically when alert triggers
        setShowSnoozeModal(true);
      }
    };

    // Initial check
    checkAndAlert();

    // Set up recurring interval
    alertIntervalRef.current = setInterval(checkAndAlert, ALERT_INTERVAL_MS);

    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [alertsEnabled, items, playAlertTone, snoozeUntil]);

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
    action: 'note' | 'ticket' | 'acknowledge' | 'skip' | 'void' | 'ncm'
  ) => {
    // For ticket (Create SR), show assignee selection modal
    if (action === 'ticket') {
      setAssignSRItem(item);
      return;
    }

    // Confirm void action
    if (action === 'void') {
      if (!confirm('Are you sure you want to void this item? It will be removed from the queue without any action.')) {
        return;
      }
    }

    // For NCM (No Customer Match), show assignee selection modal
    if (action === 'ncm') {
      setAssignNCMItem(item);
      return;
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
          // Include all message IDs for grouped SMS conversations
          messageIds: (item as any).messageIds,
          reviewerId: currentUserId,
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
        // Show success toast with undo for skip/void
        const actionMessages: Record<string, string> = {
          note: 'Note posted to AgencyZoom',
          ticket: 'Service request created',
          acknowledge: 'Message acknowledged',
          skip: 'Item skipped',
          void: 'Item voided',
          ncm: 'Posted to No Customer Match queue',
        };
        const canUndo = (action === 'skip' || action === 'void') && data.undoToken;
        toast.success(actionMessages[action] || 'Action completed', {
          duration: canUndo ? 5000 : 3000,
          action: canUndo ? {
            label: 'Undo',
            onClick: () => handleUndo(item.id, data.undoToken, item.type),
          } : undefined,
        });
        setLastError(null);
        // Update counts
        fetchItems();
      } else {
        const errorMsg = data.error || 'Action failed';
        toast.error(errorMsg);
        setLastError(errorMsg);
      }
    } catch (error) {
      console.error('Action error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to complete action';
      toast.error(errorMsg);
      setLastError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewModalAction = async (
    action: 'note' | 'ticket' | 'void',
    noteContent?: string,
    ticketDetails?: { subject?: string; assigneeAgentId?: number }
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
          ticketDetails,
          reviewerId: currentUserId,
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
        setLastError(null);
        // Show success with reminder about phone number
        toast.success('Customer matched successfully', {
          description: data.reminder || 'Please verify the customer\'s phone number is correct in AgencyZoom.',
          duration: 8000,
        });
      } else {
        const errorMsg = data.error || 'Match failed';
        toast.error(errorMsg);
        setLastError(errorMsg);
        // Keep modal open so user can report issue
      }
    } catch (error) {
      console.error('Match error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to match customer';
      toast.error(errorMsg);
      setLastError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle creating SR with selected assignee
  const handleAssignSR = async (assigneeId: number, assigneeName: string) => {
    if (!assignSRItem) return;

    const item = assignSRItem;
    const isLead = !!item.agencyzoomLeadId && !item.agencyzoomCustomerId;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/pending-review/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.type,
          action: 'ticket',
          customerId: item.agencyzoomCustomerId || item.agencyzoomLeadId,
          isLead,
          ticketDetails: {
            assigneeAgentId: assigneeId,
          },
          reviewerId: currentUserId,
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
        // Close modal
        setAssignSRItem(null);
        // Show success toast
        toast.success(`Service request created and assigned to ${assigneeName}`);
        setLastError(null);
        // Update counts
        fetchItems();
      } else {
        const errorMsg = data.error || 'Failed to create service request';
        toast.error(errorMsg);
        setLastError(errorMsg);
      }
    } catch (error) {
      console.error('SR creation error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to create service request';
      toast.error(errorMsg);
      setLastError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle creating NCM request with selected assignee
  const handleAssignNCM = async (assigneeId: number, assigneeName: string) => {
    if (!assignNCMItem) return;

    const item = assignNCMItem;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/pending-review/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.type,
          action: 'ncm',
          ticketDetails: {
            assigneeAgentId: assigneeId,
          },
          reviewerId: currentUserId,
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
        // Close modal
        setAssignNCMItem(null);
        // Show success toast
        toast.success(`NCM request created and assigned to ${assigneeName}`);
        setLastError(null);
        // Update counts
        fetchItems();
      } else {
        const errorMsg = data.error || 'Failed to create NCM request';
        toast.error(errorMsg);
        setLastError(errorMsg);
      }
    } catch (error) {
      console.error('NCM creation error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to create NCM request';
      toast.error(errorMsg);
      setLastError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle delete with reason
  const handleDelete = async (item: PendingItem, reason: string, notes?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/pending-review/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.type,
          action: 'delete',
          deleteReason: reason,
          deleteNotes: notes,
          reviewerId: currentUserId,
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
        // Close modal
        setDeleteModalItem(null);
        // Show success toast with undo option
        toast.success('Item deleted', {
          duration: 5000,
          action: data.undoToken ? {
            label: 'Undo',
            onClick: () => handleUndo(item.id, data.undoToken, item.type),
          } : undefined,
        });
        setLastError(null);
        // Update counts
        fetchItems();
      } else {
        const errorMsg = data.error || 'Failed to delete item';
        toast.error(errorMsg);
        setLastError(errorMsg);
      }
    } catch (error) {
      console.error('Delete error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete item';
      toast.error(errorMsg);
      setLastError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle undo action
  const handleUndo = async (itemId: string, undoToken: string, itemType: string = 'wrapup') => {
    try {
      const res = await fetch(`/api/pending-review/${itemId}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undoToken, itemType }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Action undone');
        // Refresh items list
        fetchItems();
      } else {
        toast.error(data.error || 'Undo failed - action may have expired');
      }
    } catch (error) {
      console.error('Undo error:', error);
      toast.error('Failed to undo action');
    }
  };

  // Handle edit summary
  const handleEditSummary = (itemId: string, newSummary: string) => {
    setEditedSummaries((prev) => ({ ...prev, [itemId]: newSummary }));
    // Update the item in the list to reflect the edit
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, summary: newSummary } : item
      )
    );
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
          reviewerId: currentUserId,
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
            {mainView === 'pending' ? 'Pending Review' : 'Review Log'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {mainView === 'pending'
              ? 'Review calls, messages, and leads awaiting action'
              : 'View completed and auto-voided items'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Snooze indicator */}
          {alertsEnabled && isSnoozed && snoozeUntil && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
              <span>Snoozed until {snoozeUntil.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              <button
                onClick={() => setSnoozeUntil(null)}
                className="ml-1 hover:text-amber-900 dark:hover:text-amber-200"
                title="Cancel snooze"
              >
                ✕
              </button>
            </div>
          )}
          <button
            onClick={mainView === 'pending' ? fetchItems : fetchReviewedItems}
            disabled={mainView === 'pending' ? loading : reviewedLoading}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              (mainView === 'pending' ? loading : reviewedLoading)
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
            )}
          >
            {(mainView === 'pending' ? loading : reviewedLoading) ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setMainView('pending')}
          className={cn(
            'px-4 py-2 font-semibold text-sm transition-colors border-b-2 -mb-px',
            mainView === 'pending'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          Pending
          {counts.total > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {counts.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainView('reviewed')}
          className={cn(
            'px-4 py-2 font-semibold text-sm transition-colors border-b-2 -mb-px',
            mainView === 'reviewed'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          Reviewed
          {reviewedCounts.total > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {reviewedCounts.total}
            </span>
          )}
        </button>
      </div>

      {/* PENDING VIEW */}
      {mainView === 'pending' && (
        <>
          {/* Unified Filter Bar */}
          <PendingCountsBar
            counts={counts}
            activeTypeFilter={typeFilter}
            activeStatusFilter={statusFilter}
            onTypeFilter={setTypeFilter}
            onStatusFilter={setStatusFilter}
            isLoading={loading}
          />

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
              onReportIssue={() => setReportIssueItem(item)}
              onDelete={() => setDeleteModalItem(item)}
              onEditSummary={(summary) => handleEditSummary(item.id, summary)}
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
        </>
      )}

      {/* REVIEWED VIEW */}
      {mainView === 'reviewed' && (
        <>
          {/* Reviewed Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Filter:</span>
            <button
              onClick={() => setReviewedFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                reviewedFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              All ({reviewedCounts.total})
            </button>
            <button
              onClick={() => setReviewedFilter('reviewed')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                reviewedFilter === 'reviewed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              Reviewed ({reviewedCounts.reviewed})
            </button>
            <button
              onClick={() => setReviewedFilter('auto_voided')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                reviewedFilter === 'auto_voided'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              Auto-Voided ({reviewedCounts.autoVoided})
            </button>
          </div>

          {/* Reviewed Content */}
          {reviewedLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <ReviewedItemCardSkeleton key={i} />
              ))}
            </div>
          ) : reviewedItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                No reviewed items
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                {reviewedFilter === 'auto_voided'
                  ? 'No auto-voided items found'
                  : reviewedFilter === 'reviewed'
                    ? 'No manually reviewed items found'
                    : 'Completed items will appear here'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {reviewedItems.map((item) => (
                <ReviewedItemCard
                  key={item.id}
                  item={item}
                  onResubmit={handleResubmit}
                  isLoading={resubmitLoading === item.id}
                />
              ))}
            </div>
          )}
        </>
      )}

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

      {/* Report Issue Modal */}
      {reportIssueItem && (
        <ReportIssueModal
          isOpen={!!reportIssueItem}
          onClose={() => {
            setReportIssueItem(null);
            setLastError(null);
          }}
          item={reportIssueItem}
          lastError={lastError || undefined}
        />
      )}

      {/* Assignee Selection Modal for Service Requests */}
      {assignSRItem && (
        <AssigneeSelectModal
          isOpen={!!assignSRItem}
          onClose={() => setAssignSRItem(null)}
          onSelect={handleAssignSR}
          title={`Assign Service Request for ${assignSRItem.contactName || 'Unknown'}`}
          isLoading={actionLoading}
        />
      )}

      {/* Assignee Selection Modal for NCM Requests */}
      {assignNCMItem && (
        <AssigneeSelectModal
          isOpen={!!assignNCMItem}
          onClose={() => setAssignNCMItem(null)}
          onSelect={handleAssignNCM}
          title={`Assign NCM Request for ${assignNCMItem.contactName || assignNCMItem.contactPhone || 'Unknown Caller'}`}
          isLoading={actionLoading}
        />
      )}

      {/* Delete Modal */}
      {deleteModalItem && (
        <DeleteModal
          isOpen={!!deleteModalItem}
          onClose={() => setDeleteModalItem(null)}
          onConfirm={(reason, notes) => handleDelete(deleteModalItem, reason, notes)}
          isLoading={actionLoading}
          itemInfo={{
            phone: deleteModalItem.contactPhone || 'Unknown',
            summary: deleteModalItem.summary || '',
          }}
        />
      )}

      {/* Snooze Alert Modal */}
      {showSnoozeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSnoozeModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <span className="text-3xl">🔔</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Pending Items Alert
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {items.filter(item => (item.ageMinutes * 60) >= ALERT_THRESHOLD_SECONDS).length} item(s) waiting over 90 seconds
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                Snooze alerts for:
              </p>
              <div className="grid grid-cols-3 gap-3">
                {SNOOZE_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => handleSnooze(minutes)}
                    className="px-4 py-3 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-xl font-semibold transition-colors"
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowSnoozeModal(false)}
                className="w-full mt-4 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
              >
                Dismiss (Keep Alerting)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
