'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import type { TriageItem, Employee } from '@/app/api/service-pipeline/route';
import {
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  SERVICE_PIPELINES,
  SERVICE_TICKET_DEFAULTS,
} from '@/lib/api/agencyzoom-service-tickets';

// Category options for dropdown
const CATEGORY_OPTIONS = [
  { id: SERVICE_CATEGORIES.GENERAL_SERVICE, name: 'General Service', group: 'General' },
  { id: SERVICE_CATEGORIES.SERVICE_QUESTION, name: 'Service Question', group: 'General' },
  // Claims
  { id: SERVICE_CATEGORIES.CLAIMS_FILED, name: 'Claims - Filed', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_NOT_FILED, name: 'Claims - Not Filed', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_STATUS, name: 'Claims - Status', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_PAYMENT, name: 'Claims - Payment', group: 'Claims' },
  { id: SERVICE_CATEGORIES.CLAIMS_CONSULT, name: 'Claims - Consult', group: 'Claims' },
  // Policy Changes
  { id: SERVICE_CATEGORIES.SERVICE_DRIVER, name: '+/- Driver', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_VEHICLE, name: '+/- Vehicle', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_PROPERTY, name: '+/- Property', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_INSURED, name: '+/- Insured', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_LIENHOLDER, name: '+/- Lienholder', group: 'Policy Changes' },
  { id: SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE, name: 'Coverage Change', group: 'Policy Changes' },
  // Billing
  { id: SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS, name: 'Billing Question', group: 'Billing' },
  { id: SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS, name: 'Billing Payment', group: 'Billing' },
  { id: SERVICE_CATEGORIES.SERVICE_BILLING_CHANGES, name: 'Billing Changes', group: 'Billing' },
  // Documents
  { id: SERVICE_CATEGORIES.SERVICE_ID_CARDS, name: 'ID Cards', group: 'Documents' },
  { id: SERVICE_CATEGORIES.SERVICE_COI, name: 'Certificate of Insurance', group: 'Documents' },
  { id: SERVICE_CATEGORIES.SERVICE_LOSS_RUN, name: 'Loss Run', group: 'Documents' },
  // Other
  { id: SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING, name: 'Client Cancelling', group: 'Other' },
  { id: SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION, name: 'Pending Cancellation', group: 'Other' },
  { id: SERVICE_CATEGORIES.SERVICE_CARRIER_REQUEST, name: 'Carrier Request', group: 'Other' },
  { id: SERVICE_CATEGORIES.SERVICE_REMARKET, name: 'Remarket', group: 'Other' },
  { id: SERVICE_CATEGORIES.QUOTE_REQUEST, name: 'Quote Request', group: 'Other' },
];

// Priority options
const PRIORITY_OPTIONS = [
  { id: SERVICE_PRIORITIES.STANDARD, name: 'Standard' },
  { id: SERVICE_PRIORITIES.TWO_HOUR, name: '2 Hour' },
  { id: SERVICE_PRIORITIES.URGENT, name: 'Urgent' },
];

// Stage options for Policy Service pipeline
const STAGE_OPTIONS = [
  { id: 111160, name: 'New' },
  { id: 111161, name: 'In Progress' },
  { id: 111162, name: 'Waiting on Info' },
];

interface CreateServiceTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ticketData: ServiceTicketFormData) => Promise<void>;
  triageItem: TriageItem;
  targetStageId: number;
  employees: Employee[];
  isLoading?: boolean;
}

export interface ServiceTicketFormData {
  subject: string;
  customerId: number | null;
  customerName: string;
  categoryId: number;
  priorityId: number;
  assigneeId: number;
  stageId: number;
  dueDate: string;
  description: string;
}

export default function CreateServiceTicketModal({
  isOpen,
  onClose,
  onSubmit,
  triageItem,
  targetStageId,
  employees,
  isLoading = false,
}: CreateServiceTicketModalProps) {
  // Form state
  const [subject, setSubject] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [categoryId, setCategoryId] = useState<number>(SERVICE_TICKET_DEFAULTS.CATEGORY_ID);
  const [priorityId, setPriorityId] = useState<number>(SERVICE_TICKET_DEFAULTS.PRIORITY_ID);
  const [assigneeId, setAssigneeId] = useState<number>(SERVICE_TICKET_DEFAULTS.DEFAULT_CSR);
  const [stageId, setStageId] = useState(targetStageId);
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');

  // Initialize form from triage item
  useEffect(() => {
    if (isOpen && triageItem) {
      // Pre-fill subject from summary
      const contactName = triageItem.contactName || 'Unknown';
      const summaryPreview = triageItem.summary?.substring(0, 100) || 'Service request';
      setSubject(`${contactName}: ${summaryPreview}`);

      // Pre-fill description
      setDescription(triageItem.summary || '');

      // Pre-fill customer if matched
      if (triageItem.agencyzoomCustomerId) {
        setCustomerId(parseInt(triageItem.agencyzoomCustomerId));
        setCustomerName(triageItem.contactName || 'Matched Customer');
        setCustomerSearch(triageItem.contactName || '');
      } else if (triageItem.agencyzoomLeadId) {
        setCustomerId(parseInt(triageItem.agencyzoomLeadId));
        setCustomerName(triageItem.contactName || 'Matched Lead');
        setCustomerSearch(triageItem.contactName || '');
      } else {
        setCustomerId(null);
        setCustomerName('');
        setCustomerSearch(triageItem.contactName || triageItem.contactPhone || '');
      }

      // Set target stage
      setStageId(targetStageId);

      // Infer category from request type
      if (triageItem.requestType) {
        const rt = triageItem.requestType.toLowerCase();
        if (rt.includes('claim')) setCategoryId(SERVICE_CATEGORIES.CLAIMS_NOT_FILED);
        else if (rt.includes('billing') || rt.includes('payment')) setCategoryId(SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS);
        else if (rt.includes('cancel')) setCategoryId(SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING);
        else if (rt.includes('quote')) setCategoryId(SERVICE_CATEGORIES.QUOTE_REQUEST);
        else if (rt.includes('driver')) setCategoryId(SERVICE_CATEGORIES.SERVICE_DRIVER);
        else if (rt.includes('vehicle')) setCategoryId(SERVICE_CATEGORIES.SERVICE_VEHICLE);
        else if (rt.includes('id card')) setCategoryId(SERVICE_CATEGORIES.SERVICE_ID_CARDS);
      }
    }
  }, [isOpen, triageItem, targetStageId]);

  // Search for customers
  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.customers || []);
      }
    } catch (error) {
      console.error('Customer search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle customer search input change
  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setShowCustomerDropdown(true);
    searchCustomers(value);
  };

  // Handle customer selection
  const handleCustomerSelect = (customer: any) => {
    setCustomerId(customer.agencyzoomId ? parseInt(customer.agencyzoomId) : null);
    setCustomerName(`${customer.firstName || ''} ${customer.lastName || ''}`.trim());
    setCustomerSearch(`${customer.firstName || ''} ${customer.lastName || ''}`.trim());
    setShowCustomerDropdown(false);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      alert('Subject is required');
      return;
    }

    if (!customerId) {
      alert('Please select a customer');
      return;
    }

    if (!assigneeId) {
      alert('Please select an assignee');
      return;
    }

    await onSubmit({
      subject: subject.trim(),
      customerId,
      customerName,
      categoryId,
      priorityId,
      assigneeId,
      stageId,
      dueDate,
      description: description.trim(),
    });
  };

  if (!isOpen) return null;

  const isNCM = !triageItem.agencyzoomCustomerId && !triageItem.agencyzoomLeadId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-indigo-600 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">Add a Service Request</h2>
          <p className="text-sm text-blue-100">Create a service ticket from this triage item</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* NCM Warning */}
            {isNCM && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium">No Customer Match</span>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                  Please search and select the correct customer before creating the ticket.
                </p>
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
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    'w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    customerId
                      ? 'border-green-500 dark:border-green-600'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                  placeholder="Search by name or phone..."
                />
                {customerId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showCustomerDropdown && (customerSearch.length >= 2 || searchResults.length > 0) && (
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
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
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
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Row: Pipeline + Stage (locked) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pipeline
                </label>
                <div className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 flex items-center justify-between">
                  <span>Policy Service Pipeline</span>
                  <span className="text-xs">🔒</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stage
                </label>
                <div className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 flex items-center justify-between">
                  <span>{STAGE_OPTIONS.find(s => s.id === stageId)?.name || 'New'}</span>
                  <span className="text-xs">🔒</span>
                </div>
              </div>
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
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(
                    CATEGORY_OPTIONS.reduce((groups, cat) => {
                      if (!groups[cat.group]) groups[cat.group] = [];
                      groups[cat.group].push(cat);
                      return groups;
                    }, {} as Record<string, typeof CATEGORY_OPTIONS>)
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
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row: Assigned To + Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assigned To <span className="text-red-500">*</span>
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Full description or transcript..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !customerId || !assigneeId}
              className={cn(
                'px-6 py-2 rounded-lg font-medium text-white transition-colors',
                isLoading || !customerId || !assigneeId
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {isLoading ? (
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
