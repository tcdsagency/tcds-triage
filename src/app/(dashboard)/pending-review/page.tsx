'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ServiceKanbanBoard,
  TicketDetailPanel,
  type StageConfig,
} from '@/components/features/service-pipeline';
import type { ServiceTicketItem, TriageItem, Employee } from '@/app/api/service-pipeline/route';
import AssigneeSelectModal from '@/components/features/AssigneeSelectModal';
import CustomerSearchModal from '@/components/features/CustomerSearchModal';
import DeleteModal from '@/components/features/DeleteModal';
import { hasFeatureAccess } from '@/lib/feature-permissions';

// =============================================================================
// TYPES
// =============================================================================

interface PipelineData {
  stages: StageConfig[];
  items: {
    triage: TriageItem[];
    [key: number]: ServiceTicketItem[];
  };
  employees: Employee[];
  counts: Record<string | number, number>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ALERT_THRESHOLD_SECONDS = 90;
const ALERT_INTERVAL_MS = 60000;
const SNOOZE_OPTIONS = [5, 10, 15] as const;

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PendingReviewPage() {
  // Pipeline data state
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item for detail panel
  const [selectedItem, setSelectedItem] = useState<TriageItem | ServiceTicketItem | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<'triage' | 'ticket' | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Modal states
  const [assignSRItem, setAssignSRItem] = useState<TriageItem | null>(null);
  const [findMatchItem, setFindMatchItem] = useState<TriageItem | null>(null);
  const [deleteModalItem, setDeleteModalItem] = useState<TriageItem | null>(null);
  const [createTicketItem, setCreateTicketItem] = useState<{ item: TriageItem; stageId: number } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // User state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean> | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);

  // Alert system state
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const alertIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState<Date | null>(null);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const fetchPipelineData = useCallback(async () => {
    try {
      const res = await fetch('/api/service-pipeline');
      const data = await res.json();

      if (data.success) {
        setPipelineData({
          stages: data.stages,
          items: data.items,
          employees: data.employees,
          counts: data.counts,
        });
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch pipeline data');
      }
    } catch (err) {
      console.error('Pipeline fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pipeline data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelineData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPipelineData, 30000);
    return () => clearInterval(interval);
  }, [fetchPipelineData]);

  // ==========================================================================
  // USER & PERMISSIONS
  // ==========================================================================

  useEffect(() => {
    async function fetchUserPermissions() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
          setUserPermissions(data.user.featurePermissions || null);
          setUserRole(data.user.role);
          setCurrentUserId(data.user.id);
          const enabled = hasFeatureAccess('pendingReviewAlerts', data.user.featurePermissions, data.user.role);
          setAlertsEnabled(enabled);
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
      }
    }
    fetchUserPermissions();
  }, []);

  // ==========================================================================
  // ALERT SYSTEM
  // ==========================================================================

  const playAlertTone = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.17);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      setTimeout(() => audioContext.close(), 600);
    } catch (err) {
      console.log('Web Audio not available:', err);
    }
  }, []);

  const isSnoozed = snoozeUntil && new Date() < snoozeUntil;

  const handleSnooze = (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000);
    setSnoozeUntil(until);
    setShowSnoozeModal(false);
    toast.success(`Alerts snoozed for ${minutes} minutes`, {
      description: `Alerts will resume at ${until.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    });
  };

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

  // Check for overdue items and trigger alerts
  useEffect(() => {
    if (!alertsEnabled || !pipelineData) {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
      return;
    }

    const checkAndAlert = () => {
      if (snoozeUntil && new Date() < snoozeUntil) return;

      const triageItems = pipelineData.items.triage || [];
      const overdueItems = triageItems.filter(item => (item.ageMinutes * 60) >= ALERT_THRESHOLD_SECONDS);

      if (overdueItems.length > 0) {
        playAlertTone();

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Service Pipeline Alert', {
            body: `${overdueItems.length} item(s) waiting over 90 seconds!`,
            icon: '/favicon.ico',
            tag: 'service-pipeline-alert',
            requireInteraction: true,
          });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }

        setShowSnoozeModal(true);
      }
    };

    checkAndAlert();
    alertIntervalRef.current = setInterval(checkAndAlert, ALERT_INTERVAL_MS);

    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [alertsEnabled, pipelineData, playAlertTone, snoozeUntil]);

  // ==========================================================================
  // TRIAGE ACTION HANDLERS
  // ==========================================================================

  const handleTriageAction = async (
    item: TriageItem,
    action: 'note' | 'ticket' | 'skip' | 'delete'
  ) => {
    if (action === 'ticket') {
      setAssignSRItem(item);
      return;
    }

    if (action === 'delete') {
      setDeleteModalItem(item);
      return;
    }

    // Optimistic UI update
    const previousData = pipelineData;
    if (pipelineData) {
      setPipelineData({
        ...pipelineData,
        items: {
          ...pipelineData.items,
          triage: pipelineData.items.triage.filter((i) => i.id !== item.id),
        },
        counts: {
          ...pipelineData.counts,
          triage: pipelineData.counts.triage - 1,
        },
      });
    }

    const actionMessages: Record<string, string> = {
      note: 'Note posted to AgencyZoom',
      skip: 'Item skipped',
    };
    toast.success(actionMessages[action] || 'Action completed');

    try {
      const isLead = !!item.agencyzoomLeadId && !item.agencyzoomCustomerId;
      const res = await fetch(`/api/pending-review/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.itemType,
          action,
          customerId: item.agencyzoomCustomerId || item.agencyzoomLeadId,
          isLead,
          messageIds: item.messageIds,
          reviewerId: currentUserId,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setPipelineData(previousData);
        toast.error(data.error || 'Action failed');
      } else {
        fetchPipelineData();
      }
    } catch (error) {
      console.error('Action error:', error);
      setPipelineData(previousData);
      toast.error('Failed to complete action');
    }
  };

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
          itemType: item.itemType,
          action: 'ticket',
          customerId: item.agencyzoomCustomerId || item.agencyzoomLeadId,
          isLead,
          ticketDetails: { assigneeAgentId: assigneeId },
          reviewerId: currentUserId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAssignSRItem(null);
        toast.success(`Service request created and assigned to ${assigneeName}`);
        fetchPipelineData();
      } else {
        toast.error(data.error || 'Failed to create service request');
      }
    } catch (error) {
      console.error('SR creation error:', error);
      toast.error('Failed to create service request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (item: TriageItem, reason: string, notes?: string) => {
    const previousData = pipelineData;
    if (pipelineData) {
      setPipelineData({
        ...pipelineData,
        items: {
          ...pipelineData.items,
          triage: pipelineData.items.triage.filter((i) => i.id !== item.id),
        },
        counts: {
          ...pipelineData.counts,
          triage: pipelineData.counts.triage - 1,
        },
      });
    }
    setDeleteModalItem(null);
    toast.success('Item deleted');

    try {
      const res = await fetch(`/api/pending-review/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.itemType,
          action: 'delete',
          deleteReason: reason,
          deleteNotes: notes,
          reviewerId: currentUserId,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setPipelineData(previousData);
        toast.error(data.error || 'Failed to delete item');
      } else {
        fetchPipelineData();
      }
    } catch (error) {
      console.error('Delete error:', error);
      setPipelineData(previousData);
      toast.error('Failed to delete item');
    }
  };

  // ==========================================================================
  // TICKET STAGE CHANGE HANDLER
  // ==========================================================================

  const handleStageChange = async (
    ticketId: string,
    newStageId: number,
    newStageName: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/service-tickets/${ticketId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: newStageId, stageName: newStageName }),
      });

      const data = await res.json();
      if (data.success) {
        return true;
      } else {
        toast.error(data.error || 'Failed to update stage');
        return false;
      }
    } catch (error) {
      console.error('Stage change error:', error);
      return false;
    }
  };

  // ==========================================================================
  // DETAIL PANEL HANDLERS
  // ==========================================================================

  const handleItemClick = (item: TriageItem | ServiceTicketItem, type: 'triage' | 'ticket') => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setDetailPanelOpen(true);
  };

  const handleDetailPanelClose = () => {
    setDetailPanelOpen(false);
    setSelectedItem(null);
    setSelectedItemType(null);
  };

  const handleDetailStageChange = async (ticketId: string, stageId: number, stageName: string) => {
    const success = await handleStageChange(ticketId, stageId, stageName);
    if (success) {
      toast.success(`Moved to ${stageName}`);
      fetchPipelineData();
    }
  };

  const handleDetailAssigneeChange = async (ticketId: string, csrId: number, csrName: string) => {
    try {
      const res = await fetch(`/api/service-tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrId, csrName }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Assigned to ${csrName}`);
        fetchPipelineData();
      } else {
        toast.error(data.error || 'Failed to assign ticket');
      }
    } catch (error) {
      console.error('Assignee change error:', error);
      toast.error('Failed to assign ticket');
    }
  };

  // ==========================================================================
  // CREATE TICKET FROM TRIAGE (DRAG & DROP)
  // ==========================================================================

  const handleCreateTicketFromTriage = (item: TriageItem, targetStageId: number) => {
    if (item.matchStatus !== 'matched') {
      toast.error('Please match to a customer before creating a ticket');
      return;
    }
    setCreateTicketItem({ item, stageId: targetStageId });
    setAssignSRItem(item);
  };

  // ==========================================================================
  // CUSTOMER MATCH
  // ==========================================================================

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
          itemType: findMatchItem.itemType,
          customerId: customer.agencyzoomId || customer.id,
          customerName: customer.displayName,
          isLead: customer.isLead,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFindMatchItem(null);
        toast.success('Customer matched successfully');
        fetchPipelineData();
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

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // Calculate total counts
  const totalTriageCount = pipelineData?.counts.triage || 0;
  const totalTicketCount = pipelineData
    ? Object.entries(pipelineData.counts)
        .filter(([key]) => key !== 'triage')
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Service Pipeline
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Triage queue + service tickets in progress
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
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{totalTriageCount}</span>
              <span className="text-gray-500 dark:text-gray-400">triage</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">{totalTicketCount}</span>
              <span className="text-gray-500 dark:text-gray-400">tickets</span>
            </div>
          </div>
          <button
            onClick={fetchPipelineData}
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {loading && !pipelineData ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Failed to load pipeline
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={fetchPipelineData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : pipelineData ? (
          <ServiceKanbanBoard
            stages={pipelineData.stages}
            triageItems={pipelineData.items.triage}
            tickets={{
              111160: pipelineData.items[111160] || [],
              111161: pipelineData.items[111161] || [],
              111162: pipelineData.items[111162] || [],
            }}
            employees={pipelineData.employees}
            onStageChange={handleStageChange}
            onTriageAction={handleTriageAction}
            onItemClick={handleItemClick}
            onCreateTicketFromTriage={handleCreateTicketFromTriage}
          />
        ) : null}
      </div>

      {/* Detail Panel */}
      <TicketDetailPanel
        item={selectedItem}
        itemType={selectedItemType}
        stages={pipelineData?.stages || []}
        employees={pipelineData?.employees || []}
        isOpen={detailPanelOpen}
        onClose={handleDetailPanelClose}
        onStageChange={handleDetailStageChange}
        onAssigneeChange={handleDetailAssigneeChange}
        onTriageAction={(item, action) => {
          handleTriageAction(item, action);
          handleDetailPanelClose();
        }}
      />

      {/* Assignee Selection Modal for Service Requests */}
      {assignSRItem && (
        <AssigneeSelectModal
          isOpen={!!assignSRItem}
          onClose={() => {
            setAssignSRItem(null);
            setCreateTicketItem(null);
          }}
          onSelect={handleAssignSR}
          title={`Assign Service Request for ${assignSRItem.contactName || 'Unknown'}`}
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
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSnoozeModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <span className="text-3xl">🔔</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Triage Items Alert
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {pipelineData?.items.triage.filter(item => (item.ageMinutes * 60) >= ALERT_THRESHOLD_SECONDS).length || 0} item(s) waiting over 90 seconds
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
