"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, Plus, MoreVertical, Clock, CheckCircle2, XCircle, 
  Car, Home, Ship, ChevronRight, Phone, Mail,
  DollarSign, FileText, Sparkles
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

const MOCK_QUOTES = [
  {
    id: "Q-2024-001",
    customer: { name: "John Smith", phone: "(205) 555-1234", email: "john.smith@email.com" },
    type: "auto",
    status: "pending",
    premium: 1247,
    vehicles: 2,
    drivers: 2,
    createdAt: "2024-01-06T10:30:00",
    agent: "Todd Conn",
  },
  {
    id: "Q-2024-002",
    customer: { name: "Sarah Johnson", phone: "(205) 555-5678", email: "sarah.j@email.com" },
    type: "home",
    status: "quoted",
    premium: 2340,
    dwelling: 350000,
    createdAt: "2024-01-05T14:15:00",
    agent: "Todd Conn",
  },
  {
    id: "Q-2024-003",
    customer: { name: "Mike Williams", phone: "(205) 555-9012", email: "mike.w@email.com" },
    type: "auto",
    status: "sold",
    premium: 890,
    vehicles: 1,
    drivers: 1,
    createdAt: "2024-01-04T09:00:00",
    agent: "Sarah Smith",
  },
  {
    id: "Q-2024-004",
    customer: { name: "Emily Davis", phone: "(205) 555-3456", email: "emily.d@email.com" },
    type: "auto",
    status: "expired",
    premium: 1560,
    vehicles: 2,
    drivers: 3,
    createdAt: "2023-12-20T16:45:00",
    agent: "Todd Conn",
  },
  {
    id: "Q-2024-005",
    customer: { name: "Robert Brown", phone: "(205) 555-7890", email: "r.brown@email.com" },
    type: "home",
    status: "pending",
    premium: 1875,
    dwelling: 275000,
    createdAt: "2024-01-06T08:00:00",
    agent: "Mike Johnson",
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  quoted: { label: "Quoted", color: "bg-blue-100 text-blue-700", icon: FileText },
  sold: { label: "Sold", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-700", icon: XCircle },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: XCircle },
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  auto: { label: "Auto", icon: Car, color: "text-blue-600" },
  home: { label: "Home", icon: Home, color: "text-green-600" },
  boat: { label: "Boat", icon: Ship, color: "text-cyan-600" },
};

export default function QuotesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredQuotes = MOCK_QUOTES.filter(quote => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      if (!quote.customer.name.toLowerCase().includes(search) &&
          !quote.id.toLowerCase().includes(search) &&
          !quote.customer.email.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (statusFilter !== "all" && quote.status !== statusFilter) return false;
    if (typeFilter !== "all" && quote.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: MOCK_QUOTES.length,
    pending: MOCK_QUOTES.filter(q => q.status === "pending").length,
    quoted: MOCK_QUOTES.filter(q => q.status === "quoted").length,
    sold: MOCK_QUOTES.filter(q => q.status === "sold").length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quotes</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage and track insurance quotes</p>
        </div>
        <Link href="/quote/new">
          <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
            <Sparkles className="w-4 h-4 mr-2" />
            New AI Quote
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Quotes", value: stats.total },
          { label: "Pending", value: stats.pending },
          { label: "Quoted", value: stats.quoted },
          { label: "Sold", value: stats.sold },
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="quoted">Quoted</option>
          <option value="sold">Sold</option>
          <option value="expired">Expired</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
          <option value="all">All Types</option>
          <option value="auto">Auto</option>
          <option value="home">Home</option>
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
              const status = STATUS_CONFIG[quote.status];
              const type = TYPE_CONFIG[quote.type];
              const StatusIcon = status.icon;
              const TypeIcon = type.icon;
              
              return (
                <div key={quote.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", quote.type === "auto" ? "bg-blue-100" : "bg-green-100")}>
                        <TypeIcon className={cn("w-5 h-5", type.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">{quote.customer.name}</span>
                          <Badge variant="secondary" className="text-xs">{quote.id}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{quote.customer.phone}</span>
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{quote.customer.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-lg font-semibold text-gray-900 dark:text-white">
                          <DollarSign className="w-4 h-4" />{quote.premium.toLocaleString()}/yr
                        </div>
                        <div className="text-sm text-gray-500">
                          {quote.type === "auto" ? `${quote.vehicles} vehicle${quote.vehicles !== 1 ? "s" : ""}, ${quote.drivers} driver${quote.drivers !== 1 ? "s" : ""}` : `$${((quote as any).dwelling || 0).toLocaleString()} dwelling`}
                        </div>
                      </div>
                      <Badge className={cn("flex items-center gap-1", status.color)}>
                        <StatusIcon className="w-3 h-3" />{status.label}
                      </Badge>
                      <div className="text-right w-24">
                        <div className="text-sm text-gray-500">{new Date(quote.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{quote.agent}</div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Quote</DropdownMenuItem>
                          <DropdownMenuItem>Send to Customer</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Sold</DropdownMenuItem>
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
    </div>
  );
}
