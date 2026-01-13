"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  Home,
  Package,
  Ship,
  Briefcase,
  Search,
  Users,
  UserPlus,
  Loader2,
  ChevronRight,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Mail,
  MessageSquare,
  DollarSign,
  Shield,
  Plus,
  RefreshCw,
  ArrowRight,
  Sparkles,
  AlertCircle,
  TrendingUp,
  FileText,
  Umbrella,
  Heart,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import AgentDashboard from "@/components/dashboards/AgentDashboard";

// =============================================================================
// TYPES
// =============================================================================

interface CustomerPolicy {
  type: string;
  carrier: string;
  premium: number;
  status: string;
  expirationDate?: string;
}

interface CustomerResult {
  id: string;
  agencyzoomId?: string;
  type: "customer" | "lead";
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  totalPremium?: number;
  policies?: CustomerPolicy[];
  policyTypes?: string[];
}

interface SmartAction {
  id: string;
  label: string;
  description: string;
  reason: string;
  icon: any;
  color: string;
  priority: 'high' | 'medium' | 'low';
  href: string;
}

interface DashboardStats {
  calls: { total: number; inbound: number; outbound: number };
  messages: { total: number; inbound: number; outbound: number };
  pendingReview: number;
}

// =============================================================================
// QUOTE TYPE CONFIG
// =============================================================================

const QUOTE_TYPES = [
  {
    id: 'personal_auto',
    label: 'Auto',
    icon: Car,
    color: 'from-blue-500 to-blue-600',
    hoverColor: 'group-hover:from-blue-600 group-hover:to-blue-700',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'homeowners',
    label: 'Home',
    icon: Home,
    color: 'from-green-500 to-green-600',
    hoverColor: 'group-hover:from-green-600 group-hover:to-green-700',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    id: 'bundle', // Goes to quote selector page
    href: '/quote/new',
    label: 'Bundle',
    icon: Package,
    color: 'from-amber-500 to-orange-500',
    hoverColor: 'group-hover:from-amber-600 group-hover:to-orange-600',
    bgLight: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-600 dark:text-amber-400',
    badge: 'SAVE 25%',
  },
  {
    id: 'recreational', // Boat/RV/ATV
    label: 'Boat/RV',
    icon: Ship,
    color: 'from-cyan-500 to-cyan-600',
    hoverColor: 'group-hover:from-cyan-600 group-hover:to-cyan-700',
    bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
    textColor: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'bop', // Business Owner's Policy
    label: 'Business',
    icon: Briefcase,
    color: 'from-purple-500 to-purple-600',
    hoverColor: 'group-hover:from-purple-600 group-hover:to-purple-700',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
];

// =============================================================================
// SMART ACTION ENGINE
// =============================================================================

function generateSmartActions(customer: CustomerResult): SmartAction[] {
  const actions: SmartAction[] = [];
  const policies = customer.policies || [];
  const policyTypes = customer.policyTypes || policies.map(p => p.type?.toLowerCase());

  const hasAuto = policyTypes.some(t => t?.includes('auto') || t?.includes('car') || t?.includes('vehicle'));
  const hasHome = policyTypes.some(t => t?.includes('home') || t?.includes('dwelling') || t?.includes('house'));
  const hasUmbrella = policyTypes.some(t => t?.includes('umbrella') || t?.includes('liability'));
  const hasBoat = policyTypes.some(t => t?.includes('boat') || t?.includes('rv') || t?.includes('watercraft'));
  const hasBusiness = policyTypes.some(t => t?.includes('business') || t?.includes('commercial') || t?.includes('bop'));

  const customerId = customer.agencyzoomId || customer.id;
  const isLead = customer.type === 'lead';

  // Auto only - suggest Home
  if (hasAuto && !hasHome) {
    actions.push({
      id: 'quote-home',
      label: 'Quote Home Insurance',
      description: '15-25% bundle discount available',
      reason: 'Customer likely owns home, huge savings opportunity',
      icon: Home,
      color: 'bg-amber-500',
      priority: 'high',
      href: `/quote/new/homeowners?customer=${customerId}`,
    });
  }

  // Home only - suggest Auto
  if (hasHome && !hasAuto) {
    actions.push({
      id: 'quote-auto',
      label: 'Quote Auto Insurance',
      description: '15-25% bundle discount available',
      reason: 'Customer likely has vehicle, huge savings opportunity',
      icon: Car,
      color: 'bg-amber-500',
      priority: 'high',
      href: `/quote/new/personal_auto?customer=${customerId}`,
    });
  }

  // Has auto - common add vehicle request
  if (hasAuto) {
    actions.push({
      id: 'add-vehicle',
      label: 'Add Vehicle',
      description: 'New car or teen driver',
      reason: 'Common life event for auto customers',
      icon: Plus,
      color: 'bg-blue-500',
      priority: 'high',
      href: `/policy-change?customer=${customerId}&type=add_vehicle`,
    });

    actions.push({
      id: 'replace-vehicle',
      label: 'Replace Vehicle',
      description: 'Sold or traded vehicle',
      reason: 'Frequent request for existing policies',
      icon: RefreshCw,
      color: 'bg-blue-500',
      priority: 'medium',
      href: `/policy-change?customer=${customerId}&type=replace_vehicle`,
    });
  }

  // Has home - mortgagee change
  if (hasHome) {
    actions.push({
      id: 'change-mortgagee',
      label: 'Change Mortgagee',
      description: 'Refinanced or paid off mortgage',
      reason: 'Common after refinancing',
      icon: FileText,
      color: 'bg-green-500',
      priority: 'high',
      href: `/policy-change?customer=${customerId}&type=mortgagee_change`,
    });
  }

  // Has both auto + home - suggest umbrella
  if (hasAuto && hasHome && !hasUmbrella) {
    actions.push({
      id: 'quote-umbrella',
      label: 'Quote Umbrella Policy',
      description: 'Extra liability protection',
      reason: 'Customer has assets to protect',
      icon: Umbrella,
      color: 'bg-purple-500',
      priority: 'medium',
      href: `/quote/new/umbrella?customer=${customerId}`,
    });
  }

  // Cross-sell boat/RV for homeowners
  if (hasHome && !hasBoat) {
    actions.push({
      id: 'quote-boat',
      label: 'Quote Boat/RV',
      description: 'Seasonal coverage',
      reason: 'Many homeowners have recreational vehicles',
      icon: Ship,
      color: 'bg-cyan-500',
      priority: 'low',
      href: `/quote/new/boat?customer=${customerId}`,
    });
  }

  // Policy review for any customer
  if (policies.length > 0) {
    actions.push({
      id: 'policy-review',
      label: 'Policy Review',
      description: 'Annual coverage check',
      reason: 'Proactive retention strategy',
      icon: Shield,
      color: 'bg-indigo-500',
      priority: 'medium',
      href: `/customers/${customerId}?tab=policies`,
    });
  }

  // Lead conversion
  if (isLead) {
    actions.push({
      id: 'convert-lead',
      label: 'Convert to Customer',
      description: 'Ready to bind policy',
      reason: 'Lead is engaged and ready',
      icon: UserPlus,
      color: 'bg-emerald-500',
      priority: 'high',
      href: `/leads/${customerId}?action=convert`,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch current user role
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUserRole(data.user.role);
            setUserName(data.user.firstName || data.user.name?.split(' ')[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setUserLoading(false);
      }
    }
    fetchUser();
  }, []);

  // Fetch dashboard stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/stats?period=today");
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            setStats(data.stats);
          }
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
    // Refresh stats every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Show agent dashboard for agents
  if (!userLoading && userRole === 'agent') {
    return <AgentDashboard userName={userName || undefined} />;
  }

  // Show loading while fetching user
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Perform customer search
  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const [customersRes, leadsRes] = await Promise.all([
        fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}&limit=8`),
        fetch(`/api/leads?search=${encodeURIComponent(searchQuery)}&limit=5`),
      ]);

      const results: CustomerResult[] = [];

      if (customersRes.ok) {
        const data = await customersRes.json();
        if (data.results) {
          data.results.forEach((c: any) => {
            results.push({
              id: c.id,
              agencyzoomId: c.azCustomerId || c.agencyzoomId,
              type: "customer",
              name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
              firstName: c.firstName,
              lastName: c.lastName,
              phone: c.phone || c.mobilePhone,
              email: c.email,
              totalPremium: c.totalPremium || c.annualPremium,
              policies: c.policies || [],
              policyTypes: c.policyTypes || [],
            });
          });
        }
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        if (data.leads) {
          data.leads.forEach((l: any) => {
            results.push({
              id: l.id,
              agencyzoomId: l.azLeadId || l.agencyzoomId,
              type: "lead",
              name: l.name || `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Unknown',
              firstName: l.firstName,
              lastName: l.lastName,
              phone: l.phone || l.mobilePhone,
              email: l.email,
              totalPremium: 0,
              policies: [],
              policyTypes: [],
            });
          });
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowResults(true);
    setSelectedCustomer(null);
    setSmartActions([]);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle customer selection
  const handleSelectCustomer = async (customer: CustomerResult) => {
    setSelectedCustomer(customer);
    setShowResults(false);
    setQuery(customer.name);

    // Fetch full customer details if we don't have policies
    if (customer.type === 'customer' && (!customer.policies || customer.policies.length === 0)) {
      try {
        const res = await fetch(`/api/customers/${customer.agencyzoomId || customer.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.customer) {
            const fullCustomer = {
              ...customer,
              policies: data.customer.policies || [],
              policyTypes: data.customer.policyTypes || data.customer.policies?.map((p: any) => p.type) || [],
              totalPremium: data.customer.totalPremium || data.customer.annualPremium,
            };
            setSelectedCustomer(fullCustomer);
            setSmartActions(generateSmartActions(fullCustomer));
            return;
          }
        }
      } catch (e) {
        console.error("Failed to fetch customer details:", e);
      }
    }

    // Generate actions with what we have
    setSmartActions(generateSmartActions(customer));
  };

  // Clear selection
  const handleClearSelection = () => {
    setQuery("");
    setSelectedCustomer(null);
    setSmartActions([]);
    setSearchResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Simple. Fast. Smart.
          </p>
        </div>

        {/* ================================================================= */}
        {/* TODAY'S STATS */}
        {/* ================================================================= */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Calls Inbound */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <PhoneIncoming className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Calls In</p>
                {statsLoading ? (
                  <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.calls.inbound || 0}</p>
                )}
              </div>
            </div>
          </div>

          {/* Calls Outbound */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <PhoneOutgoing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Calls Out</p>
                {statsLoading ? (
                  <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.calls.outbound || 0}</p>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Texts</p>
                {statsLoading ? (
                  <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.messages.total || 0}</p>
                    <span className="text-xs text-gray-500">
                      <ArrowDownLeft className="w-3 h-3 inline text-green-500" />{stats?.messages.inbound || 0}
                      {" / "}
                      <ArrowUpRight className="w-3 h-3 inline text-blue-500" />{stats?.messages.outbound || 0}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pending Review */}
          <Link href="/pending-review">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  (stats?.pendingReview || 0) > 0
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-gray-100 dark:bg-gray-700"
                )}>
                  <ClipboardList className={cn(
                    "w-5 h-5",
                    (stats?.pendingReview || 0) > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-gray-500"
                  )} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending</p>
                  {statsLoading ? (
                    <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ) : (
                    <p className={cn(
                      "text-2xl font-bold",
                      (stats?.pendingReview || 0) > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-900 dark:text-white"
                    )}>
                      {stats?.pendingReview || 0}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* ================================================================= */}
        {/* NEW QUOTE SECTION */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            New Quote
          </h2>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
            {QUOTE_TYPES.map((type) => {
              const Icon = type.icon;
              const href = (type as any).href || `/quote/new/${type.id}`;
              return (
                <Link
                  key={type.id}
                  href={href}
                  className="group relative"
                >
                  <div className="flex flex-col items-center p-4 rounded-xl transition-all duration-200 hover:scale-105">
                    {/* Icon Circle */}
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
                      type.bgLight,
                      "group-hover:bg-gradient-to-br",
                      type.color,
                      type.hoverColor,
                      "group-hover:shadow-lg group-hover:shadow-current/20"
                    )}>
                      <Icon className={cn(
                        "w-8 h-8 transition-colors",
                        type.textColor,
                        "group-hover:text-white"
                      )} />
                    </div>

                    {/* Label */}
                    <span className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {type.label}
                    </span>

                    {/* Badge (e.g., SAVE 25%) */}
                    {type.badge && (
                      <span className="absolute -top-1 -right-1 px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse">
                        {type.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* EXISTING CUSTOMER SECTION */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Existing Customer
          </h2>

          {/* Search Box */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleSearchChange}
                onFocus={() => setShowResults(true)}
                placeholder="Search by name, phone, or email..."
                className={cn(
                  "w-full pl-12 pr-12 py-4 text-lg border-2 rounded-xl transition-all",
                  "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700",
                  "focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
                  "placeholder-gray-400"
                )}
              />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
              )}
              {selectedCustomer && !isSearching && (
                <button
                  onClick={handleClearSelection}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && !selectedCustomer && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-auto">
                {searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectCustomer(result)}
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                      result.type === "customer" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                    )}>
                      {result.type === "customer" ? (
                        <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{result.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {result.phone || result.email || "No contact info"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className={cn(
                        "text-xs mb-1",
                        result.type === "customer" ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-blue-300 text-blue-700 dark:text-blue-400"
                      )}>
                        {result.type}
                      </Badge>
                      {result.totalPremium ? (
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          ${result.totalPremium.toLocaleString()}/yr
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {showResults && query.length >= 2 && searchResults.length === 0 && !isSearching && !selectedCustomer && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 p-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-600 dark:text-gray-400 mb-3">No results for "{query}"</p>
                <Link href={`/leads/new?search=${encodeURIComponent(query)}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create New Lead
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Selected Customer Card */}
          {selectedCustomer && (
            <div className="mt-6 space-y-6">
              {/* Customer Info */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shrink-0",
                  selectedCustomer.type === "customer" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                )}>
                  {selectedCustomer.type === "customer" ? (
                    <Users className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <UserPlus className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedCustomer.name}
                    </h3>
                    <Badge variant="outline" className={cn(
                      selectedCustomer.type === "customer" ? "border-emerald-300 text-emerald-700" : "border-blue-300 text-blue-700"
                    )}>
                      {selectedCustomer.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                    {selectedCustomer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {selectedCustomer.phone}
                      </span>
                    )}
                    {selectedCustomer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {selectedCustomer.email}
                      </span>
                    )}
                    {selectedCustomer.totalPremium ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <DollarSign className="w-4 h-4" />
                        ${selectedCustomer.totalPremium.toLocaleString()}/yr
                      </span>
                    ) : null}
                  </div>
                  {/* Policy Types */}
                  {(selectedCustomer.policyTypes?.length || 0) > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Has:</span>
                      {selectedCustomer.policyTypes?.map((type, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {type.includes('auto') ? '🚗' : type.includes('home') ? '🏠' : '📋'} {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Link href={`/customers/${selectedCustomer.agencyzoomId || selectedCustomer.id}`}>
                  <Button variant="outline" size="sm">
                    View Profile <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>

              {/* Smart Actions */}
              {smartActions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    What would you like to do?
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {smartActions.slice(0, 4).map((action) => {
                      const Icon = action.icon;
                      return (
                        <Link key={action.id} href={action.href}>
                          <div className={cn(
                            "relative p-4 rounded-xl border-2 transition-all cursor-pointer group",
                            "hover:shadow-lg hover:scale-[1.02]",
                            action.priority === 'high' && "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10",
                            action.priority === 'medium' && "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10",
                            action.priority === 'low' && "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800",
                          )}>
                            {/* Priority Badge */}
                            {action.priority === 'high' && (
                              <span className="absolute -top-2 right-3 px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                                HOT
                              </span>
                            )}

                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                action.color
                              )}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-900 dark:text-white">
                                    {action.label}
                                  </h4>
                                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {action.description}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                  {action.reason}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generic actions for customers without policy data */}
              {smartActions.length === 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Link href={`/quote/new/personal_auto?customer=${selectedCustomer.agencyzoomId || selectedCustomer.id}`}>
                      <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2">
                        <Car className="w-5 h-5 text-blue-600" />
                        <span className="text-xs">Quote Auto</span>
                      </Button>
                    </Link>
                    <Link href={`/quote/new/homeowners?customer=${selectedCustomer.agencyzoomId || selectedCustomer.id}`}>
                      <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2">
                        <Home className="w-5 h-5 text-green-600" />
                        <span className="text-xs">Quote Home</span>
                      </Button>
                    </Link>
                    <Link href={`/policy-change?customer=${selectedCustomer.agencyzoomId || selectedCustomer.id}`}>
                      <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <span className="text-xs">Service Request</span>
                      </Button>
                    </Link>
                    <Link href={`/customers/${selectedCustomer.agencyzoomId || selectedCustomer.id}`}>
                      <Button variant="outline" className="w-full h-auto py-3 flex flex-col items-center gap-2">
                        <Users className="w-5 h-5 text-gray-600" />
                        <span className="text-xs">View Profile</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ================================================================= */}
        {/* QUICK LINKS */}
        {/* ================================================================= */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/pending-review">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:scale-[1.02] transition-all">
              <AlertCircle className="w-6 h-6 text-amber-500 mb-2" />
              <p className="font-semibold text-gray-900 dark:text-white">Pending Review</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Triage queue</p>
            </div>
          </Link>
          <Link href="/leads">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:scale-[1.02] transition-all">
              <TrendingUp className="w-6 h-6 text-blue-500 mb-2" />
              <p className="font-semibold text-gray-900 dark:text-white">Leads</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sales pipeline</p>
            </div>
          </Link>
          <Link href="/calls">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:scale-[1.02] transition-all">
              <Phone className="w-6 h-6 text-emerald-500 mb-2" />
              <p className="font-semibold text-gray-900 dark:text-white">Call History</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Recent calls</p>
            </div>
          </Link>
          <Link href="/customers">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md hover:scale-[1.02] transition-all">
              <Users className="w-6 h-6 text-purple-500 mb-2" />
              <p className="font-semibold text-gray-900 dark:text-white">Customers</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">All customers</p>
            </div>
          </Link>
        </section>

      </div>
    </div>
  );
}
