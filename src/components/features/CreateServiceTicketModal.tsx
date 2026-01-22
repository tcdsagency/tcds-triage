'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import type { TriageItem, Employee } from '@/app/api/service-pipeline/route';
import {
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  SERVICE_PIPELINES,
  SERVICE_TICKET_DEFAULTS,
} from '@/lib/api/agencyzoom-service-tickets';

// =============================================================================
// TYPES
// =============================================================================

interface CustomerResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  agencyzoomId: string | null;
  isLead: boolean;
  policyCount?: number;
  // Confidence scoring
  confidence?: number;
  matchType?: 'phone' | 'name' | 'email' | 'partial';
}

interface TrestleLookupResult {
  success: boolean;
  owner?: {
    name: string;
    firstName?: string;
    lastName?: string;
  };
  contact?: {
    currentAddress?: {
      city: string;
      state: string;
    };
    emails?: string[];
  };
  overview?: {
    lineType: string;
    carrier: string;
    isSpam?: boolean;
  };
  verification?: {
    spamScore?: number;
    isSpam?: boolean;
  };
}

// Category options for dropdown
const CATEGORY_OPTIONS = [
  { id: SERVICE_CATEGORIES.GENERAL_SERVICE, name: 'General Service', group: 'General' },
  { id: SERVICE_CATEGORIES.SERVICE_QUESTION, name: 'Service Question', group: 'General' },
  { id: SERVICE_CATEGORIES.WRONG_NUMBER_HANGUP, name: 'Wrong Number / Caller Hangup', group: 'General' },
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

// =============================================================================
// AI PREFILL: Category Detection Keywords
// =============================================================================

const CATEGORY_KEYWORDS: { category: number; keywords: string[] }[] = [
  // Quote/New Business
  { category: SERVICE_CATEGORIES.QUOTE_REQUEST, keywords: ['quote', 'price', 'cost', 'rate', 'bundle', 'new policy', 'shopping', 'looking for'] },
  // Claims
  { category: SERVICE_CATEGORIES.CLAIMS_NOT_FILED, keywords: ['accident', 'crash', 'collision', 'hit', 'damage', 'totaled', 'theft', 'stolen', 'vandal'] },
  { category: SERVICE_CATEGORIES.CLAIMS_STATUS, keywords: ['claim status', 'claim question', 'filed claim', 'my claim', 'claim update'] },
  { category: SERVICE_CATEGORIES.CLAIMS_PAYMENT, keywords: ['claim payment', 'claim check', 'settlement'] },
  // Cancellation
  { category: SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING, keywords: ['cancel', 'cancellation', 'stop', 'end policy', 'terminate', 'not renewing'] },
  { category: SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION, keywords: ['pending cancel', 'about to cancel', 'cancellation notice', 'reinstate'] },
  // Billing
  { category: SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS, keywords: ['payment', 'pay', 'paid', 'autopay', 'bank draft'] },
  { category: SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS, keywords: ['bill', 'invoice', 'charge', 'billing question', 'why did my'] },
  { category: SERVICE_CATEGORIES.SERVICE_BILLING_CHANGES, keywords: ['billing change', 'payment method', 'due date change'] },
  // Policy Changes - Vehicles/Drivers
  { category: SERVICE_CATEGORIES.SERVICE_VEHICLE, keywords: ['add vehicle', 'remove vehicle', 'new car', 'sold car', 'bought a', 'traded', 'replace vehicle'] },
  { category: SERVICE_CATEGORIES.SERVICE_DRIVER, keywords: ['add driver', 'remove driver', 'new driver', 'exclude driver', 'licensed', 'teenager'] },
  { category: SERVICE_CATEGORIES.SERVICE_INSURED, keywords: ['add insured', 'remove insured', 'name change', 'married', 'divorced', 'spouse'] },
  { category: SERVICE_CATEGORIES.SERVICE_PROPERTY, keywords: ['add property', 'remove property', 'new home', 'sold home', 'rental property', 'address change', 'moved'] },
  { category: SERVICE_CATEGORIES.SERVICE_LIENHOLDER, keywords: ['lien holder', 'lienholder', 'finance company', 'bank', 'loan', 'payoff', 'paid off'] },
  { category: SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE, keywords: ['coverage', 'deductible', 'limit', 'increase coverage', 'decrease coverage', 'endorsement'] },
  // Documents
  { category: SERVICE_CATEGORIES.SERVICE_ID_CARDS, keywords: ['id card', 'insurance card', 'proof of insurance', 'print card'] },
  { category: SERVICE_CATEGORIES.SERVICE_COI, keywords: ['certificate', 'cert', 'coi', 'proof', 'additional insured', 'acord'] },
  { category: SERVICE_CATEGORIES.SERVICE_LOSS_RUN, keywords: ['loss run', 'loss history', 'claims history', 'claim report'] },
  // Other
  { category: SERVICE_CATEGORIES.WRONG_NUMBER_HANGUP, keywords: ['wrong number', 'hangup', 'hung up', 'disconnected', 'dropped call', 'no response'] },
  { category: SERVICE_CATEGORIES.SERVICE_CARRIER_REQUEST, keywords: ['carrier request', 'underwriting', 'inspection'] },
  { category: SERVICE_CATEGORIES.SERVICE_REMARKET, keywords: ['remarket', 'shop', 'better rate', 'too expensive', 'non-renew'] },
  { category: SERVICE_CATEGORIES.SERVICE_QUESTION, keywords: ['question', 'does my policy', 'what does', 'covered', 'explain'] },
];

/**
 * AI Prefill: Detect category from text using keyword matching
 */
function detectCategoryFromText(text: string): number | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return category;
      }
    }
  }
  return null;
}

// =============================================================================
// AI PREFILL: Priority Detection
// =============================================================================

const HIGH_PRIORITY_KEYWORDS = ['urgent', 'emergency', 'asap', 'immediately', 'right now', 'accident', 'crash', 'critical'];
const MEDIUM_PRIORITY_KEYWORDS = ['soon', 'this week', 'when you can', 'at your earliest'];

/**
 * AI Prefill: Detect priority from urgency field and text keywords
 */
function detectPriority(urgency: string | null | undefined, text: string): number {
  // First check urgency field from AI extraction
  if (urgency) {
    const u = urgency.toLowerCase();
    if (u === 'urgent' || u === 'high') return SERVICE_PRIORITIES.URGENT;
    if (u === 'medium') return SERVICE_PRIORITIES.TWO_HOUR;
  }

  // Then check text for keywords
  if (text) {
    const lowerText = text.toLowerCase();
    for (const keyword of HIGH_PRIORITY_KEYWORDS) {
      if (lowerText.includes(keyword)) return SERVICE_PRIORITIES.URGENT;
    }
    for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
      if (lowerText.includes(keyword)) return SERVICE_PRIORITIES.TWO_HOUR;
    }
  }

  return SERVICE_PRIORITIES.STANDARD;
}

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
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([]);
  const [phoneMatches, setPhoneMatches] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [categoryId, setCategoryId] = useState<number>(SERVICE_TICKET_DEFAULTS.CATEGORY_ID);
  const [priorityId, setPriorityId] = useState<number>(SERVICE_TICKET_DEFAULTS.PRIORITY_ID);
  const [assigneeId, setAssigneeId] = useState<number>(SERVICE_TICKET_DEFAULTS.DEFAULT_CSR);
  const [stageId, setStageId] = useState(targetStageId);
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');

  // Trestle lookup state
  const [trestleResult, setTrestleResult] = useState<TrestleLookupResult | null>(null);
  const [isTrestleLoading, setIsTrestleLoading] = useState(false);
  const [showTrestlePopover, setShowTrestlePopover] = useState(false);
  const trestleHoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const trestleButtonRef = useRef<HTMLButtonElement>(null);

  // Get normalized caller phone
  const callerPhone = triageItem?.contactPhone?.replace(/\D/g, '').slice(-10) || '';
  const formattedCallerPhone = callerPhone.length === 10
    ? `(${callerPhone.slice(0, 3)}) ${callerPhone.slice(3, 6)}-${callerPhone.slice(6)}`
    : triageItem?.contactPhone || '';

  // ==========================================================================
  // PHONE-FIRST CUSTOMER SEARCH
  // ==========================================================================

  const searchByPhone = useCallback(async (phone: string): Promise<CustomerResult[]> => {
    if (phone.length < 10) return [];

    try {
      const res = await fetch(`/api/customers/search?phone=${encodeURIComponent(phone)}&limit=5`);
      const data = await res.json();
      if (data.success && data.results) {
        return data.results.map((c: any) => ({
          ...c,
          confidence: 95, // Phone match = high confidence
          matchType: 'phone' as const,
        }));
      }
    } catch (error) {
      console.error('Phone search error:', error);
    }
    return [];
  }, []);

  // ==========================================================================
  // TRESTLE LOOKUP
  // ==========================================================================

  const lookupTrestle = useCallback(async (phone: string) => {
    if (!phone || phone.length < 10 || isTrestleLoading) return;

    setIsTrestleLoading(true);
    try {
      const res = await fetch('/api/trestle/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setTrestleResult(data);
      setShowTrestlePopover(true);
    } catch (error) {
      console.error('Trestle lookup error:', error);
      setTrestleResult({ success: false });
    } finally {
      setIsTrestleLoading(false);
    }
  }, [isTrestleLoading]);

  // Handle hover on Trestle button - auto-trigger lookup after 500ms
  const handleTrestleHoverStart = () => {
    if (trestleResult) {
      // Already have results, just show popover
      setShowTrestlePopover(true);
      return;
    }
    trestleHoverTimeout.current = setTimeout(() => {
      lookupTrestle(callerPhone);
    }, 500);
  };

  const handleTrestleHoverEnd = () => {
    if (trestleHoverTimeout.current) {
      clearTimeout(trestleHoverTimeout.current);
      trestleHoverTimeout.current = null;
    }
    // Delay hiding popover to allow clicking on it
    setTimeout(() => setShowTrestlePopover(false), 200);
  };

  // Search using Trestle name
  const searchWithTrestleName = () => {
    if (trestleResult?.owner?.name) {
      setCustomerSearch(trestleResult.owner.name);
      setShowCustomerDropdown(true);
      searchCustomers(trestleResult.owner.name);
      setShowTrestlePopover(false);
    }
  };

  // Initialize form from triage item with AI prefill
  useEffect(() => {
    if (isOpen && triageItem) {
      // =========================================================================
      // AI PREFILL: Extract contact name and generate summary
      // =========================================================================
      const contactName = triageItem.contactName || 'Unknown';
      const summaryText = triageItem.summary || 'Service request';

      // Generate subject: "ContactName: Summary preview"
      const summaryPreview = summaryText.length > 100 ? summaryText.substring(0, 100) + '...' : summaryText;
      setSubject(`${contactName}: ${summaryPreview}`);

      // Pre-fill description with full summary
      setDescription(summaryText);

      // =========================================================================
      // AI PREFILL: Customer matching - PHONE FIRST
      // =========================================================================
      // Reset Trestle state for new modal
      setTrestleResult(null);
      setShowTrestlePopover(false);
      setPhoneMatches([]);

      if (triageItem.agencyzoomCustomerId) {
        // Already matched - use that
        setCustomerId(parseInt(triageItem.agencyzoomCustomerId));
        setCustomerName(triageItem.contactName || 'Matched Customer');
        setCustomerSearch(triageItem.contactName || '');
      } else if (triageItem.agencyzoomLeadId) {
        // Lead match - use that
        setCustomerId(parseInt(triageItem.agencyzoomLeadId));
        setCustomerName(triageItem.contactName || 'Matched Lead');
        setCustomerSearch(triageItem.contactName || '');
      } else {
        // No match - do phone-first search
        setCustomerId(null);
        setCustomerName('');
        setCustomerSearch('');

        // Immediately search by phone number
        const phone = triageItem.contactPhone?.replace(/\D/g, '').slice(-10) || '';
        if (phone.length === 10) {
          searchByPhone(phone).then((results) => {
            setPhoneMatches(results);
            // Auto-select if only one high-confidence match
            if (results.length === 1 && results[0].confidence && results[0].confidence >= 95) {
              const match = results[0];
              if (match.agencyzoomId) {
                setCustomerId(parseInt(match.agencyzoomId));
                setCustomerName(`${match.firstName || ''} ${match.lastName || ''}`.trim());
                setCustomerSearch(`${match.firstName || ''} ${match.lastName || ''}`.trim());
              }
            }
          });
        }
      }

      // Set target stage from drag destination
      setStageId(targetStageId);

      // =========================================================================
      // AI PREFILL: Category detection
      // =========================================================================
      // Combine all text sources for analysis: requestType, summary
      const analysisText = [
        triageItem.requestType,
        triageItem.summary,
      ].filter(Boolean).join(' ');

      // Try to detect category from the combined text
      const detectedCategory = detectCategoryFromText(analysisText);
      if (detectedCategory) {
        setCategoryId(detectedCategory);
      } else {
        // Fall back to request type based mapping (legacy)
        if (triageItem.requestType) {
          const rt = triageItem.requestType.toLowerCase();
          if (rt.includes('claim')) setCategoryId(SERVICE_CATEGORIES.CLAIMS_NOT_FILED);
          else if (rt.includes('billing') || rt.includes('payment')) setCategoryId(SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS);
          else if (rt.includes('cancel')) setCategoryId(SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING);
          else if (rt.includes('quote')) setCategoryId(SERVICE_CATEGORIES.QUOTE_REQUEST);
          else if (rt.includes('driver')) setCategoryId(SERVICE_CATEGORIES.SERVICE_DRIVER);
          else if (rt.includes('vehicle')) setCategoryId(SERVICE_CATEGORIES.SERVICE_VEHICLE);
          else if (rt.includes('id card')) setCategoryId(SERVICE_CATEGORIES.SERVICE_ID_CARDS);
          else setCategoryId(SERVICE_TICKET_DEFAULTS.CATEGORY_ID);
        } else {
          setCategoryId(SERVICE_TICKET_DEFAULTS.CATEGORY_ID);
        }
      }

      // =========================================================================
      // AI PREFILL: Priority detection from urgency and text
      // =========================================================================
      // Extract urgency from AI extraction if available
      const aiExtraction = (triageItem as any).aiExtraction;
      const urgency = aiExtraction?.urgency || null;
      const detectedPriority = detectPriority(urgency, analysisText);
      setPriorityId(detectedPriority);

      // Reset assignee to default
      setAssigneeId(SERVICE_TICKET_DEFAULTS.DEFAULT_CSR);

      // Reset due date to tomorrow
      setDueDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    }
  }, [isOpen, triageItem, targetStageId, searchByPhone]);

  // Search for customers with confidence scoring
  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      if (data.success && data.results) {
        // Add confidence scoring based on match type
        const scored = data.results.map((c: any) => {
          let confidence = 50;
          let matchType: 'name' | 'email' | 'partial' = 'partial';

          const queryLower = query.toLowerCase();
          const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().trim();

          if (fullName === queryLower) {
            confidence = 85;
            matchType = 'name';
          } else if (c.email?.toLowerCase() === queryLower) {
            confidence = 80;
            matchType = 'email';
          } else if (fullName.includes(queryLower) || queryLower.includes(fullName.split(' ')[0])) {
            confidence = 60;
            matchType = 'name';
          }

          return { ...c, confidence, matchType };
        });
        setSearchResults(scored);
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Add a Service Request</h2>
              <p className="text-sm text-blue-100">Create a service ticket from this triage item</p>
            </div>
            {/* Caller Phone Badge */}
            {formattedCallerPhone && (
              <div className="flex items-center gap-2">
                <span className="text-blue-100 text-sm">📞</span>
                <span className="text-white font-medium">{formattedCallerPhone}</span>
                {customerId && (
                  <span className="px-2 py-0.5 bg-green-500/30 text-green-100 text-xs font-medium rounded-full">
                    Phone Matched ✓
                  </span>
                )}
              </div>
            )}
          </div>
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

            {/* Phone Matches Section (shown when we have phone matches) */}
            {phoneMatches.length > 0 && !customerId && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                  <span>📞</span> Phone Number Matches
                </div>
                <div className="space-y-2">
                  {phoneMatches.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleCustomerSelect(customer)}
                      className="w-full p-3 text-left bg-white dark:bg-gray-800 rounded-lg border border-green-300 dark:border-green-700 hover:border-green-500 dark:hover:border-green-500 transition-colors flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {(customer.firstName?.[0] || '?')}{(customer.lastName?.[0] || '')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {customer.firstName} {customer.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {customer.phone} • {customer.email || 'No email'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                          {customer.confidence}% • Phone
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Search */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer <span className="text-red-500">*</span>
                </label>
                {/* Trestle Lookup Button */}
                {!customerId && callerPhone && (
                  <div className="relative">
                    <button
                      ref={trestleButtonRef}
                      type="button"
                      onClick={() => lookupTrestle(callerPhone)}
                      onMouseEnter={handleTrestleHoverStart}
                      onMouseLeave={handleTrestleHoverEnd}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1',
                        isTrestleLoading
                          ? 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                          : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                      )}
                      disabled={isTrestleLoading}
                    >
                      {isTrestleLoading ? (
                        <>
                          <span className="animate-spin">⏳</span> Looking up...
                        </>
                      ) : (
                        <>
                          <span>🔍</span> Lookup Caller
                        </>
                      )}
                    </button>

                    {/* Trestle Popover */}
                    {showTrestlePopover && trestleResult && (
                      <div
                        className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 p-4"
                        onMouseEnter={() => setShowTrestlePopover(true)}
                        onMouseLeave={() => setShowTrestlePopover(false)}
                      >
                        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <span>🔍</span> Trestle Caller Info
                        </div>
                        {trestleResult.success && trestleResult.owner ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Name:</span>
                              <span className="font-medium text-gray-900 dark:text-white">{trestleResult.owner.name}</span>
                            </div>
                            {trestleResult.overview?.lineType && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Phone Type:</span>
                                <span className="text-gray-900 dark:text-white capitalize">{trestleResult.overview.lineType}</span>
                              </div>
                            )}
                            {trestleResult.overview?.carrier && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Carrier:</span>
                                <span className="text-gray-900 dark:text-white">{trestleResult.overview.carrier}</span>
                              </div>
                            )}
                            {trestleResult.contact?.currentAddress && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Location:</span>
                                <span className="text-gray-900 dark:text-white">
                                  {trestleResult.contact.currentAddress.city}, {trestleResult.contact.currentAddress.state}
                                </span>
                              </div>
                            )}
                            {trestleResult.contact?.emails?.[0] && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Email:</span>
                                <span className="text-gray-900 dark:text-white truncate max-w-[150px]">{trestleResult.contact.emails[0]}</span>
                              </div>
                            )}
                            {trestleResult.verification?.isSpam && (
                              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400 text-xs">
                                ⚠️ Potential spam caller
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={searchWithTrestleName}
                              className="w-full mt-3 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              Search for "{trestleResult.owner.name}"
                            </button>
                          </div>
                        ) : (
                          <div className="text-gray-500 dark:text-gray-400 text-sm">
                            No caller information found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                        {/* Confidence Badge */}
                        {customer.confidence && (
                          <span className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full',
                            customer.confidence >= 85
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                              : customer.confidence >= 60
                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          )}>
                            {customer.confidence}%
                          </span>
                        )}
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
