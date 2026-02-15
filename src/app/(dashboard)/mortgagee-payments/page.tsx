'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  AlertTriangle,
  Home,
  Activity,
  Settings,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Building2,
  TrendingUp,
  Pause,
  AlertCircle,
  Calendar,
  DollarSign,
  ChevronRight,
} from 'lucide-react';

interface Stats {
  totalMortgagees: number;
  byStatus: Record<string, number>;
  checksLast24h: number;
  checksLast7d: number;
  successRate: string;
  needsCheck: number;
  lastRun?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    policiesChecked: number;
    latePaymentsFound: number;
    lapsedFound: number;
    errorsEncountered: number;
  };
}

interface MortgageeRow {
  mortgagee: {
    id: string;
    name: string;
    loanNumber?: string;
    currentPaymentStatus: string;
    lastPaymentCheckAt?: string;
    paidThroughDate?: string;
    nextDueDate?: string;
    amountDue?: string;
  };
  policy: {
    id: string;
    policyNumber: string;
    carrier?: string;
    expirationDate?: string;
    status?: string;
  };
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  property?: {
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bgColor: string; label: string }> = {
  current: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Current',
  },
  late: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Late',
  },
  grace_period: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Grace Period',
  },
  lapsed: {
    icon: AlertCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-200',
    label: 'LAPSED',
  },
  unknown: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    label: 'Unknown',
  },
  error: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Error',
  },
};

export default function MortgageePaymentsPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'policies' | 'activity' | 'settings'>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [mortgagees, setMortgagees] = useState<MortgageeRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/mortgagee-payments/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchMortgagees = useCallback(async () => {
    try {
      let url = '/api/mortgagee-payments?limit=100';
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMortgagees(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching mortgagees:', error);
    }
  }, [statusFilter]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchMortgagees()]);
      setLoading(false);
    };
    loadData();
  }, [fetchStats, fetchMortgagees]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchMortgagees()]);
    setRefreshing(false);
  };

  const handleTriggerRun = async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/mortgagee-payments/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Manual-Trigger': 'true',
        },
      });
      const data = await res.json();
      if (data.success) {
        // Refresh stats after run
        await fetchStats();
      }
    } catch (error) {
      console.error('Error triggering run:', error);
    } finally {
      setTriggering(false);
    }
  };

  const handleCheckPayment = async (mortgageeId: string) => {
    try {
      const res = await fetch('/api/mortgagee-payments/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mortgageeId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the list
        await fetchMortgagees();
        await fetchStats();
      }
    } catch (error) {
      console.error('Error checking payment:', error);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'policies', label: 'Tracked Policies', icon: Building2, count: stats?.totalMortgagees },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-emerald-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                Mortgagee Payment Tracker
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleTriggerRun}
                disabled={triggering}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50"
              >
                <Play className={`h-4 w-4 ${triggering ? 'animate-pulse' : ''}`} />
                {triggering ? 'Running...' : 'Run Check'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {'count' in tab && tab.count !== undefined && (
                    <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <DashboardTab stats={stats} />
        ) : activeTab === 'policies' ? (
          <PoliciesTab
            mortgagees={mortgagees}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onCheckPayment={handleCheckPayment}
            counts={stats?.byStatus || {}}
          />
        ) : activeTab === 'activity' ? (
          <ActivityTab />
        ) : (
          <SettingsTab />
        )}
      </div>
    </div>
  );
}

function DashboardTab({ stats }: { stats: Stats | null }) {
  if (!stats) return null;

  const statCards = [
    {
      label: 'Total Tracked',
      value: stats.totalMortgagees,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Current',
      value: stats.byStatus.current || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Late/Lapsed',
      value: (stats.byStatus.late || 0) + (stats.byStatus.lapsed || 0),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Needs Check',
      value: stats.needsCheck,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-semibold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last Run Info */}
      {stats.lastRun && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Last Scheduler Run</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Status</p>
              <p className={`font-medium ${stats.lastRun.status === 'completed' ? 'text-green-600' : 'text-gray-900'}`}>
                {stats.lastRun.status}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Checked</p>
              <p className="font-medium">{stats.lastRun.policiesChecked}</p>
            </div>
            <div>
              <p className="text-gray-500">Late Found</p>
              <p className="font-medium text-yellow-600">{stats.lastRun.latePaymentsFound}</p>
            </div>
            <div>
              <p className="text-gray-500">Lapsed Found</p>
              <p className="font-medium text-red-600">{stats.lastRun.lapsedFound}</p>
            </div>
            <div>
              <p className="text-gray-500">Errors</p>
              <p className="font-medium">{stats.lastRun.errorsEncountered}</p>
            </div>
          </div>
        </div>
      )}

      {/* Checks Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Checks (24h)</p>
          <p className="text-2xl font-semibold">{stats.checksLast24h}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Checks (7d)</p>
          <p className="text-2xl font-semibold">{stats.checksLast7d}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Success Rate</p>
          <p className="text-2xl font-semibold">{stats.successRate}</p>
        </div>
      </div>
    </div>
  );
}

function PoliciesTab({
  mortgagees,
  statusFilter,
  setStatusFilter,
  onCheckPayment,
  counts,
}: {
  mortgagees: MortgageeRow[];
  statusFilter: string | null;
  setStatusFilter: (s: string | null) => void;
  onCheckPayment: (id: string) => void;
  counts: Record<string, number>;
}) {
  const [checking, setChecking] = useState<string | null>(null);

  const handleCheck = async (mortgageeId: string) => {
    setChecking(mortgageeId);
    await onCheckPayment(mortgageeId);
    setChecking(null);
  };

  const statusFilters = [
    { id: null, label: 'All' },
    { id: 'current', label: 'Current', count: counts.current },
    { id: 'late', label: 'Late', count: counts.late },
    { id: 'lapsed', label: 'Lapsed', count: counts.lapsed },
    { id: 'unknown', label: 'Unknown', count: counts.unknown },
  ];

  return (
    <div className="space-y-4">
      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((filter) => (
          <button
            key={filter.id || 'all'}
            onClick={() => setStatusFilter(filter.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              statusFilter === filter.id
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span className="ml-1 text-xs">({filter.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer / Policy
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mortgagee
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Checked
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mortgagees.map((row) => {
              const status = STATUS_CONFIG[row.mortgagee.currentPaymentStatus] || STATUS_CONFIG.unknown;
              const StatusIcon = status.icon;
              const isChecking = checking === row.mortgagee.id;

              return (
                <tr key={row.mortgagee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {row.customer?.firstName} {row.customer?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {row.policy?.policyNumber} - {row.policy?.carrier}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{row.mortgagee.name}</div>
                    {row.mortgagee.loanNumber && (
                      <div className="text-sm text-gray-500">Loan: {row.mortgagee.loanNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {row.mortgagee.lastPaymentCheckAt
                      ? new Date(row.mortgagee.lastPaymentCheckAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleCheck(row.mortgagee.id)}
                      disabled={isChecking}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium disabled:opacity-50"
                    >
                      {isChecking ? (
                        <RefreshCw className="h-4 w-4 animate-spin inline" />
                      ) : (
                        'Check'
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {mortgagees.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No mortgagees found
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/mortgagee-payments/stats');
        const data = await res.json();
        if (data.success && data.stats?.recentActivity) {
          setLogs(data.stats.recentActivity);
        }
      } catch (error) {
        console.error('Error fetching activity:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900">Recent Activity</h3>
      </div>
      {logs.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p>No activity recorded yet</p>
          <p className="text-xs mt-1">Run a check to see activity here</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {logs.map((log, i) => (
            <div key={i} className="px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{log.runType} run</p>
                  <p className="text-xs text-gray-500">
                    {log.policiesChecked} checked, {log.latePaymentsFound} late, {log.errorsEncountered} errors
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    log.status === 'completed' ? 'bg-green-100 text-green-700' :
                    log.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {log.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(log.startedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Settings {
  isPaused: boolean;
  scheduleStartHour: number;
  scheduleEndHour: number;
  dailyCheckBudget: number;
  recheckDays: number;
  delayBetweenChecksMs: number;
  alertOnLatePayment: boolean;
  alertOnLapsed: boolean;
  emailNotificationsEnabled: boolean;
  emailRecipients: string[];
  microserviceUrl: string | null;
  microserviceApiKey?: string;
  twoCaptchaBalance: number | null;
}

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/mortgagee-payments/settings');
        const data = await res.json();
        if (data.success) {
          setSettings(data.settings);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/mortgagee-payments/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: 'Settings saved successfully' });
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to save' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings?.microserviceUrl) {
      setTestResult({ success: false, message: 'Microservice URL not configured' });
      return;
    }

    setTestResult(null);
    try {
      const res = await fetch('/api/mortgagee-payments/test-connection', { method: 'POST' });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch (error: any) {
      setTestResult({ success: false, message: `Connection failed: ${error.message}` });
    }
  };

  const handleSyncMortgagees = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/mortgagee-payments/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await res.json();
      setSyncResult(data);
    } catch (error: any) {
      setSyncResult({ success: false, error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-red-600">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Microservice Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900">MCI Checker Microservice</h3>
          <p className="text-xs text-gray-500 mt-0.5">Configure the payment verification service</p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Microservice URL
            </label>
            <input
              type="url"
              value={settings.microserviceUrl || ''}
              onChange={(e) => setSettings({ ...settings, microserviceUrl: e.target.value || null })}
              placeholder="https://mci-checker-production.up.railway.app"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={settings.microserviceApiKey || ''}
              onChange={(e) => setSettings({ ...settings, microserviceApiKey: e.target.value })}
              placeholder="Enter API key for the microservice"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
            >
              Test Connection
            </button>
            {testResult && (
              <span className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.message}
              </span>
            )}
          </div>
          {settings.twoCaptchaBalance !== null && (
            <p className="text-xs text-gray-500">
              2Captcha Balance: ${settings.twoCaptchaBalance?.toFixed(2) || '0.00'}
            </p>
          )}
        </div>
      </div>

      {/* Sync Mortgagees */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900">Import Mortgagees</h3>
          <p className="text-xs text-gray-500 mt-0.5">Sync mortgagee data from HawkSoft policies</p>
        </div>
        <div className="p-4">
          <button
            onClick={handleSyncMortgagees}
            disabled={syncing}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync from HawkSoft'}
          </button>
          {syncResult && (
            <div className={`mt-3 p-3 rounded-md text-sm ${syncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {syncResult.success ? (
                <div>
                  <p className="font-medium">Sync completed in {syncResult.duration}ms</p>
                  <ul className="mt-1 text-xs space-y-0.5">
                    <li>Policies scanned: {syncResult.results?.policiesScanned || 0}</li>
                    <li>Mortgagees found: {syncResult.results?.mortgageesFound || 0}</li>
                    <li>Created: {syncResult.results?.mortgageesCreated || 0}</li>
                    <li>Updated: {syncResult.results?.mortgageesUpdated || 0}</li>
                    <li>Errors: {syncResult.results?.errors || 0}</li>
                  </ul>
                </div>
              ) : (
                <p>{syncResult.error || 'Sync failed'}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Settings */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900">Schedule Settings</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Scheduler Paused</p>
              <p className="text-xs text-gray-500">Temporarily disable automated checks</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, isPaused: !settings.isPaused })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.isPaused ? 'bg-gray-300' : 'bg-emerald-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.isPaused ? 'translate-x-1' : 'translate-x-6'
              }`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Hour (CST)
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={settings.scheduleStartHour}
                onChange={(e) => setSettings({ ...settings, scheduleStartHour: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Hour (CST)
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={settings.scheduleEndHour}
                onChange={(e) => setSettings({ ...settings, scheduleEndHour: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Check Budget
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={settings.dailyCheckBudget}
                onChange={(e) => setSettings({ ...settings, dailyCheckBudget: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recheck Interval (days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.recheckDays}
                onChange={(e) => setSettings({ ...settings, recheckDays: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delay Between Checks (seconds)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={Math.round(settings.delayBetweenChecksMs / 1000)}
              onChange={(e) => setSettings({ ...settings, delayBetweenChecksMs: parseInt(e.target.value) * 1000 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900">Alerts</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Alert on late payments</p>
            <button
              onClick={() => setSettings({ ...settings, alertOnLatePayment: !settings.alertOnLatePayment })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.alertOnLatePayment ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.alertOnLatePayment ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Alert on lapsed policies</p>
            <button
              onClick={() => setSettings({ ...settings, alertOnLapsed: !settings.alertOnLapsed })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.alertOnLapsed ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.alertOnLapsed ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
