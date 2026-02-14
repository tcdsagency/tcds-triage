'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CloudLightning,
  RefreshCw,
  Settings,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Bell,
  MapPin,
  Phone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  X,
  Users,
  Activity,
  Send,
} from 'lucide-react';
import { ALERT_TYPE_CATEGORIES, SEVERITY_LEVELS, SEVERITY_COLORS, ALL_ALERT_TYPES } from '@/lib/nws';

// =============================================================================
// TYPES
// =============================================================================

interface WeatherSettings {
  id?: string;
  isEnabled: boolean;
  pollIntervalMinutes: number;
  enabledAlertTypes: string[];
  minimumSeverity: string;
  pdsOnly: boolean;
  radiusMiles: number;
  smsEnabled: boolean;
  smsTemplate: string;
  staffPhoneNumbers: string[];
  maxSmsPerDay: number;
  smsSentToday: number;
  lastPollAt: string | null;
  lastPollStatus: string | null;
  lastPollError?: string | null;
  twilioConfigured: boolean;
}

interface Subscription {
  id: string;
  label: string | null;
  address: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
  nwsZone: string | null;
  customerId: string | null;
  customerName: string | null;
  notifyPhone: string | null;
  notifyCustomer: boolean;
  notifyStaff: boolean;
  isActive: boolean;
  createdAt: string;
}

interface PollRun {
  id: string;
  runId: string;
  runType: string;
  startedAt: string;
  completedAt: string | null;
  locationsChecked: number;
  alertsFound: number;
  notificationsSent: number;
  status: string;
  errorMessage: string | null;
}

interface SentAlert {
  id: string;
  nwsAlertId: string;
  event: string;
  severity: string;
  headline: string | null;
  areaDesc: string | null;
  isPds: boolean;
  onset: string | null;
  expires: string | null;
  subscriptionLabel: string | null;
  smsSentAt: string | null;
  smsStatus: string | null;
  smsRecipient: string | null;
  createdAt: string;
}

interface TestAlert {
  id: string;
  event: string;
  severity: string;
  headline: string | null;
  areaDesc: string;
  description: string;
  instruction: string | null;
  onset: string;
  expires: string;
  senderName: string;
  isPds: boolean;
  urgency: string;
  certainty: string;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

type TabKey = 'settings' | 'subscriptions' | 'log' | 'test';

export default function WeatherAlertsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('settings');
  const [settings, setSettings] = useState<WeatherSettings | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pollRuns, setPollRuns] = useState<PollRun[]>([]);
  const [sentAlerts, setSentAlerts] = useState<SentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Subscription management
  const [subSearch, setSubSearch] = useState('');
  const [subFilter, setSubFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Test tab
  const [testZip, setTestZip] = useState('');
  const [testLat, setTestLat] = useState('');
  const [testLon, setTestLon] = useState('');
  const [testAlerts, setTestAlerts] = useState<TestAlert[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testTwilioConfigured, setTestTwilioConfigured] = useState(false);

  // Log tab
  const [logTimeRange, setLogTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showRunHistory, setShowRunHistory] = useState(true);
  const [showRecentAlerts, setShowRecentAlerts] = useState(true);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/weather-alerts/settings');
      const data = await res.json();
      if (data.success) setSettings(data.settings);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (subFilter === 'active') params.set('active', 'true');
      if (subFilter === 'inactive') params.set('active', 'false');
      if (subSearch) params.set('search', subSearch);
      const res = await fetch(`/api/weather-alerts/subscriptions?${params}`);
      const data = await res.json();
      if (data.success) setSubscriptions(data.subscriptions);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    }
  }, [subFilter, subSearch]);

  const loadLogs = useCallback(async () => {
    try {
      const now = new Date();
      const dateFrom = new Date();
      if (logTimeRange === '24h') dateFrom.setHours(now.getHours() - 24);
      else if (logTimeRange === '7d') dateFrom.setDate(now.getDate() - 7);
      else dateFrom.setDate(now.getDate() - 30);

      const [runsRes, alertsRes] = await Promise.all([
        fetch(`/api/weather-alerts/logs?view=runs&dateFrom=${dateFrom.toISOString()}&limit=50`),
        fetch(`/api/weather-alerts/logs?view=alerts&dateFrom=${dateFrom.toISOString()}&limit=50`),
      ]);

      const runsData = await runsRes.json();
      const alertsData = await alertsRes.json();

      if (runsData.success) setPollRuns(runsData.runs);
      if (alertsData.success) setSentAlerts(alertsData.alerts);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }, [logTimeRange]);

  useEffect(() => {
    Promise.all([loadSettings(), loadSubscriptions()]).then(() => setLoading(false));
  }, [loadSettings, loadSubscriptions]);

  useEffect(() => {
    if (activeTab === 'subscriptions') loadSubscriptions();
  }, [activeTab, loadSubscriptions]);

  useEffect(() => {
    if (activeTab === 'log') loadLogs();
  }, [activeTab, loadLogs]);

  // ─── Settings Handlers ────────────────────────────────────────────────────

  const updateSetting = async (updates: Partial<WeatherSettings>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/weather-alerts/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => prev ? { ...prev, ...data.settings } : prev);
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleMasterEnable = () => {
    if (settings) updateSetting({ isEnabled: !settings.isEnabled });
  };

  // ─── Subscription Handlers ───────────────────────────────────────────────

  const toggleSubscription = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/weather-alerts/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      if ((await res.json()).success) loadSubscriptions();
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
    }
  };

  const deleteSubscription = async (id: string) => {
    if (!confirm('Remove this monitored location?')) return;
    try {
      const res = await fetch('/api/weather-alerts/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      if ((await res.json()).success) loadSubscriptions();
    } catch (err) {
      console.error('Failed to delete subscription:', err);
    }
  };

  // ─── Test Handlers ────────────────────────────────────────────────────────

  const runTest = async () => {
    setTestLoading(true);
    setTestError(null);
    setTestAlerts([]);
    try {
      const body: Record<string, unknown> = {};
      if (testLat && testLon) {
        body.lat = parseFloat(testLat);
        body.lon = parseFloat(testLon);
      } else if (testZip) {
        body.zip = testZip;
      } else {
        setTestError('Enter a zip code or lat/lon coordinates');
        setTestLoading(false);
        return;
      }

      const res = await fetch('/api/weather-alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setTestAlerts(data.alerts);
        setTestTwilioConfigured(data.twilioConfigured);
      } else {
        setTestError(data.error || 'Test failed');
      }
    } catch (err: any) {
      setTestError(err.message || 'Network error');
    } finally {
      setTestLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'settings', label: 'Settings' },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'log', label: 'Alert Log' },
    { key: 'test', label: 'Test' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CloudLightning className="w-7 h-7 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Weather Alerts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor NWS severe weather for insured properties
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Master toggle */}
          <button
            onClick={toggleMasterEnable}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              settings?.isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                settings?.isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {settings?.isEnabled ? 'Active' : 'Disabled'}
          </span>

          <button
            onClick={() => {
              loadSettings();
              loadSubscriptions();
              if (activeTab === 'log') loadLogs();
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Subscriptions"
          value={subscriptions.filter(s => s.isActive).length}
          total={subscriptions.length}
          icon={<MapPin className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          label="Alerts Today"
          value={sentAlerts.filter(a => isToday(a.createdAt)).length}
          icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
        />
        <StatCard
          label="SMS Sent Today"
          value={settings?.smsSentToday || 0}
          total={settings?.maxSmsPerDay}
          icon={<Send className="w-5 h-5 text-green-500" />}
        />
        <StatCard
          label="Last Poll"
          value={settings?.lastPollAt ? timeAgo(settings.lastPollAt) : 'Never'}
          status={settings?.lastPollStatus}
          icon={<Clock className="w-5 h-5 text-purple-500" />}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && settings && (
        <SettingsTab settings={settings} saving={saving} onUpdate={updateSetting} />
      )}
      {activeTab === 'subscriptions' && (
        <SubscriptionsTab
          subscriptions={subscriptions}
          search={subSearch}
          onSearchChange={setSubSearch}
          filter={subFilter}
          onFilterChange={setSubFilter}
          onToggle={toggleSubscription}
          onDelete={deleteSubscription}
          showAddModal={showAddModal}
          onShowAddModal={setShowAddModal}
          onAdded={loadSubscriptions}
        />
      )}
      {activeTab === 'log' && (
        <LogTab
          pollRuns={pollRuns}
          sentAlerts={sentAlerts}
          timeRange={logTimeRange}
          onTimeRangeChange={setLogTimeRange}
          expandedRun={expandedRun}
          onExpandRun={setExpandedRun}
          expandedAlert={expandedAlert}
          onExpandAlert={setExpandedAlert}
          showRunHistory={showRunHistory}
          onToggleRunHistory={() => setShowRunHistory(v => !v)}
          showRecentAlerts={showRecentAlerts}
          onToggleRecentAlerts={() => setShowRecentAlerts(v => !v)}
        />
      )}
      {activeTab === 'test' && (
        <TestTab
          zip={testZip}
          onZipChange={setTestZip}
          lat={testLat}
          onLatChange={setTestLat}
          lon={testLon}
          onLonChange={setTestLon}
          alerts={testAlerts}
          loading={testLoading}
          error={testError}
          twilioConfigured={testTwilioConfigured}
          onRunTest={runTest}
        />
      )}
    </div>
  );
}

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
  label,
  value,
  total,
  icon,
  status,
}: {
  label: string;
  value: number | string;
  total?: number;
  icon: React.ReactNode;
  status?: string | null;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        {icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
        {total !== undefined && (
          <span className="text-sm text-gray-400">/ {total}</span>
        )}
        {status && (
          <span className={`ml-2 text-xs font-medium ${
            status === 'success' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-gray-400'
          }`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SETTINGS TAB
// =============================================================================

function SettingsTab({
  settings,
  saving,
  onUpdate,
}: {
  settings: WeatherSettings;
  saving: boolean;
  onUpdate: (updates: Partial<WeatherSettings>) => void;
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [staffPhoneInput, setStaffPhoneInput] = useState('');

  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const handleSave = () => {
    onUpdate({
      pollIntervalMinutes: localSettings.pollIntervalMinutes,
      enabledAlertTypes: localSettings.enabledAlertTypes,
      minimumSeverity: localSettings.minimumSeverity,
      pdsOnly: localSettings.pdsOnly,
      radiusMiles: localSettings.radiusMiles,
      smsEnabled: localSettings.smsEnabled,
      smsTemplate: localSettings.smsTemplate,
      staffPhoneNumbers: localSettings.staffPhoneNumbers,
      maxSmsPerDay: localSettings.maxSmsPerDay,
    });
  };

  const toggleAlertType = (eventType: string) => {
    setLocalSettings(prev => ({
      ...prev,
      enabledAlertTypes: prev.enabledAlertTypes.includes(eventType)
        ? prev.enabledAlertTypes.filter(t => t !== eventType)
        : [...prev.enabledAlertTypes, eventType],
    }));
  };

  const toggleCategory = (category: string) => {
    const types = ALERT_TYPE_CATEGORIES[category] || [];
    const allSelected = types.every(t => localSettings.enabledAlertTypes.includes(t));
    setLocalSettings(prev => ({
      ...prev,
      enabledAlertTypes: allSelected
        ? prev.enabledAlertTypes.filter(t => !types.includes(t))
        : [...new Set([...prev.enabledAlertTypes, ...types])],
    }));
  };

  const addStaffPhone = () => {
    const phone = staffPhoneInput.trim();
    if (phone && !localSettings.staffPhoneNumbers.includes(phone)) {
      setLocalSettings(prev => ({
        ...prev,
        staffPhoneNumbers: [...prev.staffPhoneNumbers, phone],
      }));
      setStaffPhoneInput('');
    }
  };

  const removeStaffPhone = (phone: string) => {
    setLocalSettings(prev => ({
      ...prev,
      staffPhoneNumbers: prev.staffPhoneNumbers.filter(p => p !== phone),
    }));
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Alert Type Selection */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Alert Types to Monitor
        </h3>
        <div className="space-y-4">
          {Object.entries(ALERT_TYPE_CATEGORIES).map(([category, types]) => {
            const allSelected = types.every(t => localSettings.enabledAlertTypes.includes(t));
            const someSelected = types.some(t => localSettings.enabledAlertTypes.includes(t));
            return (
              <div key={category} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleCategory(category)}
                    className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{category}</span>
                </label>
                <div className="grid grid-cols-2 gap-1 ml-6">
                  {types.map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={localSettings.enabledAlertTypes.includes(type)}
                        onChange={() => toggleAlertType(type)}
                        className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Severity & Filtering */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Filtering
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum Severity
            </label>
            <select
              value={localSettings.minimumSeverity}
              onChange={e => setLocalSettings(prev => ({ ...prev, minimumSeverity: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {SEVERITY_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Poll Interval (minutes)
            </label>
            <select
              value={localSettings.pollIntervalMinutes}
              onChange={e => setLocalSettings(prev => ({ ...prev, pollIntervalMinutes: parseInt(e.target.value) }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {[5, 10, 15, 30, 60].map(v => (
                <option key={v} value={v}>{v} min</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Radius (miles)
            </label>
            <input
              type="number"
              value={localSettings.radiusMiles}
              onChange={e => setLocalSettings(prev => ({ ...prev, radiusMiles: parseInt(e.target.value) || 25 }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              min={1}
              max={100}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="pdsOnly"
              checked={localSettings.pdsOnly}
              onChange={e => setLocalSettings(prev => ({ ...prev, pdsOnly: e.target.checked }))}
              className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
            />
            <label htmlFor="pdsOnly" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              PDS (Particularly Dangerous Situation) only
            </label>
          </div>
        </div>
      </section>

      {/* SMS Settings */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          SMS Notifications
        </h3>
        {!settings.twilioConfigured && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables.
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smsEnabled"
              checked={localSettings.smsEnabled}
              onChange={e => setLocalSettings(prev => ({ ...prev, smsEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
              disabled={!settings.twilioConfigured}
            />
            <label htmlFor="smsEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Enable SMS alerts
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SMS Template
            </label>
            <textarea
              value={localSettings.smsTemplate}
              onChange={e => setLocalSettings(prev => ({ ...prev, smsTemplate: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono"
              placeholder="WEATHER ALERT: {{event}} for {{location}}..."
            />
            <p className="text-xs text-gray-400 mt-1">
              Merge fields: {'{{event}}'}, {'{{location}}'}, {'{{headline}}'}, {'{{severity}}'}, {'{{expires}}'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Staff Phone Numbers
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="tel"
                value={staffPhoneInput}
                onChange={e => setStaffPhoneInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addStaffPhone()}
                placeholder="+1234567890"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              <button
                onClick={addStaffPhone}
                className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {localSettings.staffPhoneNumbers.map(phone => (
                <span key={phone} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                  <Phone className="w-3 h-3" />
                  {phone}
                  <button onClick={() => removeStaffPhone(phone)} className="text-gray-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max SMS per Day
            </label>
            <input
              type="number"
              value={localSettings.maxSmsPerDay}
              onChange={e => setLocalSettings(prev => ({ ...prev, maxSmsPerDay: parseInt(e.target.value) || 50 }))}
              className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              min={1}
              max={500}
            />
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SUBSCRIPTIONS TAB
// =============================================================================

function SubscriptionsTab({
  subscriptions,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onToggle,
  onDelete,
  showAddModal,
  onShowAddModal,
  onAdded,
}: {
  subscriptions: Subscription[];
  search: string;
  onSearchChange: (v: string) => void;
  filter: 'all' | 'active' | 'inactive';
  onFilterChange: (v: 'all' | 'active' | 'inactive') => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  showAddModal: boolean;
  onShowAddModal: (v: boolean) => void;
  onAdded: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search locations..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
        </div>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-2 text-xs font-medium capitalize ${
                filter === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => onShowAddModal(true)}
          className="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {/* Table */}
      {subscriptions.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No monitored locations yet</p>
          <p className="text-xs mt-1">Add locations to start monitoring weather alerts</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Label</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Zip</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">NWS Zone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Notify</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {subscriptions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {sub.label || sub.address || sub.zip}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{sub.zip || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{sub.nwsZone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{sub.customerName || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {sub.notifyStaff && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          <Users className="w-3 h-3" /> Staff
                        </span>
                      )}
                      {sub.notifyCustomer && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          <Phone className="w-3 h-3" /> Customer
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      sub.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sub.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {sub.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onToggle(sub.id, !sub.isActive)}
                        className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={sub.isActive ? 'Pause' : 'Activate'}
                      >
                        {sub.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => onDelete(sub.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddSubscriptionModal
          onClose={() => onShowAddModal(false)}
          onAdded={() => { onShowAddModal(false); onAdded(); }}
        />
      )}
    </div>
  );
}

// =============================================================================
// ADD SUBSCRIPTION MODAL
// =============================================================================

function AddSubscriptionModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [notifyStaff, setNotifyStaff] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zip && !address && !(lat && lon)) {
      setError('Enter at least a zip code, address, or coordinates');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { label, address, zip, notifyStaff, notifyCustomer, notifyPhone };
      if (lat && lon) { body.lat = parseFloat(lat); body.lon = parseFloat(lon); }

      const res = await fetch('/api/weather-alerts/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onAdded();
      } else {
        setError(data.error || 'Failed to add');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Monitored Location</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g., Main Office, Smith Residence"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, City, ST"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zip Code</label>
              <input
                type="text"
                value={zip}
                onChange={e => setZip(e.target.value)}
                placeholder="32003"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
              <input
                type="text"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="30.1234"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
              <input
                type="text"
                value={lon}
                onChange={e => setLon(e.target.value)}
                placeholder="-81.5678"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notify Phone (optional)</label>
            <input
              type="tel"
              value={notifyPhone}
              onChange={e => setNotifyPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={notifyStaff} onChange={e => setNotifyStaff(e.target.checked)}
                className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
              Notify Staff
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)}
                className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
              Notify Customer
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
              {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
              Add Location
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// LOG TAB
// =============================================================================

function LogTab({
  pollRuns,
  sentAlerts,
  timeRange,
  onTimeRangeChange,
  expandedRun,
  onExpandRun,
  expandedAlert,
  onExpandAlert,
  showRunHistory,
  onToggleRunHistory,
  showRecentAlerts,
  onToggleRecentAlerts,
}: {
  pollRuns: PollRun[];
  sentAlerts: SentAlert[];
  timeRange: '24h' | '7d' | '30d';
  onTimeRangeChange: (v: '24h' | '7d' | '30d') => void;
  expandedRun: string | null;
  onExpandRun: (v: string | null) => void;
  expandedAlert: string | null;
  onExpandAlert: (v: string | null) => void;
  showRunHistory: boolean;
  onToggleRunHistory: () => void;
  showRecentAlerts: boolean;
  onToggleRecentAlerts: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(['24h', '7d', '30d'] as const).map(range => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-1.5 text-xs font-medium ${
                timeRange === range
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-2">
          {pollRuns.length} runs, {sentAlerts.length} alerts
        </span>
      </div>

      {/* Poll History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <button
          onClick={onToggleRunHistory}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750"
        >
          <div className="flex items-center gap-2">
            {showRunHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Activity className="w-4 h-4 text-purple-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">Poll History</span>
            <span className="text-xs text-gray-400">({pollRuns.length})</span>
          </div>
        </button>
        {showRunHistory && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            {pollRuns.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No poll runs in this time range</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-750">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Time</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Checked</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Found</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Sent</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pollRuns.map(run => (
                    <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatDateTime(run.startedAt)}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 capitalize">{run.runType}</td>
                      <td className="px-4 py-2 text-center">{run.locationsChecked}</td>
                      <td className="px-4 py-2 text-center">{run.alertsFound}</td>
                      <td className="px-4 py-2 text-center">{run.notificationsSent}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={run.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <button
          onClick={onToggleRecentAlerts}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750"
        >
          <div className="flex items-center gap-2">
            {showRecentAlerts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">Recent Alerts</span>
            <span className="text-xs text-gray-400">({sentAlerts.length})</span>
          </div>
        </button>
        {showRecentAlerts && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            {sentAlerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No alerts detected in this time range</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {sentAlerts.map(alert => (
                  <div key={alert.id}>
                    <button
                      onClick={() => onExpandAlert(expandedAlert === alert.id ? null : alert.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 text-left"
                    >
                      {expandedAlert === alert.id ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <SeverityBadge severity={alert.severity} isPds={alert.isPds} />
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{alert.event}</span>
                      <span className="text-xs text-gray-400 shrink-0">{alert.subscriptionLabel || '—'}</span>
                      <span className="text-xs text-gray-400 shrink-0 ml-auto">{formatDateTime(alert.createdAt)}</span>
                      {alert.smsStatus && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          alert.smsStatus === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          SMS {alert.smsStatus}
                        </span>
                      )}
                    </button>
                    {expandedAlert === alert.id && (
                      <div className="px-4 pb-3 ml-8 text-sm space-y-1">
                        {alert.headline && <p className="text-gray-700 dark:text-gray-300">{alert.headline}</p>}
                        {alert.areaDesc && <p className="text-gray-500 dark:text-gray-400">Area: {alert.areaDesc}</p>}
                        {alert.onset && <p className="text-gray-500 dark:text-gray-400">Onset: {formatDateTime(alert.onset)}</p>}
                        {alert.expires && <p className="text-gray-500 dark:text-gray-400">Expires: {formatDateTime(alert.expires)}</p>}
                        {alert.smsRecipient && <p className="text-gray-500 dark:text-gray-400">SMS to: {alert.smsRecipient}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// TEST TAB
// =============================================================================

function TestTab({
  zip,
  onZipChange,
  lat,
  onLatChange,
  lon,
  onLonChange,
  alerts,
  loading,
  error,
  twilioConfigured,
  onRunTest,
}: {
  zip: string;
  onZipChange: (v: string) => void;
  lat: string;
  onLatChange: (v: string) => void;
  lon: string;
  onLonChange: (v: string) => void;
  alerts: TestAlert[];
  loading: boolean;
  error: string | null;
  twilioConfigured: boolean;
  onRunTest: () => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Input */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Test NWS API</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zip Code</label>
            <input
              type="text"
              value={zip}
              onChange={e => onZipChange(e.target.value)}
              placeholder="e.g., 32003"
              className="w-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              maxLength={10}
            />
          </div>
          <div className="text-xs text-gray-400 uppercase font-medium">— or —</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
              <input
                type="text"
                value={lat}
                onChange={e => onLatChange(e.target.value)}
                placeholder="30.1234"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
              <input
                type="text"
                value={lon}
                onChange={e => onLonChange(e.target.value)}
                placeholder="-81.5678"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={onRunTest}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Test NWS API
          </button>
        </div>
      </div>

      {/* Twilio Status */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
        twilioConfigured
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
      }`}>
        {twilioConfigured
          ? <><CheckCircle2 className="w-4 h-4" /> Twilio SMS configured and ready</>
          : <><AlertTriangle className="w-4 h-4" /> Twilio SMS not configured</>
        }
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <XCircle className="w-4 h-4 inline mr-1" /> {error}
        </div>
      )}

      {/* Results */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''} Found
          </h4>
          {alerts.map(alert => (
            <div key={alert.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={alert.severity} isPds={alert.isPds} />
                <span className="font-semibold text-gray-900 dark:text-gray-100">{alert.event}</span>
                {alert.isPds && (
                  <span className="text-xs font-bold px-1.5 py-0.5 bg-red-600 text-white rounded">PDS</span>
                )}
              </div>
              {alert.headline && (
                <p className="text-sm text-gray-700 dark:text-gray-300">{alert.headline}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Area: {alert.areaDesc}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Issued by: {alert.senderName} | Urgency: {alert.urgency} | Certainty: {alert.certainty}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Onset: {formatDateTime(alert.onset)} | Expires: {formatDateTime(alert.expires)}
              </p>
              {alert.description && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-600">Full description</summary>
                  <p className="mt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{alert.description}</p>
                </details>
              )}
              {alert.instruction && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-400 hover:text-gray-600">Instructions</summary>
                  <p className="mt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{alert.instruction}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <CloudLightning className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Enter a location and click Test to check for active NWS alerts</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

function SeverityBadge({ severity, isPds }: { severity: string; isPds?: boolean }) {
  const colorMap: Record<string, string> = {
    Extreme: 'bg-red-600 text-white',
    Severe: 'bg-orange-500 text-white',
    Moderate: 'bg-yellow-500 text-black',
    Minor: 'bg-blue-400 text-white',
    Unknown: 'bg-gray-400 text-white',
  };
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${colorMap[severity] || colorMap.Unknown} ${isPds ? 'ring-2 ring-red-400' : ''}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.error}`}>
      {status}
    </span>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
