'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Search, Car, Home, Building2, Layers, Upload, FileArchive, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import RenewalCard from '@/components/features/renewal/RenewalCard';
import RenewalDetailPanel from '@/components/features/renewal/RenewalDetailPanel';
import type { RenewalComparison, RenewalsListResponse, RenewalStats } from '@/components/features/renewal/types';

// =============================================================================
// COMPONENT
// =============================================================================

export default function RenewalReviewPage() {
  // Current user
  const { user } = useUser();

  // Carrier dropdown options
  const [carriers, setCarriers] = useState<string[]>([]);

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

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch distinct carrier names for dropdown
  useEffect(() => {
    fetch('/api/renewals/carriers')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.success) setCarriers(data.carriers);
      })
      .catch((err) => console.error('Failed to fetch carriers:', err));
  }, []);

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
      if (!res.ok) {
        console.error('API error:', res.status);
        toast.error('Failed to load renewals');
        return;
      }
      const data: RenewalsListResponse = await res.json();

      if (data.success) {
        setRenewals(data.renewals);
        setStats(data.stats);
        // Only update total/totalPages from server — keep page/limit local to avoid re-fetch loop
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
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
      if (!user?.id) {
        toast.error('User profile not loaded — please refresh the page');
        throw new Error('User not loaded');
      }
      const res = await fetch(`/api/renewals/${renewalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes,
          userId: user.id,
          userName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        }),
      });
      if (!res.ok && res.status !== 409) {
        toast.error('Failed to record decision');
        throw new Error('Decision API error');
      }
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
        throw new Error('Conflict');
      } else {
        toast.error(data.error || 'Failed to record decision');
        throw new Error(data.error || 'Decision failed');
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

  // Upload handlers
  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUploadError('Only .zip files are accepted');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (user?.id) formData.append('uploadedById', user.id);

      const res = await fetch('/api/renewals/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}): ${text.substring(0, 100)}`);
      }
      const data = await res.json();

      if (data.success) {
        toast.success(`Batch uploaded: ${file.name}`);
        setShowUploadZone(false);
        await fetchRenewals();
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploadZone((v) => !v)}
              className={cn(
                'px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors',
                showUploadZone
                  ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              <Upload className="h-4 w-4" />
              Upload Batch
            </button>
            <button
              onClick={fetchRenewals}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Inline Upload Zone */}
        {showUploadZone && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'mt-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />
            <FileArchive className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {uploading ? 'Uploading...' : 'Drop IVANS ZIP here'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-2 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Select File'}
            </button>
            {uploadError && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

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
            onClick={() => {
              setFilters((f) => ({
                ...f,
                status: f.status === 'waiting_agent_review' ? '' : 'waiting_agent_review',
              }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <StatBadge
            label="In Review"
            count={stats.inReviewCount}
            active={filters.status === 'requote_requested'}
            color="blue"
            onClick={() => {
              setFilters((f) => ({
                ...f,
                status: f.status === 'requote_requested' ? '' : 'requote_requested',
              }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <StatBadge
            label="Decided"
            count={stats.decidedCount}
            active={filters.status === 'agent_reviewed'}
            color="indigo"
            onClick={() => {
              setFilters((f) => ({
                ...f,
                status: f.status === 'agent_reviewed' ? '' : 'agent_reviewed',
              }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <StatBadge
            label="Completed"
            count={stats.completedCount}
            active={filters.status === 'completed'}
            color="green"
            onClick={() => {
              setFilters((f) => ({
                ...f,
                status: f.status === 'completed' ? '' : 'completed',
              }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <StatBadge
            label="Reshop"
            count={stats.reshopCount}
            active={filters.recommendation === 'reshop'}
            color="orange"
            onClick={() => {
              setFilters((f) => ({
                ...f,
                recommendation: f.recommendation === 'reshop' ? '' : 'reshop',
              }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
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
        <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 shrink-0 overflow-y-auto">
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
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}
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
              onChange={(e) => { setFilters((f) => ({ ...f, recommendation: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}
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
            <select
              value={filters.carrier}
              onChange={(e) => { setFilters((f) => ({ ...f, carrier: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Carriers</option>
              {carriers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Renewal Date</label>
            <select
              value={filters.dateRange}
              onChange={(e) => { setFilters((f) => ({ ...f, dateRange: e.target.value })); setPagination((p) => ({ ...p, page: 1 })); }}
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
            hasActiveFilters ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <RefreshCw className="h-10 w-10 mb-3 text-gray-300" />
                <p className="text-lg font-medium">No renewals found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
                <button
                  onClick={clearFilters}
                  className="mt-3 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-sm"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    'w-full max-w-md border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                    dragActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <FileArchive className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    {uploading ? 'Uploading...' : 'Drop IVANS ZIP here'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    or click to select a file
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Select File'}
                  </button>
                  {uploadError && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <span>{uploadError}</span>
                      <button onClick={(e) => { e.stopPropagation(); setUploadError(null); }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
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

      </div>

      {/* Detail Overlay */}
      {selectedRenewal && (
        <RenewalDetailPanel
          renewal={selectedRenewal}
          onClose={() => setSelectedRenewal(null)}
          onDecision={handleDecision}
          onRefresh={fetchRenewals}
          userId={user?.id}
          userName={user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : undefined}
        />
      )}
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
