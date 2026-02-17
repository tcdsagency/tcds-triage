'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { debounce } from '@/lib/utils';

interface Customer {
  id: string;
  agencyzoomId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  phoneAlt?: string | null;
  isLead: boolean;
  policyStatus: string;
  policyCount: number;
  policyTypes: string[];
  source?: string;
}

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  initialPhone?: string;
  initialQuery?: string;
  title?: string;
}

// Normalize phone number by removing +1 country code prefix
function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove +1 prefix if present (common US country code)
  let normalized = phone.replace(/^\+1/, '');
  // Also remove any leading 1 if it's followed by 10 digits (e.g., 14691234567)
  if (normalized.length === 11 && normalized.startsWith('1')) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

export default function CustomerSearchModal({
  isOpen,
  onClose,
  onSelect,
  initialPhone,
  initialQuery,
  title = 'Find Customer Match',
}: CustomerSearchModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Pre-populate search with phone or query if provided
  useEffect(() => {
    if (isOpen && !search) {
      if (initialQuery) {
        setSearch(initialQuery);
      } else if (initialPhone) {
        setSearch(normalizePhone(initialPhone));
      }
    }
  }, [isOpen, initialPhone, initialQuery]);

  const searchCustomers = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await res.json();
        if (data.success) {
          setResults(data.results);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchCustomers(search);
  }, [search, searchCustomers]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setResults([]);
      setSearched(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getPolicyStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Active</span>;
      case 'expiring':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">Expiring</span>;
      case 'lead':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">Lead</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">No Policy</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Search by name, phone, or email to find the correct customer
          </p>
        </div>

        {/* Search Input */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              autoFocus
              className={cn(
                'w-full px-4 py-3 pl-10 rounded-lg border transition-colors',
                'text-gray-900 bg-white',
                'border-gray-300',
                'placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
              style={{ color: '#111827' }}
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!searched && search.length < 2 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <p>Type at least 2 characters to search</p>
            </div>
          ) : loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">😕</div>
              <p>No customers found for &quot;{search}&quot;</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => onSelect(customer)}
                  className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                    customer.isLead ? 'bg-purple-500' : 'bg-blue-500'
                  )}>
                    {customer.firstName?.[0] || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {customer.displayName}
                      </span>
                      {getPolicyStatusBadge(customer.policyStatus)}
                      {customer.source === 'agencyzoom' && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700">AZ</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      {customer.phone && <span>{customer.phone}</span>}
                      {customer.email && <span className="truncate">{customer.email}</span>}
                    </div>
                    {customer.policyCount > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {customer.policyCount} {customer.policyCount === 1 ? 'policy' : 'policies'}
                        {customer.policyTypes.length > 0 && ` • ${customer.policyTypes.join(', ')}`}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Select a customer to link to this quote
          </p>
        </div>
      </div>
    </div>
  );
}
