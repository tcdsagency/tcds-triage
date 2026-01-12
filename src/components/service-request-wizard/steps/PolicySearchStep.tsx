'use client';

/**
 * Policy Search Step
 * ==================
 * Search and select a policy to modify.
 */

import { useState, useEffect } from 'react';
import { Search, Loader2, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useServiceRequestWizard, usePrefill } from '../ServiceRequestWizardProvider';
import { getPolicyTypeIcon, type PolicyType } from '@/types/customer-profile';

interface PolicySearchResult {
  id: string;
  policyNumber: string;
  type: string;
  carrier: string;
  insuredName: string;
  effectiveDate: string;
  expirationDate: string;
  status?: string;
  isActive?: boolean;
}

export function PolicySearchStep() {
  const { selectPolicy, formData, errors } = useServiceRequestWizard();
  const { prefillQuery } = usePrefill();
  const [searchQuery, setSearchQuery] = useState(prefillQuery || '');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PolicySearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // Auto-search on prefill
  useEffect(() => {
    if (prefillQuery && !prefillApplied) {
      setPrefillApplied(true);
      setSearchQuery(prefillQuery);
      searchPolicies(prefillQuery);
    }
  }, [prefillQuery, prefillApplied]);

  const searchPolicies = async (query?: string) => {
    const q = query || searchQuery;
    if (!q.trim()) return;

    setSearching(true);
    setHasSearched(true);
    try {
      // Don't filter by activeOnly - show all policies with status indicator
      const res = await fetch(`/api/policy/search?q=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();

      if (data.success && data.results) {
        setSearchResults(
          data.results.map((p: any) => ({
            id: p.id,
            policyNumber: p.policyNumber,
            type: p.type || 'Unknown',
            carrier: p.carrier || 'Unknown Carrier',
            insuredName: p.insuredName || 'Unknown',
            effectiveDate: p.effectiveDate || '',
            expirationDate: p.expirationDate || '',
            status: p.status || 'Unknown',
            isActive: p.isActive ?? true,
          }))
        );
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
          <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Find the Policy
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Search by policy number, customer name, phone, or email
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex gap-3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, policy number, phone, or email..."
            className="bg-white border-gray-300 text-gray-900"
            onKeyDown={(e) => e.key === 'Enter' && searchPolicies()}
          />
          <Button
            onClick={() => searchPolicies()}
            disabled={searching || !searchQuery.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="mt-6">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No policies found matching your search</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchResults.length} {searchResults.length === 1 ? 'policy' : 'policies'} found
                </p>
                {searchResults.map((policy) => (
                  <button
                    key={policy.id}
                    onClick={() => selectPolicy(policy)}
                    className={cn(
                      'w-full p-4 rounded-lg border text-left transition-all',
                      'bg-gray-50 dark:bg-gray-800/50',
                      'border-gray-200 dark:border-gray-700',
                      'hover:border-emerald-500 hover:shadow-md',
                      formData.policy?.id === policy.id &&
                        'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {/* Status dot indicator */}
                          <span
                            className={cn(
                              'w-2.5 h-2.5 rounded-full flex-shrink-0',
                              policy.isActive
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            )}
                            title={policy.isActive ? 'Active' : policy.status || 'Inactive'}
                          />
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {policy.policyNumber}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {getPolicyTypeIcon(policy.type as PolicyType)} {policy.type}
                          </Badge>
                          {!policy.isActive && (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                              {policy.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {policy.insuredName} &bull; {policy.carrier}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Effective: {policy.effectiveDate} - {policy.expirationDate}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {errors.policy && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errors.policy}</p>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-500/30">
        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Search Tips</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>&bull; Search by full or partial policy number</li>
          <li>&bull; Search by customer first or last name</li>
          <li>&bull; Search by phone number or email address</li>
        </ul>
      </div>
    </div>
  );
}

export default PolicySearchStep;
