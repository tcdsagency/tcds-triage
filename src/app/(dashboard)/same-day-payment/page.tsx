"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

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
  submitterEmail: string;
  notes: string;
}

interface SameDayPayment {
  id: string;
  firstName: string;
  lastName: string;
  policyNumber: string;
  amount: number;
  paymentType: string;
  paymentInfo: string;
  submittedDate: string;
  status: string;
  processedAt: string | null;
  notes: string | null;
  submitterEmail: string | null;
  createdAt: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function SameDayPaymentPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");

  // User state
  const [isAdmin, setIsAdmin] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);

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
    submitterEmail: "",
    notes: "",
  });

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // History state
  const [payments, setPayments] = useState<SameDayPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, processed: 0, failed: 0 });

  // Bank validation state
  const [bankInfo, setBankInfo] = useState<{
    bankName: string;
    brandName: string;
    state: string;
    supportsAch: boolean;
  } | null>(null);
  const [bankValidating, setBankValidating] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankConfirmed, setBankConfirmed] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setFormData(prev => ({
            ...prev,
            submitterEmail: prev.submitterEmail || data.user.email || "",
          }));
          // Check if user is admin
          setIsAdmin(data.user.role === "admin" || data.user.role === "owner");
        }
        setUserLoaded(true);
      })
      .catch(() => {
        setUserLoaded(true);
      });
  }, []);

  // Validate bank routing number when it reaches 9 digits
  useEffect(() => {
    if (formData.routingNumber.length !== 9) {
      setBankInfo(null);
      setBankError(null);
      setBankConfirmed(false);
      return;
    }

    const validateRouting = async () => {
      setBankValidating(true);
      setBankError(null);
      setBankConfirmed(false);

      try {
        const res = await fetch(`/api/bank/validate-routing?routingNumber=${formData.routingNumber}`);
        const data = await res.json();

        if (!res.ok) {
          setBankError(data.error || "Invalid routing number");
          setBankInfo(null);
        } else if (!data.supportsAch) {
          setBankError("This routing number does not support ACH transfers");
          setBankInfo(null);
        } else {
          setBankInfo({
            bankName: data.bankName,
            brandName: data.brandName,
            state: data.state,
            supportsAch: data.supportsAch,
          });
        }
      } catch (error) {
        setBankError("Failed to validate routing number");
        setBankInfo(null);
      } finally {
        setBankValidating(false);
      }
    };

    validateRouting();
  }, [formData.routingNumber]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const todaysDate = new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const amount = parseFloat(formData.amount) || 0;

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

    setFormData((prev) => ({
      ...prev,
      firstName: customer.firstName,
      lastName: customer.lastName,
    }));

    // Load policies
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

  // Clear entire form and start fresh
  const handleClearForm = () => {
    setSelectedCustomer(null);
    setSearchQuery("");
    setSearchResults([]);
    setPolicies([]);
    setSelectedPolicy("");
    setManualPolicyEntry(false);
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
      submitterEmail: "",
      notes: "",
    });
    setBankInfo(null);
    setBankError(null);
    setBankConfirmed(false);
    setSubmitError(null);
    setSubmitSuccess(false);
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

  // Show confirmation modal before submitting
  const handleShowConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    setShowConfirmModal(false);
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

      const res = await fetch("/api/same-day-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          policyNumber: formData.policyNumber,
          amount: formData.amount,
          paymentType: formData.paymentType,
          paymentInfo,
          todaysDate,
          customerId: selectedCustomer?.id,
          customerType: selectedCustomer?.type,
          notes: formData.notes,
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
            submitterEmail: "",
            notes: "",
          });
        }, 3000);
      } else {
        setSubmitError(data.error || "Failed to submit payment");
      }
    } catch (error: any) {
      setSubmitError(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // HISTORY (ADMIN ONLY)
  // ==========================================================================

  const loadHistory = useCallback(async () => {
    if (!isAdmin) return;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/same-day-payment");
      const data = await res.json();
      if (data.success) {
        setPayments(data.payments);
        setStats(data.stats);
      } else {
        setHistoryError(data.error || "Failed to load history");
      }
    } catch (error) {
      console.error("History error:", error);
      setHistoryError("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === "history" && isAdmin) {
      loadHistory();
    }
  }, [activeTab, isAdmin, loadHistory]);

  const handleMarkProcessed = async (id: string, processed: boolean) => {
    try {
      const res = await fetch(`/api/same-day-payment/${id}`, {
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
            <h1 className="text-2xl font-bold text-gray-900">Same-Day Payment</h1>
            <p className="text-sm text-gray-500 mt-1">
              Collect client payment info for same-day processing (no fees)
            </p>
          </div>

          {/* Tab Switcher - Only show history tab to admins */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "form"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              New Payment
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === "history"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                History ({stats.pending} pending)
              </button>
            )}
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
                  <span className="text-xl">&#10003;</span>
                  <span className="font-medium">Payment submitted successfully!</span>
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
                <span>&#128269;</span> Customer Search
              </h2>

              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-xl">&#10003;</span>
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
                        {selectedCustomer.phone && ` - ${selectedCustomer.phone}`}
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
                    className="w-full px-4 py-3 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <span className="animate-spin">&#8987;</span>
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
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              result.type === "customer"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            )}>
                              {result.type}
                            </span>
                            {result.phone && <span>{result.phone}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                  <div className="bg-emerald-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white">Confirm Same-Day Payment</h3>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">{formData.firstName} {formData.lastName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Policy:</span>
                      <span className="font-medium">{formData.policyNumber}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="font-medium">
                        {formData.paymentType === "card"
                          ? `Card ending in ${formData.cardNumber.slice(-4)}`
                          : `ACH ending in ${formData.accountNumber.slice(-4)}`}
                      </span>
                    </div>
                    {formData.paymentType === "checking" && bankInfo && (
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Bank:</span>
                        <span className="font-medium text-green-700">
                          {bankInfo.brandName || bankInfo.bankName} &#10003;
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 text-lg">
                      <span className="font-semibold">Total Amount:</span>
                      <span className="font-bold text-emerald-600">${amount.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-emerald-600 text-center">No processing fees for same-day payments</p>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-6 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400"
                    >
                      {submitting ? "Processing..." : "Confirm & Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Form */}
            <form onSubmit={handleShowConfirmation} className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>&#128179;</span> Payment Information
                </h2>
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
                >
                  Clear Form
                </button>
              </div>

              <div className="text-sm text-gray-500 mb-6">
                Date: <span className="font-medium text-gray-900">{todaysDate}</span>
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
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    <span className="animate-spin">&#8987;</span>
                    <span>Loading policies...</span>
                  </div>
                ) : policies.length > 0 && !manualPolicyEntry ? (
                  <select
                    value={selectedPolicy}
                    onChange={(e) => handlePolicyChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      className="flex-1 px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    className="w-full pl-8 pr-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      className="w-4 h-4 text-emerald-600"
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
                      className="w-4 h-4 text-emerald-600"
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
                        className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                        className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                          className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                          className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.routingNumber}
                          onChange={(e) => handleInputChange("routingNumber", e.target.value.replace(/\D/g, ""))}
                          maxLength={9}
                          required
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500",
                            bankError && "border-red-300 bg-red-50",
                            bankInfo && bankConfirmed && "border-green-300 bg-green-50"
                          )}
                          placeholder="123456789"
                        />
                        {bankValidating && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <span className="animate-spin text-emerald-500">&#8987;</span>
                          </div>
                        )}
                      </div>
                      {bankError && (
                        <p className="mt-1 text-sm text-red-600">{bankError}</p>
                      )}
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
                        className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Account number"
                      />
                    </div>
                  </div>

                  {/* Bank Verification */}
                  {bankInfo && !bankConfirmed && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="text-amber-500 text-xl">&#127974;</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            Please confirm this is the correct bank:
                          </p>
                          <p className="text-lg font-semibold text-emerald-700 mt-1">
                            {bankInfo.brandName || bankInfo.bankName}
                          </p>
                          {bankInfo.state && (
                            <p className="text-sm text-gray-500">State: {bankInfo.state}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setBankConfirmed(true)}
                            className="mt-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            &#10003; Yes, this is correct
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bank Confirmed */}
                  {bankInfo && bankConfirmed && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">&#10003;</span>
                        <div>
                          <p className="font-medium text-green-700">
                            Bank verified: {bankInfo.brandName || bankInfo.bankName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBankConfirmed(false)}
                          className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Amount Display */}
              {amount > 0 && (
                <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-gray-900">Total Amount:</span>
                    <span className="font-bold text-emerald-700">${amount.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">No processing fees for same-day payments</p>
                </div>
              )}

              {/* Submitter Email */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email (for records)
                </label>
                <input
                  type="email"
                  value={formData.submitterEmail}
                  onChange={(e) => handleInputChange("submitterEmail", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="agent@tcds.com"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || amount <= 0 || (formData.paymentType === "checking" && (!bankInfo || !bankConfirmed))}
                className={cn(
                  "w-full py-3 rounded-lg font-medium text-white transition-colors",
                  submitting || amount <= 0 || (formData.paymentType === "checking" && (!bankInfo || !bankConfirmed))
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {submitting ? "Submitting..." : "Submit Payment"}
              </button>
              {formData.paymentType === "checking" && formData.routingNumber.length === 9 && !bankConfirmed && !bankError && (
                <p className="mt-2 text-sm text-amber-600 text-center">
                  Please confirm the bank name above before submitting
                </p>
              )}
            </form>
          </div>
        ) : (
          /* History Tab (Admin Only) */
          <div className="max-w-5xl mx-auto">
            {!isAdmin ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                <div className="text-5xl mb-4">&#128274;</div>
                <h3 className="text-lg font-medium text-red-900">Access Denied</h3>
                <p className="text-red-700 mt-2">
                  Only administrators can view payment history.
                </p>
              </div>
            ) : (
              <>
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
                      <span className="animate-spin text-3xl">&#8987;</span>
                    </div>
                  ) : historyError ? (
                    <div className="text-center py-12 text-red-600">
                      <p>{historyError}</p>
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-3">&#128203;</div>
                      <h3 className="text-lg font-medium text-gray-900">No payments yet</h3>
                      <p className="text-gray-500">Submit your first same-day payment to see it here.</p>
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
                            Payment Info
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
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
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {payment.firstName} {payment.lastName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {payment.submitterEmail || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {payment.policyNumber}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                ${payment.amount.toFixed(2)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                              {payment.paymentInfo}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {payment.submittedDate}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  payment.status === "pending" && "bg-amber-100 text-amber-700",
                                  payment.status === "processed" && "bg-green-100 text-green-700",
                                  payment.status === "failed" && "bg-red-100 text-red-700"
                                )}
                              >
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {payment.status === "pending" && (
                                <button
                                  onClick={() => handleMarkProcessed(payment.id, true)}
                                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                >
                                  Mark Processed
                                </button>
                              )}
                              {payment.status === "processed" && (
                                <button
                                  onClick={() => handleMarkProcessed(payment.id, false)}
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
