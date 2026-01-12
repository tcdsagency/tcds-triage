"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, Plus, MoreVertical, Clock, CheckCircle2, XCircle,
  Car, Home, Ship, ChevronRight, Phone, Mail,
  DollarSign, FileText, Sparkles, Loader2, RefreshCw, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { QuoteComparisonModal } from "@/components/features/QuoteComparisonModal";

interface Quote {
  id: string;
  type: string;
  status: string;
  customer: {
    name: string;
    phone?: string;
    email?: string;
  } | null;
  createdBy: {
    name: string;
  } | null;
  selectedPremium: number | null;
  vehicleCount: number;
  driverCount: number;
  property?: any;
  createdAt: string;
}

interface Stats {
  total: number;
  byStatus: {
    draft: number;
    submitted: number;
    quoted: number;
    presented: number;
    accepted: number;
    declined: number;
    expired: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  submitted: { label: "Submitted", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  quoted: { label: "Quoted", color: "bg-blue-100 text-blue-700", icon: FileText },
  presented: { label: "Presented", color: "bg-purple-100 text-purple-700", icon: FileText },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: XCircle },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  personal_auto: { label: "Auto", icon: Car, color: "text-blue-600", bgColor: "bg-blue-100" },
  homeowners: { label: "Home", icon: Home, color: "text-green-600", bgColor: "bg-green-100" },
  renters: { label: "Renters", icon: Home, color: "text-purple-600", bgColor: "bg-purple-100" },
  umbrella: { label: "Umbrella", icon: Shield, color: "text-amber-600", bgColor: "bg-amber-100" },
  recreational_vehicle: { label: "RV/Boat", icon: Ship, color: "text-cyan-600", bgColor: "bg-cyan-100" },
};

export default function QuotesPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    byStatus: { draft: 0, submitted: 0, quoted: 0, presented: 0, accepted: 0, declined: 0, expired: 0 }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [comparisonQuoteId, setComparisonQuoteId] = useState<string | null>(null);

  const fetchQuotes = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/quotes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQuotes(data.quotes || []);
          setStats(data.stats || { total: 0, byStatus: {} });
        }
      }
    } catch (err) {
      console.error("Quotes fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter, typeFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotes();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredQuotes = quotes;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading quotes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quotes</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage and track insurance quotes</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchQuotes(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Link href="/quote/new">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
              <Sparkles className="w-4 h-4 mr-2" />
              New AI Quote
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Quotes", value: stats.total },
          { label: "Draft", value: stats.byStatus.draft || 0 },
          { label: "Quoted", value: stats.byStatus.quoted || 0 },
          { label: "Accepted", value: stats.byStatus.accepted || 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search quotes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="quoted">Quoted</option>
          <option value="presented">Presented</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900">
          <option value="all">All Types</option>
          <option value="personal_auto">Auto</option>
          <option value="homeowners">Homeowners</option>
          <option value="renters">Renters</option>
          <option value="umbrella">Umbrella</option>
        </select>
      </div>

      {/* Quotes List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredQuotes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No quotes found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your filters or create a new quote.</p>
              <Link href="/quote/new"><Button><Plus className="w-4 h-4 mr-2" />New Quote</Button></Link>
            </div>
          ) : (
            filteredQuotes.map((quote) => {
              const status = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;
              const type = TYPE_CONFIG[quote.type] || TYPE_CONFIG.personal_auto;
              const StatusIcon = status.icon;
              const TypeIcon = type.icon;

              return (
                <div key={quote.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", type.bgColor)}>
                        <TypeIcon className={cn("w-5 h-5", type.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {quote.customer?.name || "Unknown Customer"}
                          </span>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {quote.id.slice(0, 8)}...
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          {quote.customer?.phone && (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{quote.customer.phone}</span>
                          )}
                          {quote.customer?.email && (
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{quote.customer.email}</span>
                          )}
                          {!quote.customer?.phone && !quote.customer?.email && (
                            <span className="text-gray-400">No contact info</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        {quote.selectedPremium ? (
                          <div className="flex items-center gap-1 text-lg font-semibold text-gray-900 dark:text-white">
                            <DollarSign className="w-4 h-4" />{quote.selectedPremium.toLocaleString()}/yr
                          </div>
                        ) : (
                          <div className="text-lg font-semibold text-gray-400">No premium</div>
                        )}
                        <div className="text-sm text-gray-500">
                          {quote.type === "personal_auto"
                            ? `${quote.vehicleCount} vehicle${quote.vehicleCount !== 1 ? "s" : ""}, ${quote.driverCount} driver${quote.driverCount !== 1 ? "s" : ""}`
                            : type.label}
                        </div>
                      </div>
                      <Badge className={cn("flex items-center gap-1", status.color)}>
                        <StatusIcon className="w-3 h-3" />{status.label}
                      </Badge>
                      <div className="text-right w-24">
                        <div className="text-sm text-gray-500">{new Date(quote.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{quote.createdBy?.name || "Unknown"}</div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setComparisonQuoteId(quote.id)}>
                            Compare Quotes
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Quote</DropdownMenuItem>
                          <DropdownMenuItem>Send to Customer</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Accepted</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quote Comparison Modal */}
      <QuoteComparisonModal
        quoteId={comparisonQuoteId || ""}
        isOpen={!!comparisonQuoteId}
        onClose={() => setComparisonQuoteId(null)}
        onSelect={() => fetchQuotes(true)}
      />
    </div>
  );
}
