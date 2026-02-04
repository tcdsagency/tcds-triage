'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Car, Home, Building2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import RenewalCard from '@/components/features/renewal/RenewalCard';
import RenewalDetailPanel from '@/components/features/renewal/RenewalDetailPanel';
import type { RenewalComparison, RenewalsListResponse, RenewalStats } from '@/components/features/renewal/types';

// =============================================================================
// COMPONENT
// =============================================================================

export default function RenewalReviewPage() {
  // State
  const [renewals, setRenewals] = useState<RenewalComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRenewal, setSelectedRenewal] = useState<RenewalComparison | null>(null);
  const [stats, setStats] = useState<RenewalStats>({
    pendingCount: 0,
    inReviewCount: 0,
    decidedCount: 0,
    completedCount: 0,
    reshopCount: 0,
    totalActive: 0,
    avgPremiumChangePercent: null,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Category tab
  const [activeCategory, setActiveCategory] = useState<'all' | 'auto' | 'home' | 'commercial'>('all');

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    carrier: '',
    recommendation: '',
    search: '',
    dateRange: '',
  });

  // Sort
  const [sortBy, setSortBy] = useState('renewalDate');

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }));
      setPagination((p) => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch renewals
  const fetchRenewals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('lob', activeCategory);
      if (filters.status) params.set('status', filters.status);
      if (filters.carrier) params.set('carrier', filters.carrier);
      if (filters.recommendation) params.set('recommendation', filters.recommendation);
      if (filters.search) params.set('search', filters.search);
      if (filters.dateRange) params.set('dateRange', filters.dateRange);
      params.set('sort', sortBy);
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      const res = await fetch(`/api/renewals?${params}`);
      const data: RenewalsListResponse = await res.json();

      if (data.success) {
        setRenewals(data.renewals);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching renewals:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, filters.status, filters.carrier, filters.recommendation, filters.search, filters.dateRange, sortBy, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchRenewals();
  }, [fetchRenewals]);

  // Handle agent decision
  const handleDecision = async (renewalId: string, decision: string, notes: string) => {
    try {
      const res = await fetch(`/api/renewals/${renewalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Decision recorded: ${decision.replace(/_/g, ' ')}`);
        // Optimistic update
        setRenewals((prev) =>
          prev.map((r) =>
            r.id === renewalId
              ? { ...r, agentDecision: decision, agentNotes: notes, status: data.newStatus || r.status }
              : r
          )
        );
        if (selectedRenewal?.id === renewalId) {
          setSelectedRenewal((prev) =>
            prev ? { ...prev, agentDecision: decision, agentNotes: notes, status: data.newStatus || prev.status } : null
          );
        }
      } else if (res.status === 409) {
        toast.error('Decision already recorded by another agent');
        await fetchRenewals();
      } else {
        toast.error(data.error || 'Failed to record decision');
      }
    } catch (err) {
      console.error('Error recording decision:', err);
      toast.error('Failed to record decision');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({ status: '', carrier: '', recommendation: '', search: '', dateRange: '' });
    setSearchInput('');
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const hasActiveFilters =
    filters.status || filters.carrier || filters.recommendation || filters.search || filters.dateRange;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Renewal Review
              </h1>
              {stats.pendingCount > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {stats.pendingCount} pending
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review and action renewal offers from IVANS
            </p>
          </div>
          <button
            onClick={fetchRenewals}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 mt-4 border-b border-gray-200 dark:border-gray-700">
          <CategoryTab
            label="All"
            icon={<Layers className="h-4 w-4" />}
            count={stats.totalActive}
            active={activeCategory === 'all'}
            onClick={() => {
              setActiveCategory('all');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <CategoryTab
            label="Auto"
            icon={<Car className="h-4 w-4" />}
            count={null}
            active={activeCategory === 'auto'}
            onClick={() => {
              setActiveCategory('auto');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <CategoryTab
            label="Home"
            icon={<Home className="h-4 w-4" />}
            count={null}
            active={activeCategory === 'home'}
            onClick={() => {
              setActiveCategory('home');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <CategoryTab
            label="Commercial"
            icon={<Building2 className="h-4 w-4" />}
            count={null}
            active={activeCategory === 'commercial'}
            onClick={() => {
              setActiveCategory('commercial');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex gap-3 mt-4 flex-wrap">
          <StatBadge
            label="Pending"
            count={stats.pendingCount}
            active={filters.status === 'waiting_agent_review'}
            color="amber"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                status: f.status === 'waiting_agent_review' ? '' : 'waiting_agent_review',
              }))
            }
          />
          <StatBadge
            label="In Review"
            count={stats.inReviewCount}
            active={filters.status === 'agent_reviewed'}
            color="blue"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                status: f.status === 'agent_reviewed' ? '' : 'agent_reviewed',
              }))
            }
          />
          <StatBadge
            label="Decided"
            count={stats.decidedCount}
            active={false}
            color="indigo"
            onClick={() => {}}
          />
          <StatBadge
            label="Completed"
            count={stats.completedCount}
            active={filters.status === 'completed'}
            color="green"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                status: f.status === 'completed' ? '' : 'completed',
              }))
            }
          />
          <StatBadge
            label="Reshop"
            count={stats.reshopCount}
            active={filters.status === 'requote_requested'}
            color="orange"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                status: f.status === 'requote_requested' ? '' : 'requote_requested',
              }))
            }
          />
          {stats.avgPremiumChangePercent != null && (
            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              Avg change:
              <span
                className={cn(
                  'font-semibold',
                  stats.avgPremiumChangePercent > 0
                    ? 'text-red-600 dark:text-red-400'
                    : stats.avgPremiumChangePercent < 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600'
                )}
              >
                {stats.avgPremiumChangePercent > 0 ? '+' : ''}
                {stats.avgPremiumChangePercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex h-[calc(100vh-240px)]">
        {/* Sidebar Filters */}
        <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-4">Filters</h2>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Name, policy..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Statuses</option>
              <option value="pending_ingestion">Pending Ingestion</option>
              <option value="comparison_ready">Comparison Ready</option>
              <option value="waiting_agent_review">Waiting Agent Review</option>
              <option value="agent_reviewed">Agent Reviewed</option>
              <option value="requote_requested">Requote Requested</option>
              <option value="quote_ready">Quote Ready</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Recommendation Filter */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Recommendation</label>
            <select
              value={filters.recommendation}
              onChange={(e) => setFilters((f) => ({ ...f, recommendation: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="renew_as_is">Renew As-Is</option>
              <option value="reshop">Reshop</option>
              <option value="needs_review">Needs Review</option>
            </select>
          </div>

          {/* Carrier Filter */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Carrier</label>
            <input
              type="text"
              placeholder="Carrier name..."
              value={filters.carrier}
              onChange={(e) => setFilters((f) => ({ ...f, carrier: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Date Range Filter */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Renewal Date</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">Any Date</option>
              <option value="7">Next 7 Days</option>
              <option value="14">Next 14 Days</option>
              <option value="30">Next 30 Days</option>
              <option value="60">Next 60 Days</option>
              <option value="past">Past Due</option>
            </select>
          </div>

          {/* Sort */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="renewalDate">Renewal Date</option>
              <option value="premiumChange">Premium Change</option>
              <option value="priority">Priority</option>
              <option value="createdAt">Date Added</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full px-3 py-2 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              Clear Filters
            </button>
          )}

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {renewals.length} of {pagination.total}
            </p>
          </div>
        </div>

        {/* Main Content - Card Grid */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : renewals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <RefreshCw className="h-10 w-10 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No renewals found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Upload an IVANS batch to get started'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {renewals.map((renewal) => (
                <RenewalCard
                  key={renewal.id}
                  renewal={renewal}
                  isSelected={selectedRenewal?.id === renewal.id}
                  onClick={() => setSelectedRenewal(renewal)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedRenewal && (
          <RenewalDetailPanel
            renewal={selectedRenewal}
            onClose={() => setSelectedRenewal(null)}
            onDecision={handleDecision}
            onRefresh={fetchRenewals}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CategoryTab({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2',
        active
          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
      )}
    >
      {icon}
      {label}
      {count != null && count > 0 && (
        <span
          className={cn(
            'px-2 py-0.5 text-xs rounded-full',
            active
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatBadge({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: 'amber' | 'blue' | 'indigo' | 'green' | 'orange';
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    amber: active
      ? 'bg-amber-200 dark:bg-amber-800 ring-2 ring-amber-500'
      : 'bg-amber-100 dark:bg-amber-900/30',
    blue: active
      ? 'bg-blue-200 dark:bg-blue-800 ring-2 ring-blue-500'
      : 'bg-blue-100 dark:bg-blue-900/30',
    indigo: active
      ? 'bg-indigo-200 dark:bg-indigo-800 ring-2 ring-indigo-500'
      : 'bg-indigo-100 dark:bg-indigo-900/30',
    green: active
      ? 'bg-green-200 dark:bg-green-800 ring-2 ring-green-500'
      : 'bg-green-100 dark:bg-green-900/30',
    orange: active
      ? 'bg-orange-200 dark:bg-orange-800 ring-2 ring-orange-500'
      : 'bg-orange-100 dark:bg-orange-900/30',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
        colors[color]
      )}
    >
      {label}: {count}
    </button>
  );
}
