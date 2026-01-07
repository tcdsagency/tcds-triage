"use client";

import { useState, useEffect } from "react";
import {
  Phone,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  Target,
  Calendar,
  Download,
  Filter,
  ChevronDown,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Star,
  Award,
  ThumbsUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

type DateRange = "today" | "7d" | "30d" | "90d" | "ytd" | "custom";
type ReportTab = "overview" | "agents" | "carriers" | "calls" | "policies";

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ReactNode;
  color: string;
}

interface AgentPerformance {
  id: string;
  name: string;
  avatar?: string;
  calls: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  avgCallTime: string;
  satisfaction: number;
  trend: "up" | "down" | "stable";
}

interface CarrierStats {
  carrier: string;
  logo?: string;
  policies: number;
  premium: number;
  retention: number;
  claims: number;
  lossRatio: number;
}

// =============================================================================
// DATA
// =============================================================================

const METRICS: MetricCard[] = [
  {
    title: "Total Calls",
    value: "2,847",
    change: 12.5,
    changeLabel: "vs last period",
    icon: <Phone className="h-5 w-5" />,
    color: "bg-blue-500",
  },
  {
    title: "New Policies",
    value: 156,
    change: 8.3,
    changeLabel: "vs last period",
    icon: <FileText className="h-5 w-5" />,
    color: "bg-green-500",
  },
  {
    title: "Revenue",
    value: "$284,520",
    change: 15.2,
    changeLabel: "vs last period",
    icon: <DollarSign className="h-5 w-5" />,
    color: "bg-emerald-500",
  },
  {
    title: "Conversion Rate",
    value: "34.2%",
    change: -2.1,
    changeLabel: "vs last period",
    icon: <Target className="h-5 w-5" />,
    color: "bg-purple-500",
  },
  {
    title: "Retention Rate",
    value: "92.4%",
    change: 1.8,
    changeLabel: "vs last period",
    icon: <Users className="h-5 w-5" />,
    color: "bg-orange-500",
  },
  {
    title: "Avg Handle Time",
    value: "4:32",
    change: -8.5,
    changeLabel: "vs last period",
    icon: <Clock className="h-5 w-5" />,
    color: "bg-cyan-500",
  },
];

const AGENT_PERFORMANCE: AgentPerformance[] = [
  {
    id: "1",
    name: "Sarah Mitchell",
    calls: 342,
    conversions: 128,
    conversionRate: 37.4,
    revenue: 52400,
    avgCallTime: "4:15",
    satisfaction: 4.8,
    trend: "up",
  },
  {
    id: "2",
    name: "Mike Rodriguez",
    calls: 298,
    conversions: 104,
    conversionRate: 34.9,
    revenue: 45200,
    avgCallTime: "4:45",
    satisfaction: 4.6,
    trend: "up",
  },
  {
    id: "3",
    name: "Lisa Chen",
    calls: 276,
    conversions: 89,
    conversionRate: 32.2,
    revenue: 38900,
    avgCallTime: "5:02",
    satisfaction: 4.7,
    trend: "stable",
  },
  {
    id: "4",
    name: "John Davis",
    calls: 254,
    conversions: 76,
    conversionRate: 29.9,
    revenue: 32100,
    avgCallTime: "4:28",
    satisfaction: 4.4,
    trend: "down",
  },
  {
    id: "5",
    name: "Emily Park",
    calls: 231,
    conversions: 71,
    conversionRate: 30.7,
    revenue: 29800,
    avgCallTime: "4:55",
    satisfaction: 4.5,
    trend: "up",
  },
];

const CARRIER_STATS: CarrierStats[] = [
  {
    carrier: "Progressive",
    policies: 487,
    premium: 892000,
    retention: 94.2,
    claims: 23,
    lossRatio: 0.52,
  },
  {
    carrier: "State Farm",
    policies: 412,
    premium: 756000,
    retention: 93.8,
    claims: 19,
    lossRatio: 0.48,
  },
  {
    carrier: "GEICO",
    policies: 356,
    premium: 634000,
    retention: 91.5,
    claims: 28,
    lossRatio: 0.61,
  },
  {
    carrier: "Allstate",
    policies: 298,
    premium: 545000,
    retention: 92.1,
    claims: 15,
    lossRatio: 0.45,
  },
  {
    carrier: "Liberty Mutual",
    policies: 234,
    premium: 423000,
    retention: 89.7,
    claims: 21,
    lossRatio: 0.58,
  },
];

const CALL_DISPOSITIONS = [
  { label: "Quoted", value: 892, color: "#3B82F6", percentage: 31.3 },
  { label: "Bound", value: 456, color: "#10B981", percentage: 16.0 },
  { label: "Follow-up", value: 623, color: "#F59E0B", percentage: 21.9 },
  { label: "Not Interested", value: 542, color: "#EF4444", percentage: 19.0 },
  { label: "Other", value: 334, color: "#6B7280", percentage: 11.7 },
];

const HOURLY_DATA = [
  { hour: "8am", calls: 45, conversions: 12 },
  { hour: "9am", calls: 78, conversions: 24 },
  { hour: "10am", calls: 112, conversions: 38 },
  { hour: "11am", calls: 134, conversions: 45 },
  { hour: "12pm", calls: 98, conversions: 31 },
  { hour: "1pm", calls: 87, conversions: 28 },
  { hour: "2pm", calls: 123, conversions: 42 },
  { hour: "3pm", calls: 145, conversions: 52 },
  { hour: "4pm", calls: 132, conversions: 48 },
  { hour: "5pm", calls: 89, conversions: 29 },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  const options: { value: DateRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "90d", label: "Last 90 Days" },
    { value: "ytd", label: "Year to Date" },
  ];

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === opt.value
              ? "bg-indigo-100 text-indigo-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MetricCardComponent({ metric }: { metric: MetricCard }) {
  const isPositive = metric.change >= 0;
  const changeColor = isPositive ? "text-green-600" : "text-red-600";
  const ChangIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className={`${metric.color} p-3 rounded-xl text-white`}>
          {metric.icon}
        </div>
        <div className={`flex items-center gap-1 ${changeColor}`}>
          <ChangIcon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {Math.abs(metric.change)}%
          </span>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-500">{metric.title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
        <p className="text-xs text-gray-400 mt-1">{metric.changeLabel}</p>
      </div>
    </div>
  );
}

function TrendChart() {
  const maxCalls = Math.max(...HOURLY_DATA.map((d) => d.calls));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Call Volume by Hour</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            Calls
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            Conversions
          </span>
        </div>
      </div>
      <div className="h-64 flex items-end gap-2">
        {HOURLY_DATA.map((data, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col items-center gap-1">
              <div
                className="w-full bg-blue-500/20 rounded-t relative group"
                style={{ height: `${(data.calls / maxCalls) * 180}px` }}
              >
                <div
                  className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all"
                  style={{ height: `${(data.calls / maxCalls) * 180}px` }}
                />
                <div
                  className="absolute bottom-0 w-full bg-green-500 rounded-t"
                  style={{
                    height: `${(data.conversions / maxCalls) * 180}px`,
                  }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500">{data.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DispositionChart() {
  const total = CALL_DISPOSITIONS.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Call Dispositions</h3>
      <div className="flex gap-6">
        {/* Pie chart visualization */}
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            {(() => {
              let currentOffset = 0;
              return CALL_DISPOSITIONS.map((item, idx) => {
                const dashArray = item.percentage;
                const dashOffset = 100 - currentOffset;
                currentOffset += dashArray;
                return (
                  <circle
                    key={idx}
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke={item.color}
                    strokeWidth="3"
                    strokeDasharray={`${dashArray} ${100 - dashArray}`}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 18 18)"
                  />
                );
              });
            })()}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500">Calls</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {CALL_DISPOSITIONS.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {item.value}
                </span>
                <span className="text-xs text-gray-500">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentLeaderboard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Agent Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Agent
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Calls
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Conversions
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Conv. Rate
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Revenue
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Avg Time
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                CSAT
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {AGENT_PERFORMANCE.map((agent, idx) => (
              <tr key={agent.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        idx === 0
                          ? "bg-yellow-500"
                          : idx === 1
                          ? "bg-gray-400"
                          : idx === 2
                          ? "bg-orange-400"
                          : "bg-indigo-500"
                      }`}
                    >
                      {idx < 3 ? (
                        <Award className="h-4 w-4" />
                      ) : (
                        agent.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{agent.name}</p>
                      {idx === 0 && (
                        <span className="text-xs text-yellow-600">
                          Top Performer
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center text-sm text-gray-900">
                  {agent.calls}
                </td>
                <td className="px-4 py-4 text-center text-sm text-gray-900">
                  {agent.conversions}
                </td>
                <td className="px-4 py-4 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      agent.conversionRate >= 35
                        ? "bg-green-100 text-green-700"
                        : agent.conversionRate >= 30
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {agent.conversionRate}%
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-sm font-medium text-gray-900">
                  ${agent.revenue.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-center text-sm text-gray-600">
                  {agent.avgCallTime}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-medium">
                      {agent.satisfaction}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  {agent.trend === "up" ? (
                    <TrendingUp className="h-5 w-5 text-green-500 mx-auto" />
                  ) : agent.trend === "down" ? (
                    <TrendingDown className="h-5 w-5 text-red-500 mx-auto" />
                  ) : (
                    <div className="h-0.5 w-5 bg-gray-300 mx-auto" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CarrierBreakdown() {
  const maxPremium = Math.max(...CARRIER_STATS.map((c) => c.premium));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Carrier Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Carrier
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Policies
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Premium
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Retention
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Claims
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Loss Ratio
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CARRIER_STATS.map((carrier) => (
              <tr key={carrier.carrier} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <span className="font-medium text-gray-900">
                    {carrier.carrier}
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-sm text-gray-900">
                  {carrier.policies}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{
                          width: `${(carrier.premium / maxPremium) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-20 text-right">
                      ${(carrier.premium / 1000).toFixed(0)}K
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      carrier.retention >= 93
                        ? "bg-green-100 text-green-700"
                        : carrier.retention >= 90
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {carrier.retention}%
                  </span>
                </td>
                <td className="px-4 py-4 text-center text-sm text-gray-600">
                  {carrier.claims}
                </td>
                <td className="px-4 py-4 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      carrier.lossRatio <= 0.5
                        ? "bg-green-100 text-green-700"
                        : carrier.lossRatio <= 0.6
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {(carrier.lossRatio * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickStats() {
  const stats = [
    {
      label: "Avg Calls/Agent/Day",
      value: "28.4",
      icon: <Phone className="h-4 w-4" />,
    },
    {
      label: "First Call Resolution",
      value: "78.3%",
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: "Avg Wait Time",
      value: "0:42",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Quote-to-Bind Ratio",
      value: "51.1%",
      icon: <Target className="h-4 w-4" />,
    },
  ];

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white">
      <h3 className="font-semibold mb-4">Quick Stats</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="text-center">
            <div className="flex items-center justify-center mb-2 text-white/70">
              {stat.icon}
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-white/70 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentActivity() {
  const activities = [
    {
      type: "success",
      message: "Sarah M. closed $12,500 commercial auto policy",
      time: "5 min ago",
    },
    {
      type: "info",
      message: "23 quotes generated in the last hour",
      time: "1 hour ago",
    },
    {
      type: "warning",
      message: "Call wait times above target (avg 1:45)",
      time: "2 hours ago",
    },
    {
      type: "success",
      message: "Monthly retention goal achieved: 92.4%",
      time: "3 hours ago",
    },
    {
      type: "info",
      message: "New agent John D. completed onboarding training",
      time: "4 hours ago",
    },
  ];

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-500" />,
    info: <ThumbsUp className="h-4 w-4 text-blue-500" />,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="mt-0.5">
              {icons[activity.type as keyof typeof icons]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{activity.message}</p>
              <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

interface ReportStats {
  metrics: {
    totalCalls: number;
    callsChange: number;
    totalQuotes: number;
    boundQuotes: number;
    conversionRate: number;
    avgHandleTime: string;
    totalCustomers: number;
    totalLeads: number;
  };
  agentPerformance: Array<{
    id: string;
    name: string;
    calls: number;
    avgCallTime: string;
  }>;
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch real data from API
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/stats?period=${dateRange}`);
        const data = await res.json();
        if (data.success) {
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch report stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [dateRange]);

  // Generate dynamic metrics from real data
  const dynamicMetrics: MetricCard[] = stats ? [
    {
      title: "Total Calls",
      value: stats.metrics.totalCalls.toLocaleString(),
      change: stats.metrics.callsChange,
      changeLabel: "vs last period",
      icon: <Phone className="h-5 w-5" />,
      color: "bg-blue-500",
    },
    {
      title: "Quotes Created",
      value: stats.metrics.totalQuotes,
      change: 0,
      changeLabel: "this period",
      icon: <FileText className="h-5 w-5" />,
      color: "bg-green-500",
    },
    {
      title: "Policies Bound",
      value: stats.metrics.boundQuotes,
      change: stats.metrics.conversionRate,
      changeLabel: "conversion rate",
      icon: <DollarSign className="h-5 w-5" />,
      color: "bg-emerald-500",
    },
    {
      title: "Conversion Rate",
      value: `${stats.metrics.conversionRate}%`,
      change: 0,
      changeLabel: "quote to bind",
      icon: <Target className="h-5 w-5" />,
      color: "bg-purple-500",
    },
    {
      title: "Total Customers",
      value: stats.metrics.totalCustomers.toLocaleString(),
      change: 0,
      changeLabel: "in database",
      icon: <Users className="h-5 w-5" />,
      color: "bg-orange-500",
    },
    {
      title: "Avg Handle Time",
      value: stats.metrics.avgHandleTime || "0:00",
      change: 0,
      changeLabel: "per call",
      icon: <Clock className="h-5 w-5" />,
      color: "bg-cyan-500",
    },
  ] : METRICS;

  const tabs: { value: ReportTab; label: string; icon: React.ReactNode }[] = [
    { value: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { value: "agents", label: "Agents", icon: <Users className="h-4 w-4" /> },
    { value: "carriers", label: "Carriers", icon: <FileText className="h-4 w-4" /> },
    { value: "calls", label: "Calls", icon: <Phone className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">
            Track performance metrics and identify trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                  <div className="h-10 w-10 bg-gray-200 rounded-xl mb-3" />
                  <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
                  <div className="h-6 w-16 bg-gray-200 rounded" />
                </div>
              ))
            ) : (
              dynamicMetrics.map((metric, idx) => (
                <MetricCardComponent key={idx} metric={metric} />
              ))
            )}
          </div>

          {/* Quick Stats */}
          <QuickStats />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart />
            <DispositionChart />
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AgentLeaderboard />
            </div>
            <RecentActivity />
          </div>
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === "agents" && (
        <div className="space-y-6">
          <AgentLeaderboard />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart />
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Agent Comparison
              </h3>
              <div className="space-y-4">
                {AGENT_PERFORMANCE.slice(0, 5).map((agent) => (
                  <div key={agent.id} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium text-gray-700 truncate">
                      {agent.name.split(" ")[0]}
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{
                          width: `${(agent.revenue / 55000) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="w-20 text-sm font-medium text-gray-900 text-right">
                      ${(agent.revenue / 1000).toFixed(1)}K
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carriers Tab */}
      {activeTab === "carriers" && (
        <div className="space-y-6">
          <CarrierBreakdown />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Premium Distribution
              </h3>
              <div className="space-y-3">
                {CARRIER_STATS.map((carrier) => {
                  const totalPremium = CARRIER_STATS.reduce(
                    (sum, c) => sum + c.premium,
                    0
                  );
                  const percentage = (carrier.premium / totalPremium) * 100;
                  return (
                    <div key={carrier.carrier}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{carrier.carrier}</span>
                        <span className="font-medium text-gray-900">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Retention by Carrier
              </h3>
              <div className="space-y-3">
                {CARRIER_STATS.sort((a, b) => b.retention - a.retention).map(
                  (carrier) => (
                    <div
                      key={carrier.carrier}
                      className="flex items-center gap-3"
                    >
                      <div className="w-24 text-sm text-gray-700">
                        {carrier.carrier}
                      </div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            carrier.retention >= 93
                              ? "bg-green-500"
                              : carrier.retention >= 90
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${carrier.retention}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-medium text-gray-900 text-right">
                        {carrier.retention}%
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calls Tab */}
      {activeTab === "calls" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart />
            <DispositionChart />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Call Quality Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">4.6</p>
                <p className="text-sm text-gray-600 mt-1">Avg CSAT Score</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">78.3%</p>
                <p className="text-sm text-gray-600 mt-1">First Call Resolution</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">4:32</p>
                <p className="text-sm text-gray-600 mt-1">Avg Handle Time</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-amber-600">2.3%</p>
                <p className="text-sm text-gray-600 mt-1">Escalation Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
