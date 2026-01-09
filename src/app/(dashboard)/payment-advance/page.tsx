"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// =============================================================================
// TYPES
// =============================================================================

interface SearchResult {
  id: string;
  type: "customer" | "lead";
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hawksoftClientNumber?: string;
  agencyzoomId?: string;
  policyCount?: number;
  policyTypes?: string[];
}

interface CustomerPolicy {
  policyNumber: string;
  carrier: string;
  type: string;
  status?: string;
  expirationDate?: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  policyNumber: string;
  amount: string;
  paymentType: "card" | "checking";
  cardNumber: string;
  cardExp: string;
  cardCvv: string;
  cardZip: string;
  routingNumber: string;
  accountNumber: string;
  draftDate: string;
  submitterEmail: string;
  reason: string;
  reasonDetails: string;
}

interface PaymentAdvance {
  id: string;
  firstName: string;
  lastName: string;
  policyNumber: string;
  amount: number;
  processingFee: number;
  convenienceFee: number;
  totalAmount: number;
  paymentType: string;
  draftDate: string;
  submittedDate: string;
  status: string;
  processedAt: string | null;
  reason: string | null;
  submitterEmail: string | null;
  createdAt: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CONVENIENCE_FEE = 15;

const REASON_OPTIONS = [
  { value: "", label: "Select a reason..." },
  { value: "Hardship", label: "Hardship" },
  { value: "New policy issued/payment date match", label: "New policy issued/payment date match" },
  { value: "Other", label: "Other (please specify)" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function PaymentAdvancePage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchResult | null>(null);

  // Policy state
  const [policies, setPolicies] = useState<CustomerPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");
  const [manualPolicyEntry, setManualPolicyEntry] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    policyNumber: "",
    amount: "",
    paymentType: "card",
    cardNumber: "",
    cardExp: "",
    cardCvv: "",
    cardZip: "",
    routingNumber: "",
    accountNumber: "",
    draftDate: "",
    submitterEmail: "",
    reason: "",
    reasonDetails: "",
  });

  // Fee state
  const [waiveConvenienceFee, setWaiveConvenienceFee] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // History state
  const [advances, setAdvances] = useState<PaymentAdvance[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, processed: 0, failed: 0 });

  // Fetch current user email on mount to prefill submitterEmail
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.email) {
          setFormData(prev => ({
            ...prev,
            submitterEmail: prev.submitterEmail || data.user.email,
          }));
        }
      })
      .catch(() => {
        // Ignore errors - user can still manually enter email
      });
  }, []);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const todaysDate = new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const amount = parseFloat(formData.amount) || 0;

  const processingFee = formData.paymentType === "card"
    ? amount * 0.035  // 3.5% for cards
    : Math.min(amount * 0.01, 10); // 1% for ACH, max $10

  const convenienceFee = waiveConvenienceFee ? 0 : CONVENIENCE_FEE;

  const totalAmount = amount + processingFee + convenienceFee;

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/payment-advance/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  // ==========================================================================
  // CUSTOMER SELECTION
  // ==========================================================================

  const handleSelectCustomer = async (customer: SearchResult) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSearchQuery("");

    // Update form with customer info (prefill all available data)
    setFormData((prev) => ({
      ...prev,
      firstName: customer.firstName,
      lastName: customer.lastName,
      submitterEmail: prev.submitterEmail || "", // Don't overwrite if already set
    }));

    // Load policies - use local customer ID or HawkSoft client number
    if (customer.hawksoftClientNumber || customer.type === "customer") {
      setPoliciesLoading(true);
      try {
        const params = new URLSearchParams({
          customerId: customer.id,
          customerType: customer.type,
        });
        if (customer.hawksoftClientNumber) {
          params.set("hawksoftClientNumber", customer.hawksoftClientNumber);
        }
        if (customer.agencyzoomId) {
          params.set("agencyzoomId", customer.agencyzoomId);
        }

        const res = await fetch(`/api/payment-advance/customer/policies?${params}`);
        const data = await res.json();
        if (data.success) {
          setPolicies(data.policies);
        }
      } catch (error) {
        console.error("Policies error:", error);
      } finally {
        setPoliciesLoading(false);
      }
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setPolicies([]);
    setSelectedPolicy("");
    setManualPolicyEntry(false);
    setFormData((prev) => ({
      ...prev,
      firstName: "",
      lastName: "",
      policyNumber: "",
    }));
  };

  // ==========================================================================
  // POLICY SELECTION
  // ==========================================================================

  const handlePolicyChange = (value: string) => {
    if (value === "other") {
      setManualPolicyEntry(true);
      setSelectedPolicy("");
      setFormData((prev) => ({ ...prev, policyNumber: "" }));
    } else {
      setManualPolicyEntry(false);
      setSelectedPolicy(value);
      setFormData((prev) => ({ ...prev, policyNumber: value }));
    }
  };

  // ==========================================================================
  // FORM HANDLING
  // ==========================================================================

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Build payment info string (masked for security)
      let paymentInfo = "";
      if (formData.paymentType === "card") {
        const maskedCard = formData.cardNumber.slice(-4).padStart(formData.cardNumber.length, "X");
        paymentInfo = `Card: ${maskedCard}, Exp: ${formData.cardExp}, CVV: ***, Zip: ${formData.cardZip}`;
      } else {
        const maskedRouting = formData.routingNumber.slice(-4).padStart(9, "X");
        const maskedAccount = formData.accountNumber.slice(-4).padStart(formData.accountNumber.length, "X");
        paymentInfo = `ACH: Routing ${maskedRouting}, Account ${maskedAccount}`;
      }

      const res = await fetch("/api/payment-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          policyNumber: formData.policyNumber,
          amount: formData.amount,
          paymentType: formData.paymentType,
          paymentInfo,
          draftDate: formData.draftDate,
          todaysDate,
          processingFee: processingFee.toFixed(2),
          convenienceFee: convenienceFee.toFixed(2),
          convenienceFeeWaived: waiveConvenienceFee,
          totalAmount: totalAmount.toFixed(2),
          customerId: selectedCustomer?.id,
          customerType: selectedCustomer?.type,
          reason: formData.reason,
          reasonDetails: formData.reasonDetails,
          submitterEmail: formData.submitterEmail,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitSuccess(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitSuccess(false);
          handleClearCustomer();
          setFormData({
            firstName: "",
            lastName: "",
            policyNumber: "",
            amount: "",
            paymentType: "card",
            cardNumber: "",
            cardExp: "",
            cardCvv: "",
            cardZip: "",
            routingNumber: "",
            accountNumber: "",
            draftDate: "",
            submitterEmail: "",
            reason: "",
            reasonDetails: "",
          });
          setWaiveConvenienceFee(false);
        }, 3000);
      } else {
        setSubmitError(data.error || "Failed to submit payment advance");
      }
    } catch (error: any) {
      setSubmitError(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // HISTORY
  // ==========================================================================

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/payment-advance");
      const data = await res.json();
      if (data.success) {
        setAdvances(data.advances);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("History error:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleMarkProcessed = async (id: string, processed: boolean) => {
    try {
      const res = await fetch(`/api/payment-advance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processed }),
      });

      if (res.ok) {
        loadHistory();
      }
    } catch (error) {
      console.error("Mark processed error:", error);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Advance</h1>
            <p className="text-sm text-gray-500 mt-1">
              Submit customer payment information for agency advances
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "form"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              New Request
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "history"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              History ({stats.pending} pending)
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "form" ? (
          <div className="max-w-3xl mx-auto">
            {/* Success Message */}
            {submitSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <span className="text-xl">✓</span>
                  <span className="font-medium">Payment advance submitted successfully!</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <span className="text-xl">!</span>
                  <span className="font-medium">{submitError}</span>
                </div>
              </div>
            )}

            {/* Customer Search */}
            <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🔍</span> Customer Search
              </h2>

              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {selectedCustomer.firstName} {selectedCustomer.lastName}
                        </span>
                        {selectedCustomer.policyCount !== undefined && selectedCustomer.policyCount > 0 && (
                          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                            {selectedCustomer.policyCount} {selectedCustomer.policyCount === 1 ? 'policy' : 'policies'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {selectedCustomer.type === "customer" ? "Customer" : "Lead"}
                        {selectedCustomer.phone && ` • ${selectedCustomer.phone}`}
                        {selectedCustomer.email && ` • ${selectedCustomer.email}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleClearCustomer}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name..."
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <span className="animate-spin">⏳</span>
                    </div>
                  )}

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSelectCustomer(result)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-gray-900">
                              {result.firstName} {result.lastName}
                            </div>
                            {result.policyCount !== undefined && result.policyCount > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                {result.policyCount} {result.policyCount === 1 ? 'policy' : 'policies'}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap mt-1">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              result.type === "customer"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            )}>
                              {result.type}
                            </span>
                            {result.phone && <span>{result.phone}</span>}
                            {result.email && <span className="truncate max-w-[200px]">{result.email}</span>}
                            {result.policyTypes && result.policyTypes.length > 0 && (
                              <span className="text-xs text-gray-400">
                                ({result.policyTypes.slice(0, 3).join(', ')})
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>💵</span> Payment Advance Form
              </h2>

              <div className="text-sm text-gray-500 mb-6">
                Today&apos;s Date: <span className="font-medium text-gray-900">{todaysDate}</span>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Policy Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy *
                </label>
                {policiesLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 py-2">
                    <span className="animate-spin">⏳</span>
                    <span>Loading policies...</span>
                  </div>
                ) : policies.length > 0 && !manualPolicyEntry ? (
                  <select
                    value={selectedPolicy}
                    onChange={(e) => handlePolicyChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a policy...</option>
                    {policies.map((p) => (
                      <option key={p.policyNumber} value={p.policyNumber}>
                        {p.policyNumber} - {p.type} - {p.carrier}
                      </option>
                    ))}
                    <option value="other">Other (enter manually)</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.policyNumber}
                      onChange={(e) => handleInputChange("policyNumber", e.target.value)}
                      placeholder="Enter policy number"
                      required
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {policies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualPolicyEntry(false)}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
                      >
                        Select from list
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => handleInputChange("amount", e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Payment Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="card"
                      checked={formData.paymentType === "card"}
                      onChange={() => handleInputChange("paymentType", "card")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Credit/Debit Card</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="checking"
                      checked={formData.paymentType === "checking"}
                      onChange={() => handleInputChange("paymentType", "checking")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>ACH/Checking</span>
                  </label>
                </div>
              </div>

              {/* Card Fields */}
              {formData.paymentType === "card" && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Card Number *
                      </label>
                      <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => handleInputChange("cardNumber", e.target.value.replace(/\D/g, ""))}
                        maxLength={16}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expiration *
                      </label>
                      <input
                        type="text"
                        value={formData.cardExp}
                        onChange={(e) => handleInputChange("cardExp", e.target.value)}
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CVV *
                        </label>
                        <input
                          type="text"
                          value={formData.cardCvv}
                          onChange={(e) => handleInputChange("cardCvv", e.target.value.replace(/\D/g, ""))}
                          maxLength={4}
                          required
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="123"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ZIP *
                        </label>
                        <input
                          type="text"
                          value={formData.cardZip}
                          onChange={(e) => handleInputChange("cardZip", e.target.value.replace(/\D/g, ""))}
                          maxLength={5}
                          required
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="12345"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACH Fields */}
              {formData.paymentType === "checking" && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Routing Number *
                      </label>
                      <input
                        type="text"
                        value={formData.routingNumber}
                        onChange={(e) => handleInputChange("routingNumber", e.target.value.replace(/\D/g, ""))}
                        maxLength={9}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="123456789"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number *
                      </label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => handleInputChange("accountNumber", e.target.value.replace(/\D/g, ""))}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Account number"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Draft Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Draft Date *
                </label>
                <input
                  type="date"
                  value={formData.draftDate}
                  onChange={(e) => handleInputChange("draftDate", e.target.value)}
                  required
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Reason */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => handleInputChange("reason", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {formData.reason === "Other" && (
                  <textarea
                    value={formData.reasonDetails}
                    onChange={(e) => handleInputChange("reasonDetails", e.target.value)}
                    placeholder="Please provide details..."
                    rows={2}
                    className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>

              {/* Waive Convenience Fee */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waiveConvenienceFee}
                    onChange={(e) => setWaiveConvenienceFee(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Waive ${CONVENIENCE_FEE} convenience fee
                  </span>
                </label>
              </div>

              {/* Fee Summary */}
              {amount > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Amount:</span>
                      <span className="font-medium">${amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Processing Fee ({formData.paymentType === "card" ? "3.5%" : "1% max $10"}):
                      </span>
                      <span className="font-medium">${processingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Convenience Fee:</span>
                      <span className={cn("font-medium", waiveConvenienceFee && "text-green-600")}>
                        {waiveConvenienceFee ? "WAIVED" : `$${convenienceFee.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="border-t border-blue-200 pt-2 flex justify-between text-base">
                      <span className="font-semibold text-gray-900">Total Amount:</span>
                      <span className="font-bold text-blue-700">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submitter Email */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email (for confirmation)
                </label>
                <input
                  type="email"
                  value={formData.submitterEmail}
                  onChange={(e) => handleInputChange("submitterEmail", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="agent@tcds.com"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || amount <= 0}
                className={cn(
                  "w-full py-3 rounded-lg font-medium text-white transition-colors",
                  submitting || amount <= 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {submitting ? "Submitting..." : "Submit Payment Advance"}
              </button>
            </form>
          </div>
        ) : (
          /* History Tab */
          <div className="max-w-5xl mx-auto">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
                <div className="text-sm text-gray-500">Processed</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="animate-spin text-3xl">⏳</span>
                </div>
              ) : advances.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">📋</div>
                  <h3 className="text-lg font-medium text-gray-900">No payment advances yet</h3>
                  <p className="text-gray-500">Submit your first payment advance to see it here.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Policy
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Draft Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {advances.map((adv) => (
                      <tr key={adv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {adv.firstName} {adv.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {adv.submitterEmail || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {adv.policyNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            ${adv.totalAmount.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Base: ${adv.amount.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {adv.draftDate}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              adv.status === "pending" && "bg-amber-100 text-amber-700",
                              adv.status === "processed" && "bg-green-100 text-green-700",
                              adv.status === "failed" && "bg-red-100 text-red-700"
                            )}
                          >
                            {adv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {adv.status === "pending" && (
                            <button
                              onClick={() => handleMarkProcessed(adv.id, true)}
                              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Mark Processed
                            </button>
                          )}
                          {adv.status === "processed" && (
                            <button
                              onClick={() => handleMarkProcessed(adv.id, false)}
                              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              Reopen
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
