'use client';

import { useState, useEffect, useCallback } from 'react';
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
  ChevronRight,
  Bell,
  TrendingUp,
  Building2,
  Eye,
  Play,
  Droplets,
} from 'lucide-react';
import { FloodZoneBadge, FloodRisk } from '@/components/ui/flood-zone-indicator';

// =============================================================================
// TYPES
// =============================================================================

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
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignedTo?: string;
  notes?: string;
  policy?: {
    id: string;
    policyNumber: string;
    customerName: string;
    propertyAddress: string;
  };
}

interface Policy {
  id: string;
  policyNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  propertyAddress: string;
  policyType: string;
  currentStatus: string;
  isActive: boolean;
  lastCheckedAt?: string;
  listingDetectedAt?: string;
  listingPrice?: number;
  createdAt: string;
  // Flood zone data from RPR
  floodZone?: string;
  floodRisk?: string;
}

interface ActivityLog {
  id: string;
  runType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  propertiesChecked: number;
  alertsCreated: number;
  errorCount: number;
}

interface Settings {
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
// COMPONENT
// =============================================================================

export default function RiskMonitorPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'policies' | 'activity' | 'settings'>('dashboard');

  // Data state
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({});
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyCounts, setPolicyCounts] = useState<Record<string, number>>({});
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertFilter, setAlertFilter] = useState<string>('');
  const [policyFilter, setPolicyFilter] = useState<string>('');
  const [policySearch, setPolicySearch] = useState('');
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [triggeringRun, setTriggeringRun] = useState(false);

  // Run status state for status bar
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

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-monitor/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (alertFilter) params.set('status', alertFilter);
      const res = await fetch(`/api/risk-monitor/alerts?${params}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setAlertCounts(data.counts);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [alertFilter]);

  const fetchPolicies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (policyFilter) params.set('status', policyFilter);
      if (policySearch) params.set('search', policySearch);
      const res = await fetch(`/api/risk-monitor/policies?${params}`);
      const data = await res.json();
      if (data.success) {
        setPolicies(data.policies);
        setPolicyCounts(data.counts);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  }, [policyFilter, policySearch]);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-monitor/activity');
      const data = await res.json();
      if (data.success) {
        setActivityLogs(data.logs);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/risk-monitor/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAlerts(),
        fetchPolicies(),
        fetchActivity(),
        fetchSettings(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchStats, fetchAlerts, fetchPolicies, fetchActivity, fetchSettings]);

  // Refresh on tab change
  useEffect(() => {
    if (activeTab === 'dashboard') fetchStats();
    if (activeTab === 'alerts') fetchAlerts();
    if (activeTab === 'policies') fetchPolicies();
    if (activeTab === 'activity') fetchActivity();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab, fetchStats, fetchAlerts, fetchPolicies, fetchActivity, fetchSettings]);

  // =============================================================================
  // ACTIONS
  // =============================================================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchAlerts(), fetchPolicies(), fetchActivity()]);
    setRefreshing(false);
  };

  const handleAlertAction = async (alertIds: string[], action: string) => {
    try {
      await fetch('/api/risk-monitor/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds, action }),
      });
      await fetchAlerts();
      await fetchStats();
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  };

  const handleAddPolicy = async () => {
    if (!newPolicy.policyNumber || !newPolicy.customerName || !newPolicy.propertyAddress) {
      return;
    }
    try {
      const res = await fetch('/api/risk-monitor/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddPolicy(false);
        setNewPolicy({
          policyNumber: '',
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          propertyAddress: '',
          policyType: 'homeowners',
        });
        await fetchPolicies();
        await fetchStats();
      }
    } catch (error) {
      console.error('Error adding policy:', error);
    }
  };

  const handleCheckProperty = async (policyId: string) => {
    try {
      await fetch(`/api/risk-monitor/policies/${policyId}/check`, { method: 'POST' });
      await fetchPolicies();
      await fetchAlerts();
      await fetchStats();
    } catch (error) {
      console.error('Error checking property:', error);
    }
  };

  const handleTriggerRun = async () => {
    setTriggeringRun(true);
    setRunStatus({
      show: true,
      status: 'running',
      message: 'Running property check...',
    });

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

      await fetchActivity();
      await fetchStats();

      // Auto-hide success status after 10 seconds
      setTimeout(() => {
        setRunStatus((prev) => (prev?.status === 'success' ? null : prev));
      }, 10000);
    } catch (error) {
      console.error('Error triggering run:', error);
      setRunStatus({
        show: true,
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to trigger run',
      });
    }
    setTriggeringRun(false);
  };

  const handleSaveSettings = async (updates: Partial<Settings>) => {
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'off_market':
        return 'bg-gray-100 text-gray-700';
      case 'active':
        return 'bg-yellow-100 text-yellow-700';
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      case 'sold':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getAlertStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-red-100 text-red-700';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'resolved':
        return 'bg-green-100 text-green-700';
      case 'dismissed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '1':
        return 'text-red-600';
      case '2':
        return 'text-orange-600';
      case '3':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Property Risk Monitor</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor insured properties for listing and sale activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleTriggerRun}
            disabled={triggeringRun}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            <Play className={`h-4 w-4 ${triggeringRun ? 'animate-pulse' : ''}`} />
            Run Now
          </button>
        </div>
      </div>

      {/* Run Status Bar */}
      {runStatus?.show && (
        <div
          className={`rounded-lg border p-4 flex items-center justify-between ${
            runStatus.status === 'running'
              ? 'bg-blue-50 border-blue-200'
              : runStatus.status === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
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
              <p
                className={`text-sm font-medium ${
                  runStatus.status === 'running'
                    ? 'text-blue-900'
                    : runStatus.status === 'success'
                    ? 'text-green-900'
                    : 'text-red-900'
                }`}
              >
                {runStatus.message}
              </p>
              {runStatus.details && (
                <p className="text-xs text-gray-600 mt-1">
                  {runStatus.details.alertsCreated > 0 && (
                    <span className="font-medium text-orange-600">
                      {runStatus.details.alertsCreated} new alert{runStatus.details.alertsCreated !== 1 && 's'}
                    </span>
                  )}
                  {runStatus.details.alertsCreated > 0 && ' • '}
                  Duration: {(runStatus.details.duration / 1000).toFixed(1)}s
                  {runStatus.details.errors.length > 0 && (
                    <span className="text-red-600"> • {runStatus.details.errors.length} error{runStatus.details.errors.length !== 1 && 's'}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          {runStatus.status !== 'running' && (
            <button
              onClick={() => setRunStatus(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
            { id: 'alerts', label: 'Alerts', icon: Bell, count: stats?.alerts.unresolved },
            { id: 'policies', label: 'Policies', icon: Building2, count: stats?.policies.total },
            { id: 'activity', label: 'Activity Log', icon: Activity },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardTab stats={stats} onViewAlert={(id) => {
          setActiveTab('alerts');
        }} />
      )}

      {activeTab === 'alerts' && (
        <AlertsTab
          alerts={alerts}
          counts={alertCounts}
          filter={alertFilter}
          onFilterChange={(f) => {
            setAlertFilter(f);
          }}
          onAction={handleAlertAction}
        />
      )}

      {activeTab === 'policies' && (
        <PoliciesTab
          policies={policies}
          counts={policyCounts}
          filter={policyFilter}
          search={policySearch}
          onFilterChange={setPolicyFilter}
          onSearchChange={setPolicySearch}
          onSearch={fetchPolicies}
          onAdd={() => setShowAddPolicy(true)}
          onCheck={handleCheckProperty}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityTab logs={activityLogs} />
      )}

      {activeTab === 'settings' && settings && (
        <SettingsTab settings={settings} onSave={handleSaveSettings} />
      )}

      {/* Add Policy Modal */}
      {showAddPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Property to Monitor</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number *</label>
                <input
                  type="text"
                  value={newPolicy.policyNumber}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policyNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={newPolicy.customerName}
                  onChange={(e) => setNewPolicy({ ...newPolicy, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Address *</label>
                <input
                  type="text"
                  value={newPolicy.propertyAddress}
                  onChange={(e) => setNewPolicy({ ...newPolicy, propertyAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newPolicy.customerEmail}
                    onChange={(e) => setNewPolicy({ ...newPolicy, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newPolicy.customerPhone}
                    onChange={(e) => setNewPolicy({ ...newPolicy, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
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
              <button
                onClick={() => setShowAddPolicy(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPolicy}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
              >
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

function DashboardTab({ stats, onViewAlert }: { stats: Stats | null; onViewAlert: (id: string) => void }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Properties</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.policies.total}</p>
            </div>
            <Building2 className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Listings</p>
              <p className="text-2xl font-semibold text-yellow-600">{stats.policies.byStatus.active || 0}</p>
            </div>
            <Home className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Sales</p>
              <p className="text-2xl font-semibold text-orange-600">{stats.policies.byStatus.pending || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unresolved Alerts</p>
              <p className="text-2xl font-semibold text-red-600">{stats.alerts.unresolved}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Recent Alerts</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {stats.alerts.recent.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No recent alerts
            </div>
          ) : (
            stats.alerts.recent.map((alert) => (
              <div key={alert.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`h-5 w-5 ${alert.priority === '1' ? 'text-red-500' : alert.priority === '2' ? 'text-orange-500' : 'text-yellow-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-xs text-gray-500">{new Date(alert.detectedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${alert.status === 'new' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                  {alert.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scheduler Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Scheduler Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Status</p>
            <p className={`font-medium ${stats.scheduler.enabled ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.scheduler.enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Last Run</p>
            <p className="font-medium text-gray-900">
              {stats.scheduler.lastRunAt ? new Date(stats.scheduler.lastRunAt).toLocaleDateString() : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Properties Checked</p>
            <p className="font-medium text-gray-900">{stats.scheduler.lastRunPropertiesChecked}</p>
          </div>
          <div>
            <p className="text-gray-500">Needs Check</p>
            <p className="font-medium text-gray-900">{stats.policies.needsCheck}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsTab({
  alerts,
  counts,
  filter,
  onFilterChange,
  onAction,
}: {
  alerts: Alert[];
  counts: Record<string, number>;
  filter: string;
  onFilterChange: (f: string) => void;
  onAction: (ids: string[], action: string) => void;
}) {
  const statuses = ['', 'new', 'acknowledged', 'in_progress', 'resolved', 'dismissed'];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => onFilterChange(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
              filter === status
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status || 'All'}
            {status && counts[status] ? ` (${counts[status]})` : ''}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {alerts.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No alerts found</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="px-4 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                    alert.priority === '1' ? 'text-red-500' :
                    alert.priority === '2' ? 'text-orange-500' :
                    'text-yellow-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{alert.description}</p>
                    {alert.policy && (
                      <p className="mt-1 text-xs text-gray-400">
                        {alert.policy.customerName} • {alert.policy.policyNumber}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      Detected: {new Date(alert.detectedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    alert.status === 'new' ? 'bg-red-100 text-red-700' :
                    alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-700' :
                    alert.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    alert.status === 'resolved' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              </div>
              {/* Actions */}
              {alert.status !== 'resolved' && alert.status !== 'dismissed' && (
                <div className="mt-3 flex items-center gap-2">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => onAction([alert.id], 'acknowledge')}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                    >
                      <Eye className="h-3 w-3" /> Acknowledge
                    </button>
                  )}
                  {(alert.status === 'new' || alert.status === 'acknowledged') && (
                    <button
                      onClick={() => onAction([alert.id], 'start')}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200"
                    >
                      <Play className="h-3 w-3" /> Start Work
                    </button>
                  )}
                  <button
                    onClick={() => onAction([alert.id], 'resolve')}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
                  >
                    <Check className="h-3 w-3" /> Resolve
                  </button>
                  <button
                    onClick={() => onAction([alert.id], 'dismiss')}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    <X className="h-3 w-3" /> Dismiss
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PoliciesTab({
  policies,
  counts,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onSearch,
  onAdd,
  onCheck,
}: {
  policies: Policy[];
  counts: Record<string, number>;
  filter: string;
  search: string;
  onFilterChange: (f: string) => void;
  onSearchChange: (s: string) => void;
  onSearch: () => void;
  onAdd: () => void;
  onCheck: (id: string) => void;
}) {
  const statuses = ['', 'off_market', 'active', 'pending', 'sold'];

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => onFilterChange(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                filter === status
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status || 'All'}
              {status && counts[status] ? ` (${counts[status]})` : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Add Property
          </button>
        </div>
      </div>

      {/* Policies List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {policies.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No properties being monitored</p>
          </div>
        ) : (
          policies.map((policy) => (
            <div key={policy.id} className="px-4 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{policy.customerName}</p>
                  <p className="text-sm text-gray-500">{policy.propertyAddress}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-gray-400">
                      Policy: {policy.policyNumber} • {policy.policyType}
                    </p>
                    {policy.floodZone && (
                      <FloodZoneBadge
                        zone={policy.floodZone}
                        risk={(policy.floodRisk as FloodRisk) || 'Unknown'}
                      />
                    )}
                  </div>
                  {policy.lastCheckedAt && (
                    <p className="text-xs text-gray-400">
                      Last checked: {new Date(policy.lastCheckedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    policy.currentStatus === 'off_market' ? 'bg-gray-100 text-gray-700' :
                    policy.currentStatus === 'active' ? 'bg-yellow-100 text-yellow-700' :
                    policy.currentStatus === 'pending' ? 'bg-orange-100 text-orange-700' :
                    policy.currentStatus === 'sold' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {policy.currentStatus || 'unknown'}
                  </span>
                  <button
                    onClick={() => onCheck(policy.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                    title="Check now"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ActivityTab({ logs }: { logs: ActivityLog[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {logs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No activity logs yet</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    log.status === 'completed' ? 'bg-green-500' :
                    log.status === 'running' ? 'bg-blue-500 animate-pulse' :
                    log.status === 'failed' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.runType === 'scheduled' ? 'Scheduled Run' : 'Manual Run'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-900">{log.propertiesChecked} checked</p>
                  <p className="text-xs text-gray-500">
                    {log.alertsCreated} alerts • {log.errorCount} errors
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SettingsTab({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (updates: Partial<Settings>) => void;
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleToggle = (key: keyof Settings) => {
    const newValue = !localSettings[key];
    setLocalSettings({ ...localSettings, [key]: newValue });
    onSave({ [key]: newValue });
  };

  const handleChange = (key: keyof Settings, value: any) => {
    setLocalSettings({ ...localSettings, [key]: value });
  };

  const handleSave = () => {
    onSave(localSettings);
  };

  return (
    <div className="space-y-6">
      {/* Scheduler Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduler Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable Scheduler</p>
              <p className="text-xs text-gray-500">Automatically check properties on schedule</p>
            </div>
            <button
              onClick={() => handleToggle('schedulerEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localSettings.schedulerEnabled ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                localSettings.schedulerEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check Interval (days)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={localSettings.checkIntervalDays}
                onChange={(e) => handleChange('checkIntervalDays', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Properties Per Run</label>
              <input
                type="number"
                min="10"
                max="500"
                value={localSettings.maxPropertiesPerRun}
                onChange={(e) => handleChange('maxPropertiesPerRun', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Window Start (hour CST)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={localSettings.windowStartHour}
                onChange={(e) => handleChange('windowStartHour', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Window End (hour CST)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={localSettings.windowEndHour}
                onChange={(e) => handleChange('windowEndHour', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Sources</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">RPR (Realtors Property Resource)</p>
              <p className="text-xs text-gray-500">
                {settings.rprConfigured ? '✓ Credentials configured' : '✗ Credentials not configured'}
              </p>
            </div>
            <button
              onClick={() => handleToggle('rprEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localSettings.rprEnabled ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                localSettings.rprEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">MMI (Market Data)</p>
              <p className="text-xs text-gray-500">
                {settings.mmiConfigured ? '✓ Credentials configured' : '✗ Credentials not configured'}
              </p>
            </div>
            <button
              onClick={() => handleToggle('mmiEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localSettings.mmiEnabled ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                localSettings.mmiEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Email Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable Email Alerts</p>
              <p className="text-xs text-gray-500">Send email for high-priority alerts</p>
            </div>
            <button
              onClick={() => handleToggle('emailAlertsEnabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localSettings.emailAlertsEnabled ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                localSettings.emailAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
