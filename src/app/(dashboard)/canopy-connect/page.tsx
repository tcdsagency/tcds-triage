'use client';

import { useState, useEffect, useCallback } from 'react';
import { AgencyZoomButton, getAgencyZoomUrl } from '@/components/ui/agencyzoom-link';

// =============================================================================
// TYPES
// =============================================================================

interface CanopyPull {
  id: string;
  pullId: string;
  pullStatus: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  carrierFriendlyName: string | null;
  policyCount: number | null;
  vehicleCount: number | null;
  driverCount: number | null;
  totalPremiumCents: number | null;
  matchStatus: string;
  matchedCustomerId: string | null;
  matchedAgencyzoomId: string | null;
  agencyzoomNoteSynced: boolean | null;
  pulledAt: string | null;
  createdAt: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  agencyzoomId: string | null;
}

interface PullDetail extends CanopyPull {
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    fullAddress?: string;
  };
  secondaryInsured?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    relationship?: string;
  };
  vehicles?: any[];
  drivers?: any[];
  policies?: any[];
  coverages?: any[];
  matchedCustomer?: Customer;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CanopyConnectPage() {
  // State
  const [pulls, setPulls] = useState<CanopyPull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPull, setSelectedPull] = useState<PullDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    search: '',
  });

  // Send link modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    phone: '',
    email: '',
    firstName: '',
    lastName: '',
  });
  const [sending, setSending] = useState(false);

  // Customer match modal
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Fetch pulls
  const fetchPulls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);

      const response = await fetch(`/api/canopy-connect?${params}`);
      const data = await response.json();

      if (data.success) {
        setPulls(data.pulls);
        setStats(data.stats || {});
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching pulls:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    fetchPulls();
  }, [fetchPulls]);

  // Fetch pull detail
  const fetchPullDetail = async (pullId: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/canopy-connect/${pullId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedPull(data.pull);
      }
    } catch (error) {
      console.error('Error fetching pull detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Send Canopy link
  const handleSendLink = async () => {
    if (!sendForm.phone && !sendForm.email) {
      alert('Phone or email is required');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/canopy-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendForm),
      });
      const data = await response.json();

      if (data.success) {
        setShowSendModal(false);
        setSendForm({ phone: '', email: '', firstName: '', lastName: '' });
        await fetchPulls();
        alert(`Link sent! Pull ID: ${data.pullId}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending link:', error);
      alert('Failed to send link');
    } finally {
      setSending(false);
    }
  };

  // Search customers for matching
  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setCustomerResults([]);
      return;
    }

    setSearchingCustomers(true);
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.success) {
        setCustomerResults(data.customers || []);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Match pull to customer
  const handleMatch = async (customerId: string) => {
    if (!selectedPull) return;

    try {
      const response = await fetch(`/api/canopy-connect/${selectedPull.id}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const data = await response.json();

      if (data.success) {
        setShowMatchModal(false);
        await fetchPulls();
        await fetchPullDetail(selectedPull.id);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error matching pull:', error);
    }
  };

  // Sync to AgencyZoom
  const handleSyncNote = async () => {
    if (!selectedPull) return;

    try {
      const response = await fetch(`/api/canopy-connect/${selectedPull.id}/sync-note`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        await fetchPulls();
        await fetchPullDetail(selectedPull.id);
        alert('Note synced to AgencyZoom!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error syncing note:', error);
    }
  };

  // Format currency
  const formatCurrency = (cents: number | null) => {
    if (!cents) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Canopy Connect
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Import policy data directly from customer carrier accounts
            </p>
          </div>
          <button
            onClick={() => setShowSendModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <span>+</span>
            Send Link
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 mt-4">
          <StatBadge
            label="Pending"
            count={stats.pending || 0}
            active={filters.status === 'pending'}
            color="gray"
            onClick={() => setFilters(f => ({ ...f, status: f.status === 'pending' ? '' : 'pending' }))}
          />
          <StatBadge
            label="Matched"
            count={stats.matched || 0}
            active={filters.status === 'matched'}
            color="blue"
            onClick={() => setFilters(f => ({ ...f, status: f.status === 'matched' ? '' : 'matched' }))}
          />
          <StatBadge
            label="Synced"
            count={stats.created || 0}
            active={filters.status === 'created'}
            color="green"
            onClick={() => setFilters(f => ({ ...f, status: f.status === 'created' ? '' : 'created' }))}
          />
          <StatBadge
            label="Needs Review"
            count={stats.needs_review || 0}
            active={filters.status === 'needs_review'}
            color="yellow"
            onClick={() => setFilters(f => ({ ...f, status: f.status === 'needs_review' ? '' : 'needs_review' }))}
          />
          <StatBadge
            label="Ignored"
            count={stats.ignored || 0}
            active={filters.status === 'ignored'}
            color="gray"
            onClick={() => setFilters(f => ({ ...f, status: f.status === 'ignored' ? '' : 'ignored' }))}
          />
        </div>
      </div>

      <div className="flex h-[calc(100vh-180px)]">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Filters</h2>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Search</label>
            <input
              type="text"
              placeholder="Name, phone, email..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white text-gray-900"
            />
          </div>

          {/* Clear Filters */}
          {(filters.status || filters.search) && (
            <button
              onClick={() => setFilters({ status: '', search: '' })}
              className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Clear Filters
            </button>
          )}

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {pulls.length} of {total} imports
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin text-4xl">&#x21bb;</div>
            </div>
          ) : pulls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <span className="text-4xl mb-2">📥</span>
              <p>No imports found</p>
              <button
                onClick={() => setShowSendModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Send a Canopy link to get started
              </button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {pulls.map((pull) => (
                <PullCard
                  key={pull.id}
                  pull={pull}
                  isSelected={selectedPull?.id === pull.id}
                  onSelect={() => {
                    setSelectedPull(null);
                    fetchPullDetail(pull.id);
                  }}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPull && (
          <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-auto">
            {loadingDetail ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin text-4xl">&#x21bb;</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    Import Details
                  </h2>
                  <button
                    onClick={() => setSelectedPull(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-4">
                  <DetailRow label="Name" value={`${selectedPull.firstName || ''} ${selectedPull.lastName || ''}`.trim() || 'N/A'} />
                  <DetailRow label="Phone" value={selectedPull.phone || 'N/A'} />
                  <DetailRow label="Email" value={selectedPull.email || 'N/A'} />
                  <DetailRow label="Carrier" value={selectedPull.carrierFriendlyName || 'N/A'} />
                  <DetailRow label="Policies" value={String(selectedPull.policyCount || 0)} />
                  <DetailRow label="Vehicles" value={String(selectedPull.vehicleCount || 0)} />
                  <DetailRow label="Drivers" value={String(selectedPull.driverCount || 0)} />
                  <DetailRow label="Premium" value={formatCurrency(selectedPull.totalPremiumCents)} />
                  <DetailRow label="Imported" value={formatDate(selectedPull.pulledAt)} />

                  {/* Address */}
                  {selectedPull.address?.fullAddress && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Address</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {selectedPull.address.fullAddress}
                      </p>
                    </div>
                  )}

                  {/* Secondary Insured */}
                  {selectedPull.secondaryInsured?.firstName && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Secondary Insured</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {selectedPull.secondaryInsured.firstName} {selectedPull.secondaryInsured.lastName}
                        {selectedPull.secondaryInsured.relationship && ` (${selectedPull.secondaryInsured.relationship})`}
                      </p>
                    </div>
                  )}

                  {/* Matched Customer */}
                  {selectedPull.matchedCustomer && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Matched Customer</p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {selectedPull.matchedCustomer.firstName} {selectedPull.matchedCustomer.lastName}
                        {selectedPull.matchedAgencyzoomId && ` (AZ#${selectedPull.matchedAgencyzoomId})`}
                      </p>
                    </div>
                  )}

                  {/* Vehicles */}
                  {selectedPull.vehicles && selectedPull.vehicles.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Vehicles</p>
                      <div className="space-y-1">
                        {selectedPull.vehicles.map((v: any, i: number) => (
                          <p key={i} className="text-sm text-gray-600 dark:text-gray-400">
                            {v.year} {v.make} {v.model}
                            {v.vin && <span className="text-xs ml-2">VIN: {v.vin}</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drivers */}
                  {selectedPull.drivers && selectedPull.drivers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Drivers</p>
                      <div className="space-y-1">
                        {selectedPull.drivers.map((d: any, i: number) => (
                          <p key={i} className="text-sm text-gray-600 dark:text-gray-400">
                            {d.first_name} {d.last_name}
                            {d.date_of_birth && <span className="text-xs ml-2">DOB: {d.date_of_birth}</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  {selectedPull.matchStatus === 'pending' && (
                    <button
                      onClick={() => setShowMatchModal(true)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Match to Customer
                    </button>
                  )}

                  {selectedPull.matchStatus === 'matched' && !selectedPull.agencyzoomNoteSynced && (
                    <button
                      onClick={handleSyncNote}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Sync to AgencyZoom
                    </button>
                  )}

                  {selectedPull.agencyzoomNoteSynced && (
                    <div className="text-center text-sm text-green-600 dark:text-green-400 py-2">
                      Synced to AgencyZoom
                    </div>
                  )}

                  {/* AgencyZoom Link for matched customers */}
                  {selectedPull.matchedAgencyzoomId && (
                    <AgencyZoomButton
                      href={getAgencyZoomUrl(selectedPull.matchedAgencyzoomId, 'customer')}
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                    />
                  )}

                  {selectedPull.matchStatus !== 'ignored' && selectedPull.matchStatus !== 'created' && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/canopy-connect/${selectedPull.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ matchStatus: 'ignored' }),
                        });
                        await fetchPulls();
                        setSelectedPull(null);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Ignore
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Send Link Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Send Canopy Link
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Send a link to the customer to import their policy data.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={sendForm.phone}
                  onChange={(e) => setSendForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={sendForm.email}
                  onChange={(e) => setSendForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">First Name</label>
                  <input
                    type="text"
                    placeholder="John"
                    value={sendForm.firstName}
                    onChange={(e) => setSendForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    placeholder="Doe"
                    value={sendForm.lastName}
                    onChange={(e) => setSendForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white text-gray-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSendLink}
                disabled={sending || (!sendForm.phone && !sendForm.email)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Customer Modal */}
      {showMatchModal && selectedPull && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Match to Customer
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Search for an existing customer to match this import.
            </p>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, phone, email..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  searchCustomers(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white text-gray-900"
              />
            </div>

            <div className="max-h-64 overflow-auto">
              {searchingCustomers ? (
                <div className="text-center py-4 text-gray-500">Searching...</div>
              ) : customerResults.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  {customerSearch ? 'No customers found' : 'Type to search'}
                </div>
              ) : (
                <div className="space-y-2">
                  {customerResults.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleMatch(customer.id)}
                      className="w-full p-3 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {customer.phone || customer.email || 'No contact info'}
                        {customer.agencyzoomId && ` | AZ#${customer.agencyzoomId}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMatchModal(false);
                  setCustomerSearch('');
                  setCustomerResults([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

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
  color: 'gray' | 'blue' | 'green' | 'yellow';
  onClick: () => void;
}) {
  const colors = {
    gray: active ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800',
    blue: active ? 'bg-blue-200 dark:bg-blue-800' : 'bg-blue-100 dark:bg-blue-900/30',
    green: active ? 'bg-green-200 dark:bg-green-800' : 'bg-green-100 dark:bg-green-900/30',
    yellow: active ? 'bg-yellow-200 dark:bg-yellow-800' : 'bg-yellow-100 dark:bg-yellow-900/30',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors text-gray-900 dark:text-gray-100 ${colors[color]} ${
        active ? 'ring-2 ring-offset-2 ring-blue-500' : ''
      }`}
    >
      {label}: {count}
    </button>
  );
}

function PullCard({
  pull,
  isSelected,
  onSelect,
  formatCurrency,
}: {
  pull: CanopyPull;
  isSelected: boolean;
  onSelect: () => void;
  formatCurrency: (cents: number | null) => string;
}) {
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    matched: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    created: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    needs_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    ignored: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500',
  };

  const pullStatusColors: Record<string, string> = {
    SUCCESS: 'text-green-600',
    PENDING: 'text-yellow-600',
    FAILED: 'text-red-600',
    EXPIRED: 'text-gray-600',
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-4 transition-all cursor-pointer hover:shadow-md ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[pull.matchStatus] || statusColors.pending}`}>
            {pull.matchStatus.replace('_', ' ')}
          </span>
          {pull.pullStatus && (
            <span className={`text-xs ${pullStatusColors[pull.pullStatus] || 'text-gray-500'}`}>
              {pull.pullStatus}
            </span>
          )}
        </div>
        {pull.agencyzoomNoteSynced && (
          <span className="text-xs text-green-600">Synced</span>
        )}
      </div>

      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
        {pull.firstName || ''} {pull.lastName || 'Unknown'}
      </h3>

      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {pull.phone || pull.email || 'No contact info'}
      </div>

      {pull.carrierFriendlyName && (
        <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          {pull.carrierFriendlyName}
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
        {pull.policyCount !== null && pull.policyCount > 0 && (
          <span>{pull.policyCount} {pull.policyCount === 1 ? 'policy' : 'policies'}</span>
        )}
        {pull.vehicleCount !== null && pull.vehicleCount > 0 && (
          <span>{pull.vehicleCount} {pull.vehicleCount === 1 ? 'vehicle' : 'vehicles'}</span>
        )}
        {pull.totalPremiumCents !== null && pull.totalPremiumCents > 0 && (
          <span>{formatCurrency(pull.totalPremiumCents)}</span>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {pull.pulledAt
          ? new Date(pull.pulledAt).toLocaleDateString()
          : new Date(pull.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 font-medium">{value}</span>
    </div>
  );
}
