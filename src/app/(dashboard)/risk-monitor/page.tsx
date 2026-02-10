'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  AlertTriangle,
  Home,
  Activity,
  Settings,
  RefreshCw,
  Plus,
  Search,
  Check,
  X,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Bell,
  Building2,
  Eye,
  Play,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  User,
  FileText,
  ChevronUp,
} from 'lucide-react';
import { FloodZoneBadge, FloodRisk } from '@/components/ui/flood-zone-indicator';
import { buildZillowUrl } from '@/lib/utils/zillow';

// =============================================================================
// TYPES
// =============================================================================

interface PolicyRecord {
  id: string;
  policyNumber?: string;
  azContactId?: string;
  azPolicyId?: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  carrier?: string;
  policyType?: string;
  currentStatus: string;
  previousStatus?: string;
  lastStatusChange?: string;
  listingPrice?: number;
  listingDate?: string;
  daysOnMarket?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  estimatedValue?: number;
  floodZone?: string;
  isActive: boolean;
  lastCheckedAt?: string;
  checkErrorCount?: number;
  lastCheckError?: string;
  createdAt: string;
  updatedAt: string;
}

interface Alert {
  id: string;
  policyId: string;
  alertType: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  previousStatus: string;
  newStatus: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  serviceTicketId?: string;
  listingPhotoUrl?: string;
  policy?: {
    id: string;
    policyNumber: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    addressLine1: string;
    city?: string;
    state?: string;
    zipCode?: string;
    listingPrice?: number;
    azContactId?: string;
    currentStatus?: string;
  };
}

interface ActivityLog {
  id: string;
  runId: string;
  runType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  policiesChecked: number;
  alertsCreated: number;
  errorsEncountered: number;
  errorMessage?: string;
}

interface SettingsData {
  schedulerEnabled: boolean;
  checkIntervalDays: number;
  windowStartHour: number;
  windowEndHour: number;
  maxPropertiesPerRun: number;
  rprEnabled: boolean;
  mmiEnabled: boolean;
  emailAlertsEnabled: boolean;
  alertEmailAddresses: string[];
  rprConfigured?: boolean;
  mmiConfigured?: boolean;
}

interface Stats {
  policies: {
    total: number;
    byStatus: Record<string, number>;
    needsCheck: number;
  };
  alerts: {
    unresolved: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    recent: Alert[];
  };
  scheduler: {
    enabled: boolean;
    lastRunAt?: string;
    lastRunStatus?: string;
    lastRunPropertiesChecked: number;
    lastRunAlertsCreated: number;
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RiskMonitorPage() {
  // Data state
  const [stats, setStats] = useState<Stats | null>(null);
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [policyCounts, setPolicyCounts] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [triggeringRun, setTriggeringRun] = useState(false);
  const [checkingProperty, setCheckingProperty] = useState<string | null>(null);

  // Run status bar
  const [runStatus, setRunStatus] = useState<{
    show: boolean;
    status: 'running' | 'success' | 'error';
    message: string;
    details?: {
      propertiesChecked: number;
      alertsCreated: number;
      duration: number;
      errors: string[];
    };
  } | null>(null);

  // New policy form
  const [newPolicy, setNewPolicy] = useState({
    policyNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    propertyAddress: '',
    policyType: 'homeowners',
  });

  // Alert inline action state
  const [creatingTicket, setCreatingTicket] = useState<string | null>(null);
  const [ticketMessage, setTicketMessage] = useState<{ alertId: string; success: boolean; message: string } | null>(null);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-monitor/stats');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchPolicies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '200');
      const res = await fetch(`/api/risk-monitor/policies?${params}`);
      const data = await res.json();
      if (data.success) {
        setPolicies(data.policies);
        setPolicyCounts(data.counts);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  }, [statusFilter, searchQuery]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-monitor/alerts?limit=100');
      const data = await res.json();
      if (data.success) setAlerts(data.alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-monitor/activity?limit=5');
      const data = await res.json();
      if (data.success) setActivityLogs(data.logs);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-monitor/settings');
      const data = await res.json();
      if (data.success) setSettings(data.settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchPolicies(), fetchAlerts(), fetchActivity(), fetchSettings()]);
      setLoading(false);
    };
    loadData();
  }, [fetchStats, fetchPolicies, fetchAlerts, fetchActivity, fetchSettings]);

  // Refetch policies when filter/search changes
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // =============================================================================
  // ACTIONS
  // =============================================================================

  const handleRefresh = async () => {
    await Promise.all([fetchStats(), fetchPolicies(), fetchAlerts(), fetchActivity()]);
  };

  const handleTriggerRun = async () => {
    setTriggeringRun(true);
    setRunStatus({ show: true, status: 'running', message: 'Running property check...' });

    try {
      const res = await fetch('/api/risk-monitor/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignoreWindow: true }),
      });
      const data = await res.json();

      if (data.success && data.result) {
        setRunStatus({
          show: true,
          status: 'success',
          message: `Completed: ${data.result.propertiesChecked} properties checked`,
          details: {
            propertiesChecked: data.result.propertiesChecked,
            alertsCreated: data.result.alertsCreated,
            duration: data.result.duration,
            errors: data.result.errors || [],
          },
        });
      } else {
        setRunStatus({
          show: true,
          status: 'error',
          message: data.message || data.error || 'Run failed',
        });
      }

      await Promise.all([fetchStats(), fetchPolicies(), fetchAlerts(), fetchActivity()]);
      setTimeout(() => setRunStatus((prev) => (prev?.status === 'success' ? null : prev)), 10000);
    } catch (error) {
      setRunStatus({
        show: true,
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to trigger run',
      });
    }
    setTriggeringRun(false);
  };

  const handleCheckProperty = async (policyId: string) => {
    setCheckingProperty(policyId);
    try {
      await fetch(`/api/risk-monitor/policies/${policyId}/check`, { method: 'POST' });
      await Promise.all([fetchPolicies(), fetchAlerts(), fetchStats()]);
    } catch (error) {
      console.error('Error checking property:', error);
    }
    setCheckingProperty(null);
  };

  const handleAlertAction = async (alertIds: string[], action: string) => {
    try {
      await fetch('/api/risk-monitor/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds, action }),
      });
      await Promise.all([fetchAlerts(), fetchStats()]);
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  };

  const handleCreateServiceRequest = async (alertId: string) => {
    setCreatingTicket(alertId);
    setTicketMessage(null);
    try {
      const res = await fetch(`/api/risk-monitor/alerts/${alertId}/create-service-request`, { method: 'POST' });
      const data = await res.json();
      setTicketMessage({ alertId, success: data.success, message: data.message || data.error || 'Done' });
      if (data.success) await fetchAlerts();
      setTimeout(() => setTicketMessage(null), 5000);
    } catch (error) {
      setTicketMessage({ alertId, success: false, message: 'Failed to create service request' });
    }
    setCreatingTicket(null);
  };

  const handleAddPolicy = async () => {
    if (!newPolicy.policyNumber || !newPolicy.customerName || !newPolicy.propertyAddress) return;
    try {
      const res = await fetch('/api/risk-monitor/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddPolicy(false);
        setNewPolicy({ policyNumber: '', customerName: '', customerEmail: '', customerPhone: '', propertyAddress: '', policyType: 'homeowners' });
        await Promise.all([fetchPolicies(), fetchStats()]);
      }
    } catch (error) {
      console.error('Error adding policy:', error);
    }
  };

  const handleSaveSettings = async (updates: Partial<SettingsData>) => {
    try {
      await fetch('/api/risk-monitor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // =============================================================================
  // HELPERS
  // =============================================================================

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    return phone;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  // Get unresolved alerts for a given policy
  const getAlertsForPolicy = (policyId: string) =>
    alerts.filter((a) => a.policyId === policyId && a.status !== 'resolved' && a.status !== 'dismissed');

  // Sort policies: active/pending/sold first, then off_market
  const statusPriority: Record<string, number> = { active: 0, pending: 1, sold: 2, off_market: 3, unknown: 4 };

  const sortedPolicies = [...policies].sort((a, b) => {
    const pa = statusPriority[a.currentStatus] ?? 4;
    const pb = statusPriority[b.currentStatus] ?? 4;
    if (pa !== pb) return pa - pb;
    return a.contactName.localeCompare(b.contactName);
  });

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const totalMonitored = stats?.policies.total ?? 0;
  const activeCount = stats?.policies.byStatus.active ?? 0;
  const pendingCount = stats?.policies.byStatus.pending ?? 0;
  const soldCount = stats?.policies.byStatus.sold ?? 0;

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Risk Monitor</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddPolicy(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
          <button
            onClick={handleTriggerRun}
            disabled={triggeringRun}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            <Play className={`h-4 w-4 ${triggeringRun ? 'animate-pulse' : ''}`} />
            Run Now
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ─── Run Status Bar ─── */}
      {runStatus?.show && (
        <div
          className={`rounded-lg border p-3 flex items-center justify-between ${
            runStatus.status === 'running' ? 'bg-blue-50 border-blue-200' :
            runStatus.status === 'success' ? 'bg-green-50 border-green-200' :
            'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {runStatus.status === 'running' ? (
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
            ) : runStatus.status === 'success' ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <div>
              <p className={`text-sm font-medium ${
                runStatus.status === 'running' ? 'text-blue-900' :
                runStatus.status === 'success' ? 'text-green-900' :
                'text-red-900'
              }`}>
                {runStatus.message}
              </p>
              {runStatus.details && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {runStatus.details.alertsCreated > 0 && (
                    <span className="font-medium text-orange-600">
                      {runStatus.details.alertsCreated} new alert{runStatus.details.alertsCreated !== 1 && 's'} &bull;{' '}
                    </span>
                  )}
                  Duration: {(runStatus.details.duration / 1000).toFixed(1)}s
                  {runStatus.details.errors.length > 0 && (
                    <span className="text-red-600"> &bull; {runStatus.details.errors.length} error{runStatus.details.errors.length !== 1 && 's'}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          {runStatus.status !== 'running' && (
            <button onClick={() => setRunStatus(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Monitored" value={totalMonitored} icon={Building2} color="gray" />
        <StatCard label="Active" value={activeCount} icon={Home} color="yellow" />
        <StatCard label="Pending" value={pendingCount} icon={Clock} color="orange" />
        <StatCard label="Sold" value={soldCount} icon={DollarSign} color="red" />
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {[
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
            { value: 'sold', label: 'Sold' },
            { value: 'off_market', label: 'Off Market' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === f.value
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.value && policyCounts[f.value] ? ` (${policyCounts[f.value]})` : ''}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 w-64"
          />
        </div>
      </div>

      {/* ─── Property Table ─── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[auto_1fr_1fr_100px_70px_90px_140px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="w-20">Status</div>
          <div>Customer</div>
          <div>Address</div>
          <div className="text-right">Price</div>
          <div className="text-right">DOM</div>
          <div>Checked</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Table rows */}
        {sortedPolicies.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No properties found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedPolicies.map((policy) => {
              const policyAlerts = getAlertsForPolicy(policy.id);
              const hasAlert = policyAlerts.length > 0;
              const isExpanded = expandedRow === policy.id;

              return (
                <div key={policy.id}>
                  {/* Main row */}
                  <div
                    className={`grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_100px_70px_90px_140px] gap-2 px-4 py-3 items-center cursor-pointer hover:bg-gray-50 transition-colors ${
                      hasAlert ? 'bg-amber-50/50' : ''
                    }`}
                    onClick={() => setExpandedRow(isExpanded ? null : policy.id)}
                  >
                    {/* Status */}
                    <div className="w-20">
                      <StatusBadge status={policy.currentStatus} />
                      {hasAlert && (
                        <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-red-500" title={`${policyAlerts.length} unresolved alert${policyAlerts.length > 1 ? 's' : ''}`} />
                      )}
                    </div>

                    {/* Customer */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{policy.contactName}</p>
                      <p className="text-xs text-gray-500 truncate">{policy.policyNumber || 'No policy #'}</p>
                    </div>

                    {/* Address */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm text-gray-700 truncate">{policy.addressLine1}</p>
                        {(() => {
                          const zUrl = buildZillowUrl({ street: policy.addressLine1, city: policy.city, state: policy.state, zip: policy.zipCode });
                          return zUrl ? (
                            <a href={zUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex-shrink-0" title="View on Zillow" onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="h-3.5 w-3.5 inline" />
                            </a>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{policy.city}, {policy.state} {policy.zipCode}</p>
                    </div>

                    {/* Price */}
                    <div className="text-right text-sm text-gray-700">
                      {policy.listingPrice ? formatCurrency(policy.listingPrice) : '-'}
                    </div>

                    {/* DOM */}
                    <div className="text-right text-sm text-gray-500">
                      {policy.daysOnMarket != null ? `${policy.daysOnMarket}d` : '-'}
                    </div>

                    {/* Last Checked */}
                    <div className="text-xs text-gray-500">
                      {policy.lastCheckedAt ? formatDate(policy.lastCheckedAt) : 'Never'}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleCheckProperty(policy.id)}
                        disabled={checkingProperty === policy.id}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50 transition-colors"
                        title="Check now"
                      >
                        <RefreshCw className={`h-4 w-4 ${checkingProperty === policy.id ? 'animate-spin' : ''}`} />
                      </button>
                      {policy.contactEmail && (
                        <a
                          href={`mailto:${policy.contactEmail}?subject=Regarding Your Property at ${policy.addressLine1}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                          title="Email customer"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {policy.azContactId && (
                        <a
                          href={`https://app.agencyzoom.com/customer/index?id=${policy.azContactId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors"
                          title="Open in AgencyZoom"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <ExpandedPropertyPanel
                      policy={policy}
                      alerts={policyAlerts}
                      onAlertAction={handleAlertAction}
                      onCreateServiceRequest={handleCreateServiceRequest}
                      creatingTicket={creatingTicket}
                      ticketMessage={ticketMessage}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Collapsible Activity Log ─── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => { setShowActivity(!showActivity); if (!showActivity) fetchActivity(); }}
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            Recent Activity
          </div>
          {showActivity ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {showActivity && (
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {activityLogs.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No recent runs</div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      log.status === 'completed' ? 'bg-green-500' :
                      log.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      log.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <span className="font-medium text-gray-900">
                        {log.runType === 'scheduled' ? 'Scheduled' : 'Manual'} Run
                      </span>
                      <span className="text-gray-400 ml-2">{formatDateTime(log.startedAt)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {log.policiesChecked} checked &bull; {log.alertsCreated} alerts
                    {log.errorsEncountered > 0 && <span className="text-red-500"> &bull; {log.errorsEncountered} errors</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ─── Settings Slide-out ─── */}
      {showSettings && settings && (
        <SettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ─── Add Policy Modal ─── */}
      {showAddPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Property to Monitor</h3>
            <div className="space-y-4">
              <InputField label="Policy Number *" value={newPolicy.policyNumber} onChange={(v) => setNewPolicy({ ...newPolicy, policyNumber: v })} />
              <InputField label="Customer Name *" value={newPolicy.customerName} onChange={(v) => setNewPolicy({ ...newPolicy, customerName: v })} />
              <InputField label="Property Address *" value={newPolicy.propertyAddress} onChange={(v) => setNewPolicy({ ...newPolicy, propertyAddress: v })} />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Email" value={newPolicy.customerEmail} onChange={(v) => setNewPolicy({ ...newPolicy, customerEmail: v })} type="email" />
                <InputField label="Phone" value={newPolicy.customerPhone} onChange={(v) => setNewPolicy({ ...newPolicy, customerPhone: v })} type="tel" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Type</label>
                <select
                  value={newPolicy.policyType}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policyType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="homeowners">Homeowners</option>
                  <option value="dwelling_fire">Dwelling Fire</option>
                  <option value="commercial">Commercial Property</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAddPolicy(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleAddPolicy} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                Add Property
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colorMap: Record<string, { border: string; bg: string; text: string; iconBg: string }> = {
    gray: { border: '', bg: '', text: 'text-gray-900', iconBg: 'bg-gray-100 text-gray-500' },
    yellow: { border: 'border-l-4 border-l-yellow-400', bg: '', text: 'text-yellow-700', iconBg: 'bg-yellow-100 text-yellow-600' },
    orange: { border: 'border-l-4 border-l-orange-400', bg: '', text: 'text-orange-700', iconBg: 'bg-orange-100 text-orange-600' },
    red: { border: 'border-l-4 border-l-red-400', bg: '', text: 'text-red-700', iconBg: 'bg-red-100 text-red-600' },
  };
  const c = colorMap[color] || colorMap.gray;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${c.border} p-4 flex items-center justify-between`}>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-semibold mt-0.5 ${c.text}`}>{value}</p>
      </div>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${c.iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    active: { dot: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Active' },
    pending: { dot: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', label: 'Pending' },
    sold: { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700', label: 'Sold' },
    off_market: { dot: 'bg-gray-300', bg: 'bg-gray-50', text: 'text-gray-600', label: 'Off Market' },
    unknown: { dot: 'bg-gray-300', bg: 'bg-gray-50', text: 'text-gray-500', label: 'Unknown' },
  };
  const c = config[status] || config.unknown;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function ExpandedPropertyPanel({
  policy,
  alerts,
  onAlertAction,
  onCreateServiceRequest,
  creatingTicket,
  ticketMessage,
}: {
  policy: PolicyRecord;
  alerts: Alert[];
  onAlertAction: (ids: string[], action: string) => void;
  onCreateServiceRequest: (id: string) => void;
  creatingTicket: string | null;
  ticketMessage: { alertId: string; success: boolean; message: string } | null;
}) {
  // Get listing photo from the newest alert's rawData
  const photoUrl = alerts.length > 0 ? alerts[0].listingPhotoUrl : undefined;

  return (
    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
      {photoUrl && (
        <div className="pt-3 pb-1">
          <img src={photoUrl} alt="Property" className="w-full max-h-48 object-cover rounded-lg" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
        {/* Contact Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <User className="h-3.5 w-3.5 text-gray-400" />
              {policy.contactName}
            </div>
            {policy.contactPhone && (
              <a href={`tel:${policy.contactPhone}`} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700">
                <Phone className="h-3.5 w-3.5" />
                {formatPhoneNum(policy.contactPhone)}
              </a>
            )}
            {policy.contactEmail && (
              <a href={`mailto:${policy.contactEmail}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 truncate">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{policy.contactEmail}</span>
              </a>
            )}
            {policy.azContactId && (
              <a
                href={`https://app.agencyzoom.com/customer/index?id=${policy.azContactId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                AgencyZoom Profile
              </a>
            )}
          </div>
        </div>

        {/* Property Details */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</h4>
          <div className="space-y-1.5 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {policy.addressLine1}{policy.addressLine2 ? `, ${policy.addressLine2}` : ''}
              {(() => {
                const zUrl = buildZillowUrl({ street: policy.addressLine1, city: policy.city, state: policy.state, zip: policy.zipCode });
                return zUrl ? (
                  <a href={zUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex-shrink-0" title="View on Zillow">
                    <ExternalLink className="h-3.5 w-3.5 inline" />
                  </a>
                ) : null;
              })()}
            </div>
            <p className="pl-5 text-xs text-gray-500">{policy.city}, {policy.state} {policy.zipCode}</p>
            {policy.carrier && <p className="text-xs text-gray-500">Carrier: {policy.carrier}</p>}
            {policy.policyType && <p className="text-xs text-gray-500">Type: {policy.policyType}</p>}
            {policy.floodZone && (
              <div className="pt-1">
                <FloodZoneBadge zone={policy.floodZone} risk={'Unknown' as FloodRisk} />
              </div>
            )}
          </div>
        </div>

        {/* Listing Details */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Listing</h4>
          <div className="space-y-1.5 text-sm text-gray-700">
            {policy.listingPrice != null && policy.listingPrice > 0 && (
              <p>List Price: <span className="font-medium">{formatCurrencyNum(policy.listingPrice)}</span></p>
            )}
            {policy.lastSalePrice != null && policy.lastSalePrice > 0 && (
              <p>Sale Price: <span className="font-medium">{formatCurrencyNum(policy.lastSalePrice)}</span></p>
            )}
            {policy.listingDate && <p className="text-xs text-gray-500">Listed: {new Date(policy.listingDate).toLocaleDateString()}</p>}
            {policy.lastSaleDate && <p className="text-xs text-gray-500">Sold: {new Date(policy.lastSaleDate).toLocaleDateString()}</p>}
            {policy.daysOnMarket != null && <p className="text-xs text-gray-500">Days on Market: {policy.daysOnMarket}</p>}
            {policy.estimatedValue != null && policy.estimatedValue > 0 && (
              <p className="text-xs text-gray-500">Est. Value: {formatCurrencyNum(policy.estimatedValue)}</p>
            )}
            {policy.lastCheckedAt && (
              <p className="text-xs text-gray-400 pt-1">Last checked: {new Date(policy.lastCheckedAt).toLocaleString()}</p>
            )}
            {policy.checkErrorCount != null && policy.checkErrorCount > 0 && (
              <p className="text-xs text-red-500">{policy.checkErrorCount} consecutive errors</p>
            )}
          </div>
        </div>
      </div>

      {/* Inline Alerts */}
      {alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unresolved Alerts</h4>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-3 ${
                alert.priority === '1' ? 'border-red-200 bg-red-50' :
                alert.priority === '2' ? 'border-amber-200 bg-amber-50' :
                'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(alert.createdAt).toLocaleString()} &bull;{' '}
                    <span className={
                      alert.status === 'new' ? 'text-red-600 font-medium' :
                      alert.status === 'acknowledged' ? 'text-yellow-600' :
                      'text-blue-600'
                    }>
                      {alert.status.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => onAlertAction([alert.id], 'acknowledge')}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Ack
                    </button>
                  )}
                  <button
                    onClick={() => onAlertAction([alert.id], 'resolve')}
                    className="px-2 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700"
                  >
                    Resolve
                  </button>
                  {alert.policy?.azContactId && !alert.serviceTicketId &&
                   (alert.newStatus === 'active' || alert.newStatus === 'pending') && (
                    <button
                      onClick={() => onCreateServiceRequest(alert.id)}
                      disabled={creatingTicket === alert.id}
                      className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200 disabled:opacity-50"
                    >
                      {creatingTicket === alert.id ? '...' : 'SR'}
                    </button>
                  )}
                  {alert.serviceTicketId && (
                    <span className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded">
                      #{alert.serviceTicketId}
                    </span>
                  )}
                  <button
                    onClick={() => onAlertAction([alert.id], 'dismiss')}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {/* Ticket creation message */}
              {ticketMessage?.alertId === alert.id && (
                <p className={`mt-1.5 text-xs ${ticketMessage.success ? 'text-green-600' : 'text-red-600'}`}>
                  {ticketMessage.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: SettingsData;
  onSave: (updates: Partial<SettingsData>) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(settings);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = (key: keyof SettingsData) => {
    const newValue = !local[key];
    setLocal({ ...local, [key]: newValue });
    onSave({ [key]: newValue });
  };

  const handleChange = (key: keyof SettingsData, value: any) => {
    setLocal({ ...local, [key]: value });
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Scheduler */}
          <Section title="Scheduler">
            <ToggleRow label="Enable Scheduler" description="Automatically check properties on schedule" checked={local.schedulerEnabled} onToggle={() => handleToggle('schedulerEnabled')} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumberField label="Recheck Interval (days)" value={local.checkIntervalDays} min={1} max={30} onChange={(v) => handleChange('checkIntervalDays', v)} />
              <NumberField label="Max Per Run" value={local.maxPropertiesPerRun} min={10} max={500} onChange={(v) => handleChange('maxPropertiesPerRun', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumberField label="Start Hour (CST)" value={local.windowStartHour} min={0} max={23} onChange={(v) => handleChange('windowStartHour', v)} />
              <NumberField label="End Hour (CST)" value={local.windowEndHour} min={0} max={23} onChange={(v) => handleChange('windowEndHour', v)} />
            </div>
          </Section>

          {/* Email */}
          <Section title="Email Notifications">
            <ToggleRow label="Email Alerts" description="Send email for property status changes" checked={local.emailAlertsEnabled} onToggle={() => handleToggle('emailAlertsEnabled')} />
            {local.emailAlertsEnabled && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Static Recipients</label>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                  rows={3}
                  placeholder="one@example.com&#10;two@example.com"
                  value={(local.alertEmailAddresses || []).join('\n')}
                  onChange={(e) => handleChange('alertEmailAddresses', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                />
                <p className="text-xs text-gray-400 mt-1">CSR and Producer on the account are also emailed automatically.</p>
              </div>
            )}
          </Section>

          {/* Data Sources */}
          <Section title="Data Sources">
            <ToggleRow
              label="RPR (Realtors Property Resource)"
              description={settings.rprConfigured ? 'Credentials configured' : 'Not configured'}
              checked={local.rprEnabled}
              onToggle={() => handleToggle('rprEnabled')}
            />
            <ToggleRow
              label="MMI (Market Data)"
              description={settings.mmiConfigured ? 'Credentials configured' : 'Not configured'}
              checked={local.mmiEnabled}
              onToggle={() => handleToggle('mmiEnabled')}
              className="mt-3"
            />
          </Section>
        </div>

        {/* Save Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// SMALL SHARED COMPONENTS
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onToggle, className }: { label: string; description: string; checked: boolean; onToggle: () => void; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className || ''}`}>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
      />
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
      />
    </div>
  );
}

// Helper functions used by sub-components
function formatPhoneNum(phone: string) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return phone;
}

function formatCurrencyNum(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
