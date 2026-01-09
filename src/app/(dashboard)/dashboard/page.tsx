"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneMissed,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  PhoneCall,
  UserPlus,
  Search,
  Target,
  Award,
  Zap,
  Heart,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonStatCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TriageItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  customer_name?: string;
  created_at: string;
}

interface DashboardStats {
  totalCustomers: number;
  activeLeads: number;
  pendingQuotes: number;
  triageCount: number;
  // Yesterday's values for trend indicators
  yesterdayLeads?: number;
  yesterdayTriage?: number;
  yesterdayQuotes?: number;
  todaysCalls?: number;
}

interface TeamMember {
  id: string;
  name: string;
  extension: string;
  status: "available" | "away" | "dnd" | "on_call" | "offline";
  statusText?: string;
  avatarUrl?: string;
}

interface DonnaAlert {
  customerId: string;
  customerName: string;
  alertType: 'churn_risk' | 'low_sentiment' | 'cross_sell';
  value: number;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triageItems, setTriageItems] = useState<TriageItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    activeLeads: 0,
    pendingQuotes: 0,
    triageCount: 0,
    yesterdayLeads: 2,
    yesterdayTriage: 3,
    yesterdayQuotes: 1,
    todaysCalls: 0,
  });
  const [userName, setUserName] = useState<string>("Agent");
  const [teamPresence, setTeamPresence] = useState<TeamMember[]>([]);
  const [presenceConnected, setPresenceConnected] = useState(false);
  const [donnaAlerts, setDonnaAlerts] = useState<DonnaAlert[]>([]);

  const fetchDashboardData = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      // Fetch current user's name
      try {
        const userRes = await fetch("/api/auth/me");
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user?.firstName) {
            setUserName(userData.user.firstName);
          } else if (userData.user?.email) {
            // Use email prefix if no first name
            setUserName(userData.user.email.split("@")[0]);
          }
        }
      } catch (userErr) {
        console.error("User fetch error:", userErr);
      }

      // Fetch triage items
      const triageRes = await fetch("/api/triage?status=pending&limit=5");
      if (triageRes.ok) {
        const triageData = await triageRes.json();
        if (triageData.success) {
          setTriageItems(triageData.items || []);
          setStats(prev => ({ ...prev, triageCount: triageData.total || 0 }));
        }
      }

      // Fetch leads count
      const leadsRes = await fetch("/api/leads?limit=1");
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        if (leadsData.success) {
          setStats(prev => ({ ...prev, activeLeads: leadsData.counts?.total || leadsData.leads?.length || 0 }));
        }
      }

      // Fetch team presence from 3CX
      try {
        const presenceRes = await fetch("/api/3cx/presence");
        if (presenceRes.ok) {
          const presenceData = await presenceRes.json();
          if (presenceData.success) {
            setTeamPresence(presenceData.team || []);
            setPresenceConnected(presenceData.connected || false);
          }
        }
      } catch (presenceErr) {
        console.error("Presence fetch error:", presenceErr);
      }

      // Fetch Donna AI alerts
      try {
        const donnaRes = await fetch("/api/donna/alerts?limit=10");
        if (donnaRes.ok) {
          const donnaData = await donnaRes.json();
          if (donnaData.success) {
            setDonnaAlerts(donnaData.alerts || []);
          }
        }
      } catch (donnaErr) {
        console.error("Donna alerts fetch error:", donnaErr);
      }

    } catch (err) {
      console.error("Dashboard fetch error:", err);
      toast.error("Failed to load dashboard data", {
        description: "Some metrics may be unavailable",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "normal": return "bg-yellow-500";
      case "low": return "bg-gray-400";
      default: return "bg-gray-400";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "call": return Phone;
      case "quote": return FileText;
      case "service": return Users;
      default: return AlertCircle;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-6">
          <Skeleton className="h-8 w-64 mb-2 bg-gray-600" />
          <Skeleton className="h-4 w-96 bg-gray-600" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-6 w-32 rounded-full bg-gray-600" />
            <Skeleton className="h-6 w-24 rounded-full bg-gray-600" />
          </div>
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <SkeletonStatCard key={i} />
          ))}
        </div>

        {/* Two Column Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-lg">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-3 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header - Personalized */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {getGreeting()}, {userName}! 👋
            </h1>
            <p className="text-gray-300 mt-1">
              Here's what's happening with your agency today.
            </p>
            {/* Quick Priority Summary */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {stats.triageCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {stats.triageCount} items need attention
                </Badge>
              )}
              {stats.activeLeads > 0 && (
                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30">
                  <Users className="w-3 h-3 mr-1" />
                  {stats.activeLeads} active leads
                </Badge>
              )}
              {stats.triageCount === 0 && stats.activeLeads === 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  All caught up!
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid - Enhanced with Trends */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Leads"
          value={stats.activeLeads}
          icon={Users}
          color="bg-blue-500"
          href="/leads"
          change={stats.yesterdayLeads !== undefined ? {
            value: `${Math.abs(stats.activeLeads - stats.yesterdayLeads)} from yesterday`,
            positive: stats.activeLeads >= stats.yesterdayLeads
          } : undefined}
        />
        <StatCard
          title="Triage Queue"
          value={stats.triageCount}
          icon={AlertCircle}
          color="bg-amber-500"
          href="/triage"
          subtitle={stats.triageCount === 0 ? "All clear!" : undefined}
          change={stats.yesterdayTriage !== undefined && stats.triageCount > 0 ? {
            value: `${Math.abs(stats.triageCount - stats.yesterdayTriage)} from yesterday`,
            positive: stats.triageCount <= stats.yesterdayTriage
          } : undefined}
        />
        <StatCard
          title="Pending Quotes"
          value={stats.pendingQuotes}
          icon={FileText}
          color="bg-purple-500"
          href="/quotes"
          change={stats.yesterdayQuotes !== undefined && stats.pendingQuotes > 0 ? {
            value: `${Math.abs(stats.pendingQuotes - stats.yesterdayQuotes)} from yesterday`,
            positive: stats.pendingQuotes >= stats.yesterdayQuotes
          } : undefined}
        />
        <StatCard
          title="Today's Calls"
          value={stats.todaysCalls || 0}
          subtitle={stats.todaysCalls === 0 ? "No calls yet" : undefined}
          icon={Phone}
          color="bg-emerald-500"
          href="/calls"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Triage Queue */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Triage Queue</h2>
              {stats.triageCount > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {stats.triageCount}
                </Badge>
              )}
            </div>
            <Link href="/triage" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {triageItems.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">All caught up!</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">No pending triage items.</p>
              </div>
            ) : (
              triageItems.map((item) => {
                const TypeIcon = getTypeIcon(item.type);
                return (
                  <Link
                    key={item.id}
                    href={`/triage?id=${item.id}`}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className={cn("h-2 w-2 rounded-full", getPriorityColor(item.priority))} />
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <TypeIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.customer_name || "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(item.created_at)}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions - Enhanced */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Quick Actions
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Customer/Lead Search Box */}
            <CustomerSearchBox />

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-3 gap-3">
              <Link href="/quote/new">
                <Button className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 transition-all hover:shadow-orange-500/40 hover:scale-[1.02]">
                  <Sparkles className="w-6 h-6" />
                  <span className="font-semibold text-sm">New Quote</span>
                </Button>
              </Link>
              <Link href="/service-request/new">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-500 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 transition-all hover:scale-[1.02]">
                  <FileText className="w-6 h-6 text-emerald-600" />
                  <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">Service Request</span>
                </Button>
              </Link>
              <Link href="/calls">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 border-2 border-blue-200 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-all hover:scale-[1.02]">
                  <Phone className="w-6 h-6 text-blue-600" />
                  <span className="font-semibold text-sm text-blue-700 dark:text-blue-300">Call History</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Donna AI Alerts */}
      {donnaAlerts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Donna AI Alerts
              </h2>
              <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 text-xs">
                {donnaAlerts.length}
              </Badge>
            </div>
            <Link href="/customers?filter=donna_alerts">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {donnaAlerts.slice(0, 5).map((alert) => (
              <Link
                key={`${alert.customerId}-${alert.alertType}`}
                href={`/customers/${alert.customerId}`}
                className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  alert.alertType === 'churn_risk' && "bg-red-100 dark:bg-red-900/30",
                  alert.alertType === 'low_sentiment' && "bg-yellow-100 dark:bg-yellow-900/30",
                  alert.alertType === 'cross_sell' && "bg-blue-100 dark:bg-blue-900/30",
                )}>
                  {alert.alertType === 'churn_risk' && (
                    <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                  {alert.alertType === 'low_sentiment' && (
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  )}
                  {alert.alertType === 'cross_sell' && (
                    <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {alert.customerName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {alert.message}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    alert.severity === 'high' && "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
                    alert.severity === 'medium' && "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400",
                    alert.severity === 'low' && "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-400",
                  )}
                >
                  {alert.severity}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Team Presence - Enhanced */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Presence</h2>
            {presenceConnected ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                3CX Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Demo Mode</Badge>
            )}
          </div>
          {/* Status Summary */}
          {teamPresence.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-gray-600 dark:text-gray-400">{teamPresence.filter(m => m.status === 'available').length} Available</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-gray-600 dark:text-gray-400">{teamPresence.filter(m => m.status === 'on_call').length} On Call</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                <span className="text-gray-600 dark:text-gray-400">{teamPresence.filter(m => m.status === 'away' || m.status === 'dnd' || m.status === 'offline').length} Away</span>
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          {teamPresence.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members found</p>
              <p className="text-xs mt-1">Connect 3CX to see your team</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {teamPresence.map((member) => (
                <TeamPresenceCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
  change
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: any;
  color: string;
  href: string;
  change?: { value: string; positive: boolean };
}) {
  return (
    <Link href={href}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group">
        <div className="flex items-center gap-4">
          <div className={cn(color, "rounded-xl p-3 shadow-lg group-hover:scale-110 transition-transform")}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-4xl font-extrabold text-gray-900 dark:text-white leading-none">{value}</p>
              {change && (
                <span className={cn(
                  "text-xs font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
                  change.positive ? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
                )}>
                  {change.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {change.value}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function TeamPresenceCard({ member }: { member: TeamMember }) {
  const getStatusColor = (status: TeamMember["status"]) => {
    switch (status) {
      case "available": return "bg-emerald-500";
      case "on_call": return "bg-amber-500";
      case "dnd": return "bg-red-500";
      case "away": return "bg-yellow-500";
      case "offline": return "bg-gray-400";
      default: return "bg-gray-400";
    }
  };

  const getStatusRing = (status: TeamMember["status"]) => {
    switch (status) {
      case "available": return "ring-emerald-500/30";
      case "on_call": return "ring-amber-500/30";
      case "dnd": return "ring-red-500/30";
      case "away": return "ring-yellow-500/30";
      case "offline": return "ring-gray-400/30";
      default: return "ring-gray-400/30";
    }
  };

  const getStatusLabel = (status: TeamMember["status"]) => {
    switch (status) {
      case "available": return "Available";
      case "on_call": return "On a call";
      case "dnd": return "Do Not Disturb";
      case "away": return "Away";
      case "offline": return "Offline";
      default: return status;
    }
  };

  const getStatusBg = (status: TeamMember["status"]) => {
    switch (status) {
      case "available": return "bg-emerald-50 dark:bg-emerald-900/20";
      case "on_call": return "bg-amber-50 dark:bg-amber-900/20";
      case "dnd": return "bg-red-50 dark:bg-red-900/20";
      case "away": return "bg-yellow-50 dark:bg-yellow-900/20";
      case "offline": return "bg-gray-50 dark:bg-gray-900/20";
      default: return "bg-gray-50 dark:bg-gray-900/20";
    }
  };

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn(
      "flex flex-col items-center p-3 rounded-lg transition-all cursor-pointer hover:scale-[1.02]",
      getStatusBg(member.status)
    )} title={`${member.name} - ${getStatusLabel(member.status)}`}>
      <div className="relative">
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.name}
            className={cn(
              "w-12 h-12 rounded-full object-cover ring-3",
              getStatusRing(member.status)
            )}
          />
        ) : (
          <div className={cn(
            "w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-3",
            getStatusRing(member.status)
          )}>
            <span className="text-white text-sm font-semibold">{initials}</span>
          </div>
        )}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800",
          getStatusColor(member.status)
        )} />
      </div>
      <p className="mt-2 text-xs font-semibold text-gray-900 dark:text-white text-center truncate w-full">
        {member.name.split(" ")[0]}
      </p>
      <p className={cn(
        "text-[11px] font-medium truncate w-full text-center",
        member.status === 'available' && "text-emerald-600 dark:text-emerald-400",
        member.status === 'on_call' && "text-amber-600 dark:text-amber-400",
        member.status === 'dnd' && "text-red-600 dark:text-red-400",
        member.status === 'away' && "text-yellow-600 dark:text-yellow-400",
        member.status === 'offline' && "text-gray-500 dark:text-gray-400"
      )}>
        {member.statusText || getStatusLabel(member.status)}
      </p>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface SearchResult {
  id: string;
  type: "customer" | "lead";
  name: string;
  phone?: string;
  email?: string;
}

function CustomerSearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search both customers and leads in parallel
      const [customersRes, leadsRes] = await Promise.all([
        fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}&limit=5`),
        fetch(`/api/leads?search=${encodeURIComponent(searchQuery)}&limit=5`),
      ]);

      const searchResults: SearchResult[] = [];

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        if (customersData.customers) {
          customersData.customers.forEach((c: any) => {
            searchResults.push({
              id: c.id || c.azCustomerId,
              type: "customer",
              name: c.name || `${c.firstName} ${c.lastName}`.trim(),
              phone: c.phone || c.mobilePhone,
              email: c.email,
            });
          });
        }
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        if (leadsData.leads) {
          leadsData.leads.forEach((l: any) => {
            searchResults.push({
              id: l.id || l.azLeadId,
              type: "lead",
              name: l.name || `${l.firstName} ${l.lastName}`.trim(),
              phone: l.phone || l.mobilePhone,
              email: l.email,
            });
          });
        }
      }

      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowResults(true);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    // Navigate to customer or lead page
    if (result.type === "customer") {
      window.location.href = `/customers/${result.id}`;
    } else {
      window.location.href = `/leads/${result.id}`;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search customers & leads by name or phone..."
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white dark:focus:bg-gray-800 transition-all"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-auto">
          {results.length === 0 && !isSearching && query.length >= 2 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No results found for "{query}"</p>
              <Link href={`/leads/new?phone=${encodeURIComponent(query)}`} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium mt-2 inline-flex items-center gap-1">
                <UserPlus className="w-4 h-4" /> Create new lead
              </Link>
            </div>
          ) : (
            results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  result.type === "customer" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                )}>
                  {result.type === "customer" ? (
                    <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{result.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {result.phone || result.email || "No contact info"}
                  </p>
                </div>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  result.type === "customer" ? "border-emerald-300 text-emerald-700" : "border-blue-300 text-blue-700"
                )}>
                  {result.type}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
