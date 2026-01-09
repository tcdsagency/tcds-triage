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
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-gray-500 text-center">Activity log coming soon...</p>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-gray-500 text-center">Settings panel coming soon...</p>
    </div>
  );
}
