'use client';

/**
 * Agent Dashboard
 * ===============
 * Simplified dashboard for agents with quick access to their tools.
 */

import Link from 'next/link';
import {
  FileWarning,
  MessageSquare,
  CreditCard,
  DollarSign,
  Link2,
  MapPin,
  FileText,
  Shield,
  Clock,
  Banknote,
  IdCard,
  Search,
  Users,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// =============================================================================
// TOOL CONFIGURATION
// =============================================================================

const AGENT_TOOLS = [
  {
    id: 'policy-notices',
    label: 'Policy Notices',
    description: 'Cancellations & payment due',
    icon: FileWarning,
    href: '/policy-notices',
    color: 'from-red-500 to-rose-600',
    bgLight: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-600 dark:text-red-400',
    priority: true,
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'Text message inbox',
    icon: MessageSquare,
    href: '/messages',
    color: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400',
    priority: true,
  },
  {
    id: 'id-cards',
    label: 'ID Cards',
    description: 'Generate insurance cards',
    icon: IdCard,
    href: '/id-cards',
    color: 'from-emerald-500 to-emerald-600',
    bgLight: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'same-day-payment',
    label: 'Same Day Payment',
    description: 'Process urgent payments',
    icon: Clock,
    href: '/same-day-payment',
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'payment-advance',
    label: 'Payment Advance',
    description: 'Schedule future payments',
    icon: Banknote,
    href: '/payment-advance',
    color: 'from-green-500 to-green-600',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    id: 'canopy-connect',
    label: 'Canopy Connect',
    description: 'Import policy data',
    icon: Link2,
    href: '/canopy-connect',
    color: 'from-purple-500 to-purple-600',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'properties',
    label: 'Property Reports',
    description: 'View property details',
    icon: MapPin,
    href: '/properties',
    color: 'from-cyan-500 to-cyan-600',
    bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
    textColor: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'invoice',
    label: 'Invoice Generator',
    description: 'Create invoices',
    icon: FileText,
    href: '/invoice',
    color: 'from-indigo-500 to-indigo-600',
    bgLight: 'bg-indigo-100 dark:bg-indigo-900/30',
    textColor: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'risk-monitor',
    label: 'Risk Monitor',
    description: 'Property risk alerts',
    icon: Shield,
    href: '/risk-monitor',
    color: 'from-slate-500 to-slate-600',
    bgLight: 'bg-slate-100 dark:bg-slate-900/30',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
];

// =============================================================================
// CUSTOMER SEARCH TYPES
// =============================================================================

interface CustomerResult {
  id: string;
  agencyzoomId?: string;
  type: 'customer' | 'lead';
  name: string;
  phone?: string;
  email?: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface AgentDashboardProps {
  userName?: string;
}

export default function AgentDashboard({ userName }: AgentDashboardProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Perform customer search
  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
      const results: CustomerResult[] = [];

      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          data.results.forEach((c: any) => {
            results.push({
              id: c.id,
              agencyzoomId: c.azCustomerId || c.agencyzoomId,
              type: 'customer',
              name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
              phone: c.phone || c.mobilePhone,
              email: c.email,
            });
          });
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowResults(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Priority tools (first row)
  const priorityTools = AGENT_TOOLS.filter(t => t.priority);
  const otherTools = AGENT_TOOLS.filter(t => !t.priority);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {userName ? `Welcome, ${userName}` : 'Agent Dashboard'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Quick access to your tools
          </p>
        </div>

        {/* ================================================================= */}
        {/* CUSTOMER SEARCH */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Find Customer
          </h2>

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
                  'w-full pl-12 pr-12 py-4 text-lg border-2 rounded-xl transition-all',
                  'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
                  'focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
                  'placeholder-gray-400'
                )}
              />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-auto">
                {searchResults.map((result) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={`/customers/${result.agencyzoomId || result.id}`}
                    onClick={() => setShowResults(false)}
                  >
                    <div className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{result.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {result.phone || result.email || 'No contact info'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* No Results */}
            {showResults && query.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 p-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-600 dark:text-gray-400">No customers found for "{query}"</p>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* PRIORITY TOOLS - Policy Notices & Messages */}
        {/* ================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {priorityTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.id} href={tool.href}>
                <div className={cn(
                  'relative bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6',
                  'hover:shadow-lg hover:scale-[1.02] transition-all group cursor-pointer',
                  'hover:border-transparent'
                )}>
                  {/* Gradient overlay on hover */}
                  <div className={cn(
                    'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br',
                    tool.color
                  )} />

                  <div className="relative z-10 flex items-center gap-4">
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center transition-colors',
                      tool.bgLight,
                      'group-hover:bg-white/20'
                    )}>
                      <Icon className={cn(
                        'w-7 h-7 transition-colors',
                        tool.textColor,
                        'group-hover:text-white'
                      )} />
                    </div>
                    <div>
                      <h3 className={cn(
                        'text-lg font-bold transition-colors',
                        'text-gray-900 dark:text-white',
                        'group-hover:text-white'
                      )}>
                        {tool.label}
                      </h3>
                      <p className={cn(
                        'text-sm transition-colors',
                        'text-gray-500 dark:text-gray-400',
                        'group-hover:text-white/80'
                      )}>
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  {tool.priority && (
                    <Badge className="absolute top-3 right-3 bg-red-500 text-white group-hover:bg-white group-hover:text-red-500">
                      Priority
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </section>

        {/* ================================================================= */}
        {/* OTHER TOOLS */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Tools
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {otherTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.id} href={tool.href}>
                  <div className="group flex flex-col items-center p-4 rounded-xl transition-all duration-200 hover:scale-105 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {/* Icon Circle */}
                    <div className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200',
                      tool.bgLight,
                      'group-hover:bg-gradient-to-br',
                      tool.color,
                      'group-hover:shadow-lg'
                    )}>
                      <Icon className={cn(
                        'w-7 h-7 transition-colors',
                        tool.textColor,
                        'group-hover:text-white'
                      )} />
                    </div>

                    {/* Label */}
                    <span className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                      {tool.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-0.5">
                      {tool.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* QUICK INFO */}
        {/* ================================================================= */}
        <section className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Need help? Contact your supervisor or manager.</p>
        </section>
      </div>
    </div>
  );
}
