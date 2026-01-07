"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneMissed,
  FileText,
  Users,
  TrendingUp,
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
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
}

interface TeamMember {
  id: string;
  name: string;
  extension: string;
  status: "available" | "away" | "dnd" | "on_call" | "offline";
  statusText?: string;
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
  });
  const [aiInsight, setAiInsight] = useState<string>("");
  const [teamPresence, setTeamPresence] = useState<TeamMember[]>([]);
  const [presenceConnected, setPresenceConnected] = useState(false);

  const fetchDashboardData = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

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
          setStats(prev => ({ ...prev, activeLeads: leadsData.total || leadsData.leads?.length || 0 }));
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

      // Generate AI insight based on data
      generateAiInsight();

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateAiInsight = () => {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    const insights = [
      "Focus on following up with pending quotes today - conversion rates are highest within 48 hours of initial contact.",
      "Consider reaching out to customers with renewals coming up in the next 30 days. Early contact improves retention.",
      "Review any high-priority triage items first. Quick response times lead to better customer satisfaction.",
      "Check for any missed calls from yesterday - returning calls promptly shows customers you value their business.",
      "Today is a great day to cross-sell umbrella policies to customers with both auto and home coverage.",
    ];

    // Pick insight based on day
    setAiInsight(insights[dayOfWeek % insights.length]);
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getGreeting()}! 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Here's what's happening with your agency today.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Leads"
          value={stats.activeLeads}
          icon={Users}
          color="bg-blue-500"
          href="/leads"
        />
        <StatCard
          title="Triage Queue"
          value={stats.triageCount}
          icon={AlertCircle}
          color="bg-amber-500"
          href="/triage"
        />
        <StatCard
          title="Pending Quotes"
          value={stats.pendingQuotes}
          icon={FileText}
          color="bg-purple-500"
          href="/quotes"
        />
        <StatCard
          title="Today's Calls"
          value={0}
          subtitle="Feature coming soon"
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
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">All caught up! No pending triage items.</p>
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

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <Link href="/quote/new">
              <Button className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                <Sparkles className="w-6 h-6" />
                <span>New Quote</span>
              </Button>
            </Link>
            <Link href="/customers">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                <Users className="w-6 h-6" />
                <span>Find Customer</span>
              </Button>
            </Link>
            <Link href="/leads">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                <span>View Leads</span>
              </Button>
            </Link>
            <Link href="/triage">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                <AlertCircle className="w-6 h-6" />
                <span>Triage Queue</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Team Presence */}
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
        </div>
        <div className="p-4">
          {teamPresence.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {teamPresence.map((member) => (
                <TeamPresenceCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Morning Briefing */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-sm p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              AI Daily Insight
              <Badge className="bg-white/20 text-white text-xs">Beta</Badge>
            </h3>
            <p className="mt-2 text-emerald-50 text-sm leading-relaxed">
              {aiInsight}
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                View Full Briefing
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                Customize Insights
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Coming Soon</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeaturePreview
            title="Call Analytics"
            description="Real-time call tracking, transcription, and AI summaries"
            icon={Phone}
          />
          <FeaturePreview
            title="Renewal Dashboard"
            description="Track upcoming renewals and retention metrics"
            icon={Calendar}
          />
          <FeaturePreview
            title="Revenue Tracking"
            description="Monitor premiums, commissions, and growth"
            icon={DollarSign}
          />
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center gap-4">
          <div className={cn(color, "rounded-lg p-3")}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
              {change && (
                <span className={cn(
                  "text-xs font-medium flex items-center",
                  change.positive ? "text-emerald-600" : "text-red-600"
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

function FeaturePreview({ title, description, icon: Icon }: { title: string; description: string; icon: any }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50">
      <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </div>
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </div>
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

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
      <div className="relative">
        <div className={cn(
          "w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-2",
          getStatusRing(member.status)
        )}>
          <span className="text-white text-sm font-medium">{initials}</span>
        </div>
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800",
          getStatusColor(member.status)
        )} />
      </div>
      <p className="mt-2 text-xs font-medium text-gray-900 dark:text-white text-center truncate w-full">
        {member.name.split(" ")[0]}
      </p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
        {member.statusText || member.status}
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
