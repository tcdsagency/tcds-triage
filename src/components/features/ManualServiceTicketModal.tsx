'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import type { Employee } from '@/app/api/service-pipeline/route';
import {
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  SERVICE_PIPELINES,
  SERVICE_TICKET_DEFAULTS,
} from '@/lib/api/agencyzoom-service-tickets';

interface CustomerResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  agencyzoomId: string | null;
  isLead: boolean;
}

interface ServiceTicketOptions {
  categories: Array<{ id: number; name: string; group?: string }>;
  priorities: Array<{ id: number; name: string }>;
  pipelines: Array<{
    id: number;
    name: string;
    stages: Array<{ id: number; name: string }>;
  }>;
  employees: Array<{ id: number; name: string; initials: string }>;
}

// Fallback options
const FALLBACK_CATEGORIES = [
  { id: SERVICE_CATEGORIES.GENERAL_SERVICE, name: 'General Service', group: 'General' },
  { id: SERVICE_CATEGORIES.SERVICE_QUESTION, name: 'Service Question', group: 'General' },
  { id: SERVICE_CATEGORIES.WRONG_NUMBER_HANGUP, name: 'Wrong Number / Caller Hangup', group: 'General' },
  { id: SERVICE_CATEGORIES.CLAIMS_FILED, name: 'Claims - Filed', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_NOT_FILED, name: 'Claims - Not Filed', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_STATUS, name: 'Claims - Status', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_PAYMENT, name: 'Claims - Payment', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_CONSULT, name: 'Claims - Consult', group: 'Claims' },
  { id: SERVICE_CATEGORIES.SERVICE_DRIVER, name: '+/- Driver', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_VEHICLE, name: '+/- Vehicle', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_PROPERTY, name: '+/- Property', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_INSURED, name: '+/- Insured', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_LIENHOLDER, name: '+/- Lienholder', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE, name: 'Coverage Change', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS, name: 'Billing Question', group: 'Billing' },
  { id: SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS, name: 'Billing Payment', group: 'Billing' },
  { id: SERVICE_CATEGORIES.SERVICE_BILLING_CHANGES, name: 'Billing Changes', group: 'Billing' },
  { id: SERVICE_CATEGORIES.SERVICE_ID_CARDS, name: 'ID Cards', group: 'Documents' },
  { id: SERVICE_CATEGORIES.SERVICE_COI, name: 'Certificate of Insurance', group: 'Documents' },
  { id: SERVICE_CATEGORIES.SERVICE_LOSS_RUN, name: 'Loss Run', group: 'Documents' },
  { id: SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING, name: 'Client Cancelling', group: 'Other' },
  { id: SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION, name: 'Pending Cancellation', group: 'Other' },
  { id: SERVICE_CATEGORIES.SERVICE_CARRIER_REQUEST, name: 'Carrier Request', group: 'Other' },
  { id: SERVICE_CATEGORIES.SERVICE_REMARKET, name: 'Remarket', group: 'Other' },
  { id: SERVICE_CATEGORIES.QUOTE_REQUEST, name: 'Quote Request', group: 'Other' },
];

const FALLBACK_PRIORITIES = [
  { id: SERVICE_PRIORITIES.STANDARD, name: 'Standard' },
  { id: SERVICE_PRIORITIES.TWO_HOUR, name: '2 Hour' },
  { id: SERVICE_PRIORITIES.URGENT, name: 'Urgent' },
];

const FALLBACK_PIPELINES = [
  {
    id: SERVICE_PIPELINES.POLICY_SERVICE,
    name: 'Policy Service Pipeline',
    stages: [
      { id: 111160, name: 'New' },
      { id: 111161, name: 'In Progress' },
      { id: 111162, name: 'Waiting on Info' },
    ],
  },
];

interface ManualServiceTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: Employee[];
}

export default function ManualServiceTicketModal({
  isOpen,
  onClose,
  onSuccess,
  employees,
}: ManualServiceTicketModalProps) {
  const [subject, setSubject] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [categoryId, setCategoryId] = useState<number>(SERVICE_TICKET_DEFAULTS.CATEGORY_ID);
  const [priorityId, setPriorityId] = useState<number>(SERVICE_TICKET_DEFAULTS.PRIORITY_ID);
  const [assigneeId, setAssigneeId] = useState<number>(SERVICE_TICKET_DEFAULTS.DEFAULT_CSR);
  const [stageId, setStageId] = useState(111160); // New
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic options state
  const [options, setOptions] = useState<ServiceTicketOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Fetch options from API when modal opens
  useEffect(() => {
    if (isOpen && !options && !optionsLoading) {
      setOptionsLoading(true);
      fetch('/api/service-tickets/options')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.options) {
            setOptions(data.options);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch service ticket options:', err);
        })
        .finally(() => {
          setOptionsLoading(false);
        });
    }
  }, [isOpen, options, optionsLoading]);

  // Derive options from fetched data or fallbacks
  const categoryOptions = useMemo(() => {
    return options?.categories?.length ? options.categories : FALLBACK_CATEGORIES;
  }, [options]);

  const priorityOptions = useMemo(() => {
    return options?.priorities?.length ? options.priorities : FALLBACK_PRIORITIES;
  }, [options]);

  const stageOptions = useMemo(() => {
    const pipelines = options?.pipelines?.length ? options.pipelines : FALLBACK_PIPELINES;
    // Get stages from first pipeline (Policy Service)
    return pipelines[0]?.stages || FALLBACK_PIPELINES[0].stages;
  }, [options]);

  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (data.success && data.results) {
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error('Customer search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setShowCustomerDropdown(true);
    searchCustomers(value);
  };

  const handleCustomerSelect = (customer: CustomerResult) => {
    setCustomerId(customer.agencyzoomId ? parseInt(customer.agencyzoomId) : null);
    setCustomerName(`${customer.firstName || ''} ${customer.lastName || ''}`.trim());
    setCustomerSearch(`${customer.firstName || ''} ${customer.lastName || ''}`.trim());
    setShowCustomerDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!customerId) {
      setError('Please select a customer');
      return;
    }

    if (!assigneeId) {
      setError('Please select an assignee');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/service-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triageItemType: 'manual',
          subject: subject.trim(),
          customerId,
          customerName,
          categoryId,
          priorityId,
          assigneeId,
          stageId,
          dueDate,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create ticket');
      }

      // Reset form
      setSubject('');
      setCustomerId(null);
      setCustomerName('');
      setCustomerSearch('');
      setDescription('');
      setCategoryId(SERVICE_TICKET_DEFAULTS.CATEGORY_ID);
      setPriorityId(SERVICE_TICKET_DEFAULTS.PRIORITY_ID);
      setStageId(111160);
      setDueDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-500 to-emerald-600 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Create Service Request</h2>
              <p className="text-sm text-green-100">Create a new service ticket manually</p>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Summary <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Brief description of the request"
                required
              />
            </div>

            {/* Customer Search */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => handleCustomerSearchChange(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500',
                    customerId
                      ? 'border-green-500 dark:border-green-600'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                  placeholder="Search by name, phone, or email..."
                />
                {customerId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showCustomerDropdown && customerSearch.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
                      No customers found
                    </div>
                  ) : (
                    searchResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                          {(customer.firstName?.[0] || '?')}{(customer.lastName?.[0] || '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {customer.firstName} {customer.lastName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {customer.phone || customer.email || 'No contact info'}
                          </div>
                        </div>
                        {customer.isLead && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full">
                            Lead
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Row: Category + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {Object.entries(
                    categoryOptions.reduce((groups, cat) => {
                      const group = cat.group || 'General';
                      if (!groups[group]) groups[group] = [];
                      groups[group].push(cat);
                      return groups;
                    }, {} as Record<string, typeof categoryOptions>)
                  ).map(([group, cats]) => (
                    <optgroup key={group} label={group}>
                      {cats.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={priorityId}
                  onChange={(e) => setPriorityId(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {priorityOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row: Stage + Assigned To */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stage
                </label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {stageOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assigned To <span className="text-red-500">*</span>
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">Select assignee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                placeholder="Full description of the service request..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customerId || !assigneeId}
              className={cn(
                'px-6 py-2 rounded-lg font-medium text-white transition-colors',
                isSubmitting || !customerId || !assigneeId
                  ? 'bg-green-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Creating...
                </span>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
