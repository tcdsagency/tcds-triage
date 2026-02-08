"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  Upload,
  FileText,
  CheckSquare,
  BarChart3,
  UserCog,
  Building2,
  Wallet,
  Lock,
  Loader2,
  ChevronRight,
  Clock,
} from "lucide-react";
import { AnomalyBanner } from "@/components/commissions/AnomalyBanner";
import { MonthSelector } from "@/components/commissions/MonthSelector";
import { StatsCard } from "@/components/commissions/StatsCard";
import { formatCurrency } from "@/lib/commissions/formatters";

// =============================================================================
// TYPES
// =============================================================================

interface RecentImport {
  id: string;
  fileName: string;
  carrier: string;
  recordCount: number;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface DashboardData {
  totalCommissionsThisMonth: number;
  totalCommissionsLastMonth: number;
  monthOverMonthChange: number;
  pendingReconciliations: number;
  unresolvedAnomalies: number;
  activeAgents: number;
  recentImports: RecentImport[];
}

// =============================================================================
// QUICK LINKS CONFIG
// =============================================================================

const QUICK_LINKS = [
  {
    label: "Import",
    description: "Upload commission statements",
    href: "/commissions/import",
    icon: Upload,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    label: "Transactions",
    description: "View all transactions",
    href: "/commissions/transactions",
    icon: FileText,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    label: "Reconciliation",
    description: "Match and verify payments",
    href: "/commissions/reconciliation",
    icon: CheckSquare,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    label: "Reports",
    description: "Analytics and exports",
    href: "/commissions/reports",
    icon: BarChart3,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    label: "Agents",
    description: "Agent splits and overrides",
    href: "/commissions/agents",
    icon: UserCog,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  {
    label: "Carriers",
    description: "Carrier rate schedules",
    href: "/commissions/carriers",
    icon: Building2,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
  {
    label: "Draw Accounts",
    description: "Draw balances and repayments",
    href: "/commissions/draws",
    icon: Wallet,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
  {
    label: "Month Close",
    description: "Finalize monthly commissions",
    href: "/commissions/month-close",
    icon: Lock,
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800",
  },
];

// =============================================================================
// HELPERS
// =============================================================================

function getImportStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "processing":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CommissionsPage() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/commissions/dashboard?month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Unexpected response");
      }
    } catch (err: any) {
      console.error("Commission dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(selectedMonth);
  }, [selectedMonth, fetchDashboard]);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ================================================================= */}
        {/* PAGE HEADER                                                        */}
        {/* ================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Commission Tracker
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Track, reconcile, and report on agency commissions
            </p>
          </div>
          <MonthSelector value={selectedMonth} onChange={handleMonthChange} />
        </div>

        {/* ================================================================= */}
        {/* ANOMALY BANNER                                                     */}
        {/* ================================================================= */}
        <AnomalyBanner />

        {/* ================================================================= */}
        {/* STATS CARDS                                                        */}
        {/* ================================================================= */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
              >
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Commissions This Month"
              value={formatCurrency(data.totalCommissionsThisMonth)}
              icon={DollarSign}
              trend={
                data.monthOverMonthChange !== 0
                  ? {
                      value: data.monthOverMonthChange,
                      label: "vs last month",
                    }
                  : undefined
              }
            />
            <StatsCard
              title="Last Month"
              value={formatCurrency(data.totalCommissionsLastMonth)}
              icon={TrendingUp}
              subtitle="Previous period total"
            />
            <StatsCard
              title="Month-over-Month"
              value={`${data.monthOverMonthChange > 0 ? "+" : ""}${data.monthOverMonthChange.toFixed(1)}%`}
              icon={AlertTriangle}
              subtitle={
                data.pendingReconciliations > 0
                  ? `${data.pendingReconciliations} pending reconciliation${data.pendingReconciliations !== 1 ? "s" : ""}`
                  : "All reconciled"
              }
            />
            <StatsCard
              title="Active Agents"
              value={data.activeAgents}
              icon={Users}
              subtitle={
                data.unresolvedAnomalies > 0
                  ? `${data.unresolvedAnomalies} unresolved anomal${data.unresolvedAnomalies !== 1 ? "ies" : "y"}`
                  : "No anomalies"
              }
            />
          </div>
        ) : null}

        {/* ================================================================= */}
        {/* QUICK LINKS                                                        */}
        {/* ================================================================= */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Quick Links
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer group">
                    <div className={`w-10 h-10 rounded-lg ${link.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`h-5 w-5 ${link.color}`} />
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {link.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {link.description}
                    </p>
                    <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 mt-2 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* RECENT IMPORTS TABLE                                               */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Recent Imports
            </h2>
            <Link
              href="/commissions/import"
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Unable to load recent imports.
            </div>
          ) : data && data.recentImports && data.recentImports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      File
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Carrier
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Records
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Imported
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.recentImports.slice(0, 5).map((imp) => (
                    <tr
                      key={imp.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                            {imp.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-300">
                        {imp.carrier}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
                        {imp.recordCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(imp.totalAmount)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getImportStatusBadge(imp.status)}`}
                        >
                          {imp.status.charAt(0).toUpperCase() +
                            imp.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 text-gray-500 dark:text-gray-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs">
                            {formatTimeAgo(imp.createdAt)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Upload className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No imports yet for this period.
              </p>
              <Link
                href="/commissions/import"
                className="inline-block mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Upload a commission statement
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
